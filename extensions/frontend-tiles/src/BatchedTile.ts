/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ByteStream, Logger } from "@itwin/core-bentley";
import { Tileset3dSchema } from "@itwin/core-common";
import {
  GltfReaderProps, ImdlReader, IModelApp, RealityTileLoader, RenderSystem, Tile, TileContent, TileDrawArgs, TileLoadStatus, TileParams, TileRequest,
  TileRequestChannel, TileTreeLoadStatus, TileUser, TileVisibility, Viewport,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTileTree } from "./BatchedTileTree";
import { BatchedTileContentReader } from "./BatchedTileContentReader";

export interface BatchedTileParams extends TileParams {
  childrenProps: Tileset3dSchema.Tile[] | undefined;
}

export class BatchedTile extends Tile {
  private readonly _childrenProps?: Tileset3dSchema.Tile[];

  public get batchedTree(): BatchedTileTree {
    return this.tree as BatchedTileTree;
  }

  public constructor(params: BatchedTileParams, tree: BatchedTileTree) {
    super(params, tree);
    if (params.childrenProps?.length)
      this._childrenProps = params.childrenProps;

    if (!this.contentId)
      this.setIsReady();
  }

  private get _batchedChildren(): BatchedTile[] | undefined {
    return this.children as BatchedTile[] | undefined;
  }

  public override computeLoadPriority(viewports: Iterable<Viewport>, _users: Iterable<TileUser>): number {
    // Prioritize tiles closer to the camera and to the center of attention (zoom point or center of screen).
    // ###TODO move this function off of RealityTileLoader.
    return RealityTileLoader.computeTileLocationPriority(this, viewports, this.tree.iModelTransform);
  }

  public override meetsScreenSpaceError(args: TileDrawArgs): boolean {
    const doSuper = true;
    if (doSuper || !args.context.viewport.isCameraOn)
      return super.meetsScreenSpaceError(args);

    // ###TODO evaluate this. It's from [Dani's 3js prototype](https://dev.azure.com/DANIELIBORRA/_git/Three.js%20prototype%20with%203D%20Tiles%201.1?path=/Tiles3D.js).
    // It ignores geometricError, which seems to be smaller than it should be.
    assert(args.context.viewport.view.is3d() && args.context.viewport.view.isCameraOn);
    const center = args.getTileCenter(this);
    const radius = args.getTileRadius(this);
    const cam = args.context.viewport.view.camera.eye;
    const minDist = Math.max(Math.abs(center.x - cam.x), Math.max(Math.abs(center.y - cam.y), Math.abs(center.z - cam.z)));
    return minDist >= radius * 1.5;
  }

  // Return true to select the parent tile for display.
  public selectTiles(selected: BatchedTile[], args: TileDrawArgs, numSkipped: number): boolean {
    let vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis)
      return false;

    if (TileVisibility.Visible === vis) {
      // This tile is of appropriate resolution to draw. If need loading or refinement, enqueue.
      if (!this.isReady)
        args.insertMissing(this);

      if (this.hasGraphics) {
        // It can be drawn - select it
        args.markReady(this);
        selected.push(this);
      } else if (!this.isReady) {
        // It can't be drawn. Try to draw children in its place; otherwise draw the parent.
        // Do not load/request the children for this purpose.
        const initialSize = selected.length;
        const kids = this._batchedChildren;
        if (undefined === kids)
          return true;

        // If all visible direct children can be drawn, draw them.
        for (const kid of kids) {
          if (TileVisibility.OutsideFrustum !== kid.computeVisibility(args)) {
            if (!kid.hasGraphics) {
              selected.length = initialSize;
              return true;
            } else {
              selected.push(kid);
            }
          }
        }

        args.markUsed(this);
      }

      // We're drawing either this tile, or its direct children.
      return false;
    }

    const maxLevelsToSkip = 1;

    // This tile is too coarse to draw. Try to draw something more appropriate.
    // If it is not ready to draw, we may want to skip loading in favor of loading its descendants.
    // If we previously loaded and later unloaded content for this tile to free memory, don't force it to reload its content - proceed to children.
    let canSkipThisTile = this._hadGraphics && !this.hasGraphics;
    if (canSkipThisTile) {
      numSkipped = 1;
    } else {
      canSkipThisTile = this.isReady || this.isParentDisplayable;
      if (canSkipThisTile && this.isDisplayable) { // skipping an undisplayable tile doesn't count toward the maximum
        const isNotReady = !this.isReady && !this.hasGraphics;
        if (isNotReady) {
          if (numSkipped >= maxLevelsToSkip)
            canSkipThisTile = false;
          else
            numSkipped += 1;
        }
      }
    }

    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    const children = canSkipThisTile ? this._batchedChildren : undefined;
    if (canSkipThisTile && TileTreeLoadStatus.Loading === childrenLoadStatus) {
      args.markChildrenLoading();
      args.markUsed(this);
    }

    if (undefined !== children) {
      // If we are the root tile and we are not displayable, then we want to draw *any* currently available children in our place, or else we would draw nothing.
      // Otherwise, if we want to draw children in our place, we should wait for *all* of them to load, or else we would show missing chunks where not-yet-loaded children belong.
      const isUndisplayableRootTile = this.isUndisplayableRootTile;
      args.markUsed(this);
      let drawChildren = true;
      const initialSize = selected.length;
      for (const child of children) {
        // NB: We must continue iterating children so that they can be requested if missing.
        if (true === child.selectTiles(selected, args, numSkipped)) {
          if (child.loadStatus === TileLoadStatus.NotFound) {
            // At least one child we want to draw failed to load. e.g., we reached max depth of map tile tree. Draw parent instead.
            drawChildren = canSkipThisTile = false;
          } else {
            // At least one child we want to draw is not yet loaded. Wait for it to load before drawing it and its siblings, unless we have nothing to draw in their place.
            drawChildren = isUndisplayableRootTile;
          }
        }
      }

      if (drawChildren)
        return false;

      // Some types of tiles (like maps) allow the ready children to be drawn on top of the parent while other children are not yet loaded.
      if (args.parentsAndChildrenExclusive)
        selected.length = initialSize;
    }

    if (this.isReady) {
      if (this.hasGraphics) {
        selected.push(this);
        if (!canSkipThisTile) {
          // This tile is too coarse, but we require loading it before we can start loading higher-res children.
          args.markReady(this);
        }
      }

      return false;
    }

    // This tile is not ready to be drawn. Request it *only* if we cannot skip it.
    if (!canSkipThisTile)
      args.insertMissing(this);

    return this.isParentDisplayable ? true : false;
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void {
    let children: BatchedTile[] | undefined;
    if (this._childrenProps) {
      try {
        for (const childProps of this._childrenProps) {
          const params = this.batchedTree.reader.readTileParams(childProps, this);
          const child = new BatchedTile(params, this.batchedTree);
          children = children ?? [];
          children.push(child);
        }
      } catch (err) {
        Logger.logException(loggerCategory, err);
        children = undefined;
        if (err instanceof Error)
          reject(err);
      }
    }

    resolve(children);
  }

  public override get channel(): TileRequestChannel {
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-batched-models");
  }

  public override async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    const url = new URL(this.contentId, this.batchedTree.reader.baseUrl);
    url.search = this.batchedTree.reader.baseUrl.search;
    const response = await fetch(url.toString());
    return response.arrayBuffer();
  }

  public override async readContent(data: TileRequest.ResponseData, system: RenderSystem, shouldAbort?: () => boolean): Promise<TileContent> {
    assert(data instanceof Uint8Array);
    if (!(data instanceof Uint8Array))
      return { };

    let reader: ImdlReader | BatchedTileContentReader | undefined = ImdlReader.create({
      stream: ByteStream.fromUint8Array(data),
      iModel: this.tree.iModel,
      modelId: this.tree.modelId,
      is3d: true,
      system,
      isCanceled: shouldAbort,
      options: {
        tileId: this.contentId,
      },
    });

    if (!reader) {
      const gltfProps = GltfReaderProps.create(data, false, this.batchedTree.reader.baseUrl);
      if (gltfProps) {
        reader = new BatchedTileContentReader({
          props: gltfProps,
          iModel: this.tree.iModel,
          system,
          shouldAbort,
          vertexTableRequired: true,
          modelId: this.tree.modelId,
          isLeaf: this.isLeaf,
          range: this.range,
        });
      }
    }

    if (!reader)
      return { };

    return reader.read();
  }
}

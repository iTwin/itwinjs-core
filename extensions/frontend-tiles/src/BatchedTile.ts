/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ByteStream, Logger } from "@itwin/core-bentley";
import { Tileset3dSchema } from "@itwin/core-common";
import {
  GltfReaderProps, ImdlReader, IModelApp, RealityTileLoader, RenderSystem, Tile, TileContent, TileDrawArgs, TileParams, TileRequest,
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

  public override computeLoadPriority(viewports: Iterable<Viewport>, users: Iterable<TileUser>): number {
    // Prioritize tiles closer to camera and center of attention (zoom point or screen center).
    // ###TODO move this function out of RealityTileLoader.
    return RealityTileLoader.computeTileLocationPriority(this, viewports, this.tree.iModelTransform);
  }

  public override meetsScreenSpaceError(args: TileDrawArgs): boolean {
    // ###TODO evaluate this. It's from [Dani's 3js prototype](https://dev.azure.com/DANIELIBORRA/_git/Three.js%20prototype%20with%203D%20Tiles%201.1?path=/Tiles3D.js).
    // It ignores geometricError, which seems to be smaller than it should be.
    const doSuper = true;
    if (doSuper || !args.context.viewport.isCameraOn)
      return super.meetsScreenSpaceError(args);

    assert(args.context.viewport.view.is3d() && args.context.viewport.view.isCameraOn);
    const center = args.getTileCenter(this);
    const radius = args.getTileRadius(this);
    const cam = args.context.viewport.view.camera.eye;
    const minDist = Math.max(Math.abs(center.x - cam.x), Math.max(Math.abs(center.y - cam.y), Math.abs(center.z - cam.z)));
    return minDist >= radius * 1.5;
  }

  public selectTiles(selected: BatchedTile[], args: TileDrawArgs): void {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis)
      return;

    // ###TODO proper tile selection
    if (!this.isReady) {
      args.insertMissing(this);
      return;
    }

    if (TileVisibility.Visible === vis && this.hasGraphics) {
      args.markReady(this);
      selected.push(this);
      return;
    }

    args.markUsed(this);
    if (this.isReady) {
      const childrenStatus = this.loadChildren();
      if (TileTreeLoadStatus.Loading === childrenStatus)
        args.markChildrenLoading();

      const children = this._batchedChildren;
      if (children)
          for (const child of children)
            child.selectTiles(selected, args);
    }
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

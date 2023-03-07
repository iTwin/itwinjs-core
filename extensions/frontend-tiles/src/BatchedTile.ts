/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Logger } from "@itwin/core-bentley";
import { Tileset3dSchema } from "@itwin/core-common";
import {
  GltfReaderProps, IModelApp, RenderSystem, Tile, TileContent, TileDrawArgs, TileParams, TileRequest, TileRequestChannel, TileTreeLoadStatus, TileVisibility,
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

  public override computeVisibility(args: TileDrawArgs): TileVisibility {
    // ###TODO evaluate this. It's from [Dani's 3js prototype](https://dev.azure.com/DANIELIBORRA/_git/Three.js%20prototype%20with%203D%20Tiles%201.1?path=/Tiles3D.js).
    // It ignores geometricError, which seems to be smaller than it should be.
    const doSuper = true;
    if (doSuper || !args.context.viewport.isCameraOn)
      return super.computeVisibility(args);

    // All of the following is copy-pasted from super
    if (this.isEmpty)
      return TileVisibility.OutsideFrustum;

    if (args.boundingRange && !args.boundingRange.intersectsRange(this.range))
      return TileVisibility.OutsideFrustum;

    // NB: We test for region culling before isDisplayable - otherwise we will never unload children of undisplayed tiles when
    // they are outside frustum
    if (this.isRegionCulled(args))
      return TileVisibility.OutsideFrustum;

    // some nodes are merely for structure and don't have any geometry
    if (!this.isDisplayable)
      return TileVisibility.TooCoarse;

    if (this.isLeaf) {
      if (this.hasContentRange && this.isContentCulled(args))
        return TileVisibility.OutsideFrustum;
      else
        return TileVisibility.Visible;
    }

    // The only bit that differs from super:
    assert(args.context.viewport.view.is3d() && args.context.viewport.view.isCameraOn);
    const center = args.getTileCenter(this);
    const radius = args.getTileRadius(this);
    const cam = args.context.viewport.view.camera.eye;
    const minDist = Math.max(Math.abs(center.x - cam.x), Math.max(Math.abs(center.y - cam.y), Math.abs(center.z - cam.z)));
    return minDist < radius * 1.5 ? TileVisibility.TooCoarse : TileVisibility.Visible;
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
    const url = `${this.batchedTree.reader.baseUrl}${this.contentId}`;
    const response = await fetch(url);
    return response.arrayBuffer();
  }

  public override async readContent(data: TileRequest.ResponseData, system: RenderSystem, shouldAbort?: () => boolean): Promise<TileContent> {
    assert(data instanceof Uint8Array);
    if (!(data instanceof Uint8Array))
      return { };

    const props = GltfReaderProps.create(data, false, this.batchedTree.reader.baseUrl);
    if (!props)
      return { };

    const reader = new BatchedTileContentReader({
      props,
      iModel: this.tree.iModel,
      system,
      shouldAbort,
      vertexTableRequired: true,
      modelId: this.tree.modelId,
      isLeaf: this.isLeaf,
      range: this.range,
    });

    return reader.read();
  }
}

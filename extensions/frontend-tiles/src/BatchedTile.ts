/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, RenderSystem, Tile, TileContent, TileParams, TileRequest, TileRequestChannel,
} from "@itwin/core-frontend";
import { BatchedTileTree } from "./BatchedTileTree";

export class BatchedTile extends Tile {
  public constructor(params: TileParams, tree: BatchedTileTree) {
    super(params, tree);
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    // ###TODO
    resolve([]);
  }

  public override get channel(): TileRequestChannel {
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-batched-models");
  }

  public override requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    // ###TODO
    return Promise.resolve(undefined);
  }

  public override readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled?: () => boolean): Promise<TileContent> {
    // ###TODO
    return Promise.resolve({ });
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelDb } from "../IModelDb";
import {
  IModelTileRpcInterface,
  IModelToken,
  TileTreeProps,
  RpcInterface,
  RpcManager,
} from "@bentley/imodeljs-common";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** @hidden */
export class IModelTileRpcImpl extends RpcInterface implements IModelTileRpcInterface {
  public static register() { RpcManager.registerImpl(IModelTileRpcInterface, IModelTileRpcImpl); }

  public async getTileTreeProps(iModelToken: IModelToken, id: string): Promise<TileTreeProps> {
    const actx = ActivityLoggingContext.current; actx.enter();
    const db = IModelDb.find(iModelToken);
    return db.tiles.requestTileTreeProps(actx, id);
  }

  public async getTileContent(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array> {
    const actx = ActivityLoggingContext.current; actx.enter();
    const db = IModelDb.find(iModelToken);
    return db.tiles.requestTileContent(actx, treeId, contentId);
  }
}

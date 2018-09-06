/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelDb } from "../IModelDb";
import {
  IModelTileRpcInterface,
  IModelToken,
  TileId,
  TileTreeProps,
  RpcInterface,
  RpcManager,
} from "@bentley/imodeljs-common";

/** @hidden */
export class IModelTileRpcImpl extends RpcInterface implements IModelTileRpcInterface {
  public static register() { RpcManager.registerImpl(IModelTileRpcInterface, IModelTileRpcImpl); }

  public async getTileTreeProps(iModelToken: IModelToken, id: string): Promise<TileTreeProps> {
    const db = IModelDb.find(iModelToken);
    return db.tiles.requestTileTreeProps(id);
  }

  public async getTileContent(iModelToken: IModelToken, id: TileId): Promise<string> {
    const db = IModelDb.find(iModelToken);
    return db.tiles.getTileContent(id.treeId, id.tileId);
  }
}

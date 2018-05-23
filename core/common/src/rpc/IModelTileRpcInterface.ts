/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64, Id64Set } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelToken } from "../IModel";
import { TileId, TileProps, TileTreeProps } from "../TileProps";

export abstract class IModelTileRpcInterface extends RpcInterface {
  public static version = "0.1.0";

  public static types = () => [
    IModelToken,
    Id64,
    TileId,
  ]

  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  public getTileTreeProps(_iModelToken: IModelToken, _ids: Id64Set): Promise<TileTreeProps[]> { return this.forward.apply(this, arguments); }
  public getTileProps(_iModelToken: IModelToken, _ids: TileId[]): Promise<TileProps[]> { return this.forward.apply(this, arguments); }
}

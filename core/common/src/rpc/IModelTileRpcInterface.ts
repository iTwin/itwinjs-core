/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64 } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelToken } from "../IModel";
import { TileId, TileTreeProps } from "../TileProps";

export abstract class IModelTileRpcInterface extends RpcInterface {
  public static version = "0.1.0";

  public static types = () => [
    IModelToken,
    Id64,
    TileId,
  ]

  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  public getTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps> { return this.forward.apply(this, arguments); }
  public getTileContent(_iModelToken: IModelToken, _id: TileId): Promise<string> { return this.forward.apply(this, arguments); }
}

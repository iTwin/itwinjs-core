/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelToken } from "../IModel";
import { TileTreeProps } from "../TileProps";

export abstract class IModelTileRpcInterface extends RpcInterface {
  public static types = () => [
    IModelToken,
  ]

  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  /** The semantic version of the interface. */
  public static version = "0.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public getTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps> { return this.forward.apply(this, arguments); }
  public getTileContent(_iModelToken: IModelToken, _treeId: string, _contentId: string): Promise<Uint8Array> { return this.forward.apply(this, arguments); }
}

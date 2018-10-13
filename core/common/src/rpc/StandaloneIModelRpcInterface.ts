/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { OpenMode } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModel, IModelToken } from "../IModel";

/**
 * The RPC interface for working with standalone iModels.
 * Products are generally discouraged from using standalone iModels and therefore registering this interface.
 */
export abstract class StandaloneIModelRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [IModelToken];

  /** Returns the StandaloneIModelRpcInterface client instance for the frontend. */
  public static getClient(): StandaloneIModelRpcInterface { return RpcManager.getClientForInterface(StandaloneIModelRpcInterface); }

  public openStandalone(_fileName: string, _openMode: OpenMode): Promise<IModel> { return this.forward.apply(this, arguments); }
  public closeStandalone(_iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelToken } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/**
 * The purpose of this class is to house WIP RPC methods. For example:
 * - WIP methods where signatures or behavior is still changing
 * - Experimental methods that we may decide are a bad idea and never release
 * The idea is to house these WIP RPC methods away from other RpcInterfaces that have stated compatibility goals.
 * Once stable, the goal is to move methods out to their rightful home.
 * Apps/services should understand the *flux* implied by registering this RpcInterface and should be in control of both the client and server before even considering using it.
 */
export abstract class WipRpcInterface extends RpcInterface {
  /** The types that can be marshaled by the interface. */
  public static types = () => [
    IModelToken,
  ]

  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): WipRpcInterface { return RpcManager.getClientForInterface(WipRpcInterface); }

  /** The semantic version of the interface. */
  public static version = "0.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public placeholder(_iModelToken: IModelToken): Promise<string> { return this.forward.apply(this, arguments); } // here to test that WipRpcInterface is configured properly
}

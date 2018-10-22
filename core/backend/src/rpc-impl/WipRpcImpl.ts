/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelToken, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { WipRpcInterface } from "@bentley/imodeljs-common/lib/rpc/WipRpcInterface"; // not part of the "barrel"

/**
 * The backend implementation of WipRpcInterface.
 * @hidden
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_iModelToken: IModelToken): Promise<string> { return "placeholder"; }
}

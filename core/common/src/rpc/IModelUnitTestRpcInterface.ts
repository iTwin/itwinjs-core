/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelToken } from "../IModel";

/**
 * For unit testing purposes only. This interface should not be registered by real products.
 * @hidden
 */
export abstract class IModelUnitTestRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [IModelToken];

  /** Returns the IModelUnitTestRpcInterface client instance for the frontend. */
  public static getClient(): IModelUnitTestRpcInterface { return RpcManager.getClientForInterface(IModelUnitTestRpcInterface); }

  public executeTest(_iModelToken: IModelToken, _testName: string, _params: any): Promise<any> { return this.forward.apply(this, arguments); }
}

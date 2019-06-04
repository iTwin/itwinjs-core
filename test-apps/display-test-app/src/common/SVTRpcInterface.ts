/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";

/** Display Performance RPC interface. */
export default class SVTRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "SVTRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [];

  public static getClient(): SVTRpcInterface { return RpcManager.getClientForInterface(SVTRpcInterface); }

  public async readExternalSavedViews(_filename: string): Promise<string> { return this.forward(arguments); }
  public async writeExternalSavedViews(_filename: string, _namedViews: string): Promise<void> { return this.forward(arguments); }
}

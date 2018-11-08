/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";

/** Sample RPC interface. */
export default class DisplayPerfRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** Full path of the json file; will use the default json file instead if this file cannot be found */
  public static jsonFilePath = "";

  /** The types that can be marshaled by the interface. */
  public static types = () => [];

  public static getClient(): DisplayPerfRpcInterface { return RpcManager.getClientForInterface(DisplayPerfRpcInterface); }

  public getDefaultConfigs(): Promise<string> { return this.forward.apply(this, arguments); }

}

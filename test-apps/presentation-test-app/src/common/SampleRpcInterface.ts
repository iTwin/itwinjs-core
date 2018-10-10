/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";

/** Sample RPC interface. */
export default abstract class SampleRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [];

  public static getClient(): SampleRpcInterface { return RpcManager.getClientForInterface(SampleRpcInterface); }

  public getSampleImodels(): Promise<string[]> { return this.forward.apply(this, arguments); }
}

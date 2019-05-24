/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";

/** Sample RPC interface. */
export default abstract class SampleRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "SampleRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  public static getClient(): SampleRpcInterface { return RpcManager.getClientForInterface(SampleRpcInterface); }

  public async getSampleImodels(): Promise<string[]> { return this.forward(arguments); }
  public async getAvailableRulesets(): Promise<string[]> { return this.forward(arguments); }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager, RpcOperation, RpcRequestTokenSupplier_T } from "@itwin/core-common";

const localDeploymentOnly: RpcRequestTokenSupplier_T = () => ({ iModelId: "none", key: "" }); // eslint-disable-line deprecation/deprecation

/** Sample RPC interface. */
export default abstract class SampleRpcInterface extends RpcInterface { // eslint-disable-line deprecation/deprecation
  /** The immutable name of the interface. */
  public static readonly interfaceName = "SampleRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  public static getClient(): SampleRpcInterface { return RpcManager.getClientForInterface(SampleRpcInterface); } // eslint-disable-line deprecation/deprecation

  @RpcOperation.setRoutingProps(localDeploymentOnly) // eslint-disable-line deprecation/deprecation
  public async getSampleImodels(): Promise<string[]> { return this.forward(arguments); }

  @RpcOperation.setRoutingProps(localDeploymentOnly) // eslint-disable-line deprecation/deprecation
  public async getAvailableRulesets(): Promise<string[]> { return this.forward(arguments); }
}

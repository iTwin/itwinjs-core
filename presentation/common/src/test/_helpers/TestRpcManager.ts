/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcConfiguration, RpcDefaultConfiguration, RpcInterfaceDefinition } from "@itwin/core-common";

/**
 * @internal Used for testing only.
 */
export class TestRpcManager {
  public static initializeClient(interfaces: RpcInterfaceDefinition[]) { // eslint-disable-line deprecation/deprecation
    const config = class extends RpcDefaultConfiguration { // eslint-disable-line deprecation/deprecation
      public override interfaces: any = () => interfaces;
    };

    for (const def of interfaces)
      RpcConfiguration.assign(def, () => config); // eslint-disable-line deprecation/deprecation

    const instance = RpcConfiguration.obtain(config); // eslint-disable-line deprecation/deprecation
    try {
      RpcConfiguration.initializeInterfaces(instance); // eslint-disable-line deprecation/deprecation
    } catch (_e) {
      // this may fail with "Error: RPC interface "xxx" is already initialized." because
      // multiple different tests want to set up rpc interfaces
    }
  }
}

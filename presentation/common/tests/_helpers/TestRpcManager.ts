/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcConfiguration, RpcInterfaceDefinition, RpcDefaultConfiguration } from "@bentley/imodeljs-common";

export default class TestRpcManager {
  public static initializeClient(interfaces: RpcInterfaceDefinition[]) {
    const config = class extends RpcDefaultConfiguration {
      public interfaces: any = () => interfaces;
    };

    for (const def of interfaces)
      RpcConfiguration.assign(def, () => config);

    const instance = RpcConfiguration.obtain(config);
    try {
      RpcConfiguration.initializeInterfaces(instance);
    } catch (_e) {
      // this may fail with "Error: RPC interface "xxx" is already initialized." because
      // multiple different tests want to set up rpc interfaces
    }
  }
}

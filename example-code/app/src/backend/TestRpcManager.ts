/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcDefaultConfiguration, RpcInterfaceDefinition, RpcConfiguration } from "@bentley/imodeljs-common";

export class TestRpcManager {
  public static initialize(interfaces: RpcInterfaceDefinition[]) {
    const config = class extends RpcDefaultConfiguration {
      public interfaces: any = () => interfaces;
    };

    for (const def of interfaces)
      RpcConfiguration.assign(def, () => RpcDefaultConfiguration);

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);
  }
}

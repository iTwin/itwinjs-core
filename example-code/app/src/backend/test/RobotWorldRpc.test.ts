/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { StandaloneIModelRpcInterface, RpcInterfaceDefinition, RpcConfiguration } from "@bentley/imodeljs-common";
import { RobotWorldReadRpcInterface } from "../../common/RobotWorldRpcInterface";
import { RpcDefaultConfiguration } from "@bentley/imodeljs-common";

class TestRpcManager {
  public static initializeClient(interfaces: RpcInterfaceDefinition[]) {
    const config = class extends RpcDefaultConfiguration {
      public interfaces: any = () => interfaces;
    };

    for (const def of interfaces)
      RpcConfiguration.assign(def, () => config);

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);
  }
}

describe.only("RobotWorldRpc", () => {

  // install mock of browser's XMLHttpRequest for unit tests
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

  it("should run robotworld through RPC as a client", async () => {
    IModelApp.startup();

    // expose interfaces using a direct call mechanism
    TestRpcManager.initializeClient([StandaloneIModelRpcInterface, RobotWorldReadRpcInterface]);

    const iModel: IModelConnection = await IModelConnection.openStandalone("assets/empty.bim");
    assert.isTrue(iModel !== undefined);

    iModel.closeStandalone();
  });
});

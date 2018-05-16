/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { StandaloneIModelRpcInterface, RpcInterfaceDefinition, RpcConfiguration } from "@bentley/imodeljs-common";
import { RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface } from "../../common/RobotWorldRpcInterface";
import { RpcDefaultConfiguration } from "@bentley/imodeljs-common";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { KnownTestLocations } from "./KnownTestLocations";
import { OpenMode } from "@bentley/bentleyjs-core";

class TestRpcManager {
  public static initializeClient(interfaces: RpcInterfaceDefinition[]) {
    const config = class extends RpcDefaultConfiguration {
      public interfaces: any = () => interfaces;
    };

    for (const def of interfaces)
      RpcConfiguration.assign(def, () => RpcDefaultConfiguration);

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);
  }
}

function simulateBackendDeployment() {
  RobotWorldEngine.initialize();
}

function simulateBackendShutdown() {
  RobotWorldEngine.shutdown();
}

describe("RobotWorldRpc", () => {

  // install mock of browser's XMLHttpRequest for unit tests
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

  it("should run robotworld through RPC as a client", async () => {
    // Simulate the deployment of the backend server
    simulateBackendDeployment();

    IModelApp.startup();

    // expose interfaces using a direct call mechanism
    TestRpcManager.initializeClient([StandaloneIModelRpcInterface, RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface]);

    const iModel: IModelConnection = await IModelConnection.openStandalone(KnownTestLocations.assetsDir + "/empty.bim", OpenMode.ReadWrite);
    assert.isTrue(iModel !== undefined);

    RobotWorldWriteRpcInterface.getClient().importSchema(iModel.iModelToken);

    iModel.closeStandalone();

    IModelApp.shutdown();

    simulateBackendShutdown();
  });
});

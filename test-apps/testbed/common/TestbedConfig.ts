/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  BentleyCloudRpcManager,
  ElectronRpcManager,
  BentleyCloudRpcConfiguration,
  RpcOperation,
  IModelToken,
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelWriteRpcInterface,
  StandaloneIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { IModelUnitTestRpcInterface } from "@bentley/imodeljs-common/lib/rpc/IModelUnitTestRpcInterface"; // not part of the "barrel"
import { TestRpcInterface, TestRpcInterface2, TestRpcInterface3 } from "./TestRpcInterface";

declare var ___TESTBED_IPC_RENDERER___: any;

export class TestbedConfig {
  public static cloudRpcParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static swaggerURI = "/v3/swagger.json";
  public static cloudRpc: BentleyCloudRpcConfiguration;
  public static get ipc(): any { return ___TESTBED_IPC_RENDERER___; }
  public static useIPC = false;
  public static rpcInterfaces = [IModelReadRpcInterface, IModelTileRpcInterface, IModelWriteRpcInterface, StandaloneIModelRpcInterface, IModelUnitTestRpcInterface, TestRpcInterface, TestRpcInterface2];

  public static initializeRpcFrontend() {
    if (TestbedConfig.useIPC) {
      ElectronRpcManager.initializeClient({}, TestbedConfig.rpcInterfaces);
    } else {
      TestbedConfig.cloudRpc = BentleyCloudRpcManager.initializeClient(TestbedConfig.cloudRpcParams, TestbedConfig.rpcInterfaces);
      TestbedConfig.initializeBentleyCloudCommon();
    }

    ElectronRpcManager.initializeClient({}, [TestRpcInterface3]);
  }

  public static initializeRpcBackend() {
    if (TestbedConfig.useIPC) {
      ElectronRpcManager.initializeImpl({}, TestbedConfig.rpcInterfaces);
    } else {
      TestbedConfig.cloudRpc = BentleyCloudRpcManager.initializeImpl(TestbedConfig.cloudRpcParams, TestbedConfig.rpcInterfaces);
      TestbedConfig.initializeBentleyCloudCommon();
    }

    ElectronRpcManager.initializeImpl({}, [TestRpcInterface3]);
  }

  public static sendToMainSync(msg: TestbedIpcMessage) {
    return TestbedConfig.ipc.sendSync("testbed", msg);
  }

  private static initializeBentleyCloudCommon() {
    for (const definition of TestbedConfig.rpcInterfaces) {
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test"));
    }
  }
}

export interface TestbedIpcMessage {
  name: string;
  value: any;
}

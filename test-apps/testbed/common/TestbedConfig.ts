/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
  RpcManager,
  MobileRpcManager,
  IModelUnitTestRpcInterface,
  WipRpcInterface,
} from "@bentley/imodeljs-common";
import {
  TestRpcInterface,
  TestRpcInterface2,
  TestRpcInterface3,
  ZeroMajorRpcInterface,
  RpcElectronTransportTest,
  RpcDirectTransportTest,
  RpcTransportTestImpl,
  RpcWebTransportTest,
  RpcMobileTransportTest,
} from "./TestRpcInterface";
import { OpenMode } from "@bentley/bentleyjs-core";

declare var ___TESTBED_IPC_RENDERER___: any;

export async function testInterfaceResource() {
  const data = new Uint8Array(4);
  data[0] = 1;
  data[1] = 2;
  data[2] = 3;
  data[3] = 4;
  return Promise.resolve(data);
}

class TestRpcImplDirect extends TestRpcInterface {
  public async op12(): Promise<Uint8Array> {
    return testInterfaceResource();
  }

  public async op13(data: Uint8Array): Promise<void> {
    if (data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 4) {
      return;
    } else {
      throw new Error();
    }
  }
}

export class TestbedConfig {
  public static cloudRpcParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static mobilePort = process.env.MOBILE_PORT ? parseInt(process.env.MOBILE_PORT, 10) : 4000;
  public static swaggerURI = "/v3/swagger.json";
  public static cloudRpc: BentleyCloudRpcConfiguration;
  public static get ipc(): any { return ___TESTBED_IPC_RENDERER___; }
  public static useHttp2 = false;

  public static get localServerUrlPrefix() {
    const protocol = TestbedConfig.useHttp2 ? "https" : "http";
    const port = TestbedConfig.serverPort;
    return `${protocol}://localhost:${port}`;
  }

  public static useIPC = false;
  public static useDirect = false;
  public static rpcInterfaces = [
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    IModelWriteRpcInterface,
    StandaloneIModelRpcInterface,
    IModelUnitTestRpcInterface,
    WipRpcInterface,
    TestRpcInterface,
    TestRpcInterface2,
    ZeroMajorRpcInterface,
  ];

  public static initializeRpcFrontend() {
    if (TestbedConfig.useDirect) {
      RpcManager.initializeInterface(TestRpcInterface);
      RpcManager.registerImpl(TestRpcInterface, TestRpcImplDirect);
    } else if (TestbedConfig.useIPC) {
      ElectronRpcManager.initializeClient({}, TestbedConfig.rpcInterfaces);
    } else {
      TestbedConfig.cloudRpc = BentleyCloudRpcManager.initializeClient(TestbedConfig.cloudRpcParams, TestbedConfig.rpcInterfaces);
      TestbedConfig.initializeBentleyCloudCommon();
    }

    ElectronRpcManager.initializeClient({}, [TestRpcInterface3]);

    // RPC transport testing
    window.location.hash = TestbedConfig.mobilePort.toString();

    const webClient = BentleyCloudRpcManager.initializeClient(TestbedConfig.cloudRpcParams, [RpcWebTransportTest]);
    webClient.protocol.pathPrefix = TestbedConfig.localServerUrlPrefix;
    RpcOperation.forEach(RpcWebTransportTest, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test", OpenMode.Readonly));

    ElectronRpcManager.initializeClient({}, [RpcElectronTransportTest]);

    RpcManager.initializeInterface(RpcDirectTransportTest);
    RpcManager.registerImpl(RpcDirectTransportTest, RpcTransportTestImpl);

    MobileRpcManager.initializeClient([RpcMobileTransportTest]);
  }

  public static initializeRpcBackend() {
    if (TestbedConfig.useDirect) {
      // N/A -- only for testing code within frontend bundle
    } else if (TestbedConfig.useIPC) {
      ElectronRpcManager.initializeImpl({}, TestbedConfig.rpcInterfaces);
    } else {
      TestbedConfig.cloudRpc = BentleyCloudRpcManager.initializeImpl(TestbedConfig.cloudRpcParams, TestbedConfig.rpcInterfaces);
      TestbedConfig.initializeBentleyCloudCommon();
    }

    ElectronRpcManager.initializeImpl({}, [TestRpcInterface3]);

    // RPC transport testing
    RpcManager.registerImpl(RpcWebTransportTest, RpcTransportTestImpl);
    RpcManager.registerImpl(RpcElectronTransportTest, RpcTransportTestImpl);
    RpcManager.registerImpl(RpcMobileTransportTest, RpcTransportTestImpl);

    BentleyCloudRpcManager.initializeImpl(TestbedConfig.cloudRpcParams, [RpcWebTransportTest]);
    ElectronRpcManager.initializeImpl({}, [RpcElectronTransportTest]);
    MobileRpcManager.initializeImpl([RpcMobileTransportTest]);
  }

  public static sendToMainSync(msg: TestbedIpcMessage) {
    return TestbedConfig.ipc.sendSync("testbed", msg);
  }

  private static initializeBentleyCloudCommon() {
    for (const definition of TestbedConfig.rpcInterfaces) {
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test", OpenMode.Readonly));
    }
  }
}

export interface TestbedIpcMessage {
  name: string;
  value: any;
}

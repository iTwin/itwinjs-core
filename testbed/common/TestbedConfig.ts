/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway, BentleyCloudGatewayConfiguration, GatewayElectronConfiguration, GatewayOperation, IModelToken } from "@bentley/imodeljs-common";
import { TestGateway } from "../common/TestGateway";

declare var ___TESTBED_IPC_RENDERER___: any;

export class TestbedConfig {
  public static gatewayParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static swaggerURI = "/v3/swagger.json";
  public static gatewayConfig: BentleyCloudGatewayConfiguration;
  public static get ipc(): any { return ___TESTBED_IPC_RENDERER___; }
  public static useIPC = false;

  public static initializeGatewayConfig() {
    const gateways = [IModelGateway, TestGateway];

    if (TestbedConfig.useIPC) {
      GatewayElectronConfiguration.initialize({}, gateways);
    } else {
      TestbedConfig.gatewayConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, gateways);

      for (const gateway of gateways) {
        GatewayOperation.forEach(gateway, (operation) => operation.policy.token = (_request) => new IModelToken("test", false, "test", "test"));
      }
    }
  }

  public static sendToMainSync(msg: TestbedIpcMessage) {
    return TestbedConfig.ipc.sendSync("testbed", msg);
  }
}

export interface TestbedIpcMessage {
  name: "pendingResponseQuota";
  value: any;
}

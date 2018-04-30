/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BentleyCloudGatewayConfiguration, GatewayElectronConfiguration, GatewayOperation, IModelToken, IModelReadGateway, IModelWriteGateway, StandaloneIModelGateway } from "@bentley/imodeljs-common";
import { IModelUnitTestGateway } from "@bentley/imodeljs-common/lib/gateway/IModelUnitTestGateway"; // not part of the "barrel"
import { TestGateway, TestGateway2, TestGateway3 } from "../common/TestGateway";

declare var ___TESTBED_IPC_RENDERER___: any;

export class TestbedConfig {
  public static gatewayParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static swaggerURI = "/v3/swagger.json";
  public static gatewayConfig: BentleyCloudGatewayConfiguration;
  public static get ipc(): any { return ___TESTBED_IPC_RENDERER___; }
  public static useIPC = false;

  public static initializeGatewayConfig() {
    const gateways = [IModelReadGateway, IModelWriteGateway, StandaloneIModelGateway, IModelUnitTestGateway, TestGateway, TestGateway2];

    if (TestbedConfig.useIPC) {
      GatewayElectronConfiguration.initialize({}, gateways);
    } else {
      TestbedConfig.gatewayConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, gateways);

      for (const gateway of gateways) {
        GatewayOperation.forEach(gateway, (operation) => operation.policy.token = (_request) => new IModelToken("test", false, "test", "test"));
      }
    }

    GatewayElectronConfiguration.initialize({}, [TestGateway3]);
  }

  public static sendToMainSync(msg: TestbedIpcMessage) {
    return TestbedConfig.ipc.sendSync("testbed", msg);
  }
}

export interface TestbedIpcMessage {
  name: string;
  value: any;
}

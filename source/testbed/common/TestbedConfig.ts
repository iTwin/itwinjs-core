/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway } from "@build/imodeljs-core/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "@build/imodeljs-core/lib/gateway/BentleyCloudGatewayConfiguration";
import { TestGateway } from "../common/TestGateway";

export class TestbedConfig {
  public static gatewayParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static swaggerURI = "/v3/swagger.json";
  public static gatewayConfig: BentleyCloudGatewayConfiguration;

  public static initializeGatewayConfig() {
    TestbedConfig.gatewayConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, [IModelGateway, TestGateway]);
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export class TestbedConfig {
  public static gatewayParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
  public static serverPort = process.env.PORT || 3000;
  public static swaggerURI = "/v3/swagger.json";
}

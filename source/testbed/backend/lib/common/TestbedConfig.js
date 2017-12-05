"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
class TestbedConfig {
}
TestbedConfig.gatewayParams = { info: { title: "imodeljs-core-testbed", version: "v1.0" } };
TestbedConfig.serverPort = process.env.PORT || 3000;
TestbedConfig.swaggerURI = "/v3/swagger.json";
exports.TestbedConfig = TestbedConfig;
//# sourceMappingURL=TestbedConfig.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const express = require("express");
const bodyParser = require("body-parser");
const IModelDb_1 = require("../../../../backend/lib/backend/IModelDb");
const IModelGateway_1 = require("../../../../backend/lib/gateway/IModelGateway");
const BentleyCloudGatewayConfiguration_1 = require("../../../../backend/lib/gateway/BentleyCloudGatewayConfiguration");
const NodeAddonRegistry_1 = require("../../../../backend/lib/backend/NodeAddonRegistry");
const TestbedConfig_1 = require("../common/TestbedConfig");
const TestGateway_1 = require("../common/TestGateway");
const TestGatewayImpl_1 = require("./TestGatewayImpl");
IModelDb_1.IModelDb; // Signal usage of IModelDb to tsc import logic
TestGatewayImpl_1.TestGatewayImpl.register();
const gatewaysConfig = BentleyCloudGatewayConfiguration_1.BentleyCloudGatewayConfiguration.initialize(TestbedConfig_1.TestbedConfig.gatewayParams, [IModelGateway_1.IModelGateway, TestGateway_1.TestGateway]);
// tslint:disable-next-line:no-var-requires
const addon = require(NodeAddonRegistry_1.NodeAddonPackageName.computeDefaultImodelNodeAddonName());
NodeAddonRegistry_1.NodeAddonRegistry.registerAddon(addon);
const app = express();
app.use(bodyParser.text());
app.get(TestbedConfig_1.TestbedConfig.swaggerURI, (req, res) => gatewaysConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
app.listen(TestbedConfig_1.TestbedConfig.serverPort);
//# sourceMappingURL=index.js.map
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires
import { IModelGateway } from "$(common)/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "$(common)/lib/gateway/BentleyCloudGatewayConfiguration";
import { TestbedConfig } from "../common/TestbedConfig";
import { TestGateway } from "../common/TestGateway";

const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, [IModelGateway, TestGateway]);
gatewaysConfig.protocol.openAPIPathPrefix = () => `http://localhost:${TestbedConfig.serverPort}`;

const remote = require("electron").remote;
remote.getCurrentWindow().setTitle(TestbedConfig.gatewayParams.info.title);
remote.require("../../../backend/lib/backend/index");

const fs = remote.require("fs");
for (const entry of fs.readdirSync(__dirname)) {
  if (entry.indexOf(".test.js") !== -1)
    require(`${__dirname}/${entry}`);
}

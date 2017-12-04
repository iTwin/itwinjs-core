/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires
import { IModelGateway } from "$(frontend)/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "$(frontend)/lib/gateway/BentleyCloudGatewayConfiguration";
import * as testbedConfig from "../config";

const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize(testbedConfig.gatewayParams, [IModelGateway]);
gatewaysConfig.protocol.openAPIPathPrefix = () => `http://localhost:${testbedConfig.serverPort}`;

const remote = require("electron").remote;
remote.getCurrentWindow().setTitle(testbedConfig.gatewayParams.info.title);
remote.require("../../../lib/backend/index");

const fs = remote.require("fs");
for (const entry of fs.readdirSync(__dirname)) {
  if (entry.indexOf(".test.js") !== -1)
    require(`${__dirname}/${entry}`);
}

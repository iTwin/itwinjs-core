/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires
import * as testbedConfig from "../config";

const remote = require("electron").remote;
remote.getCurrentWindow().setTitle(testbedConfig.gatewayParams.info.title);
remote.require("../../../lib/backend/index");

const fs = remote.require("fs");
for (const entry of fs.readdirSync(__dirname)) {
  if (entry.indexOf(".test.js") !== -1)
    require(`${__dirname}/${entry}`);
}

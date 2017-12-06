/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires
import { IModelGateway } from "@build/imodeljs-core/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "@build/imodeljs-core/lib/gateway/BentleyCloudGatewayConfiguration";
import { TestbedConfig } from "../common/TestbedConfig";
import { assert } from "chai";
import { TestData } from "./TestData";
import { TestGateway } from "../common/TestGateway";

const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, [IModelGateway, TestGateway]);
gatewaysConfig.protocol.openAPIPathPrefix = () => `http://localhost:${TestbedConfig.serverPort}`;

const remote = require("electron").remote;
remote.getCurrentWindow().setTitle(TestbedConfig.gatewayParams.info.title);
remote.require("../../../backend/lib/backend/index");

describe("Testbed", () => {
  it("Server should be accessible", (done) => {
    const info = TestbedConfig.gatewayParams.info;

    const req = new XMLHttpRequest();
    req.open("GET", `http://localhost:${TestbedConfig.serverPort}${TestbedConfig.swaggerURI}`);
    req.addEventListener("load", () => {
      assert.equal(200, req.status);
      const desc = JSON.parse(req.responseText);
      assert(desc.info.title === info.title && desc.info.version === info.version);
      done();
    });

    req.send();
  });

  it("TestData should load", async () => {
    await TestData.load();
  }).timeout(99999);
});

const fs = remote.require("fs");
for (const entry of fs.readdirSync(__dirname)) {
  if (entry.indexOf(".test.js") !== -1)
    require(`${__dirname}/${entry}`);
}

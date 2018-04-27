/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:only-arrow-functions
// tslint:disable:space-before-function-paren

// Testing order of initialization for imodeljs-frontend and imodeljs-common
import * as frontend from "@bentley/imodeljs-frontend";
frontend;

import * as common from "@bentley/imodeljs-common";
common;

import { TestbedConfig } from "../common/TestbedConfig";
import { assert } from "chai";
import { TestData } from "./TestData";

TestbedConfig.initializeGatewayConfig();
if (TestbedConfig.gatewayConfig)
  TestbedConfig.gatewayConfig.protocol.pathPrefix = `http://localhost:${TestbedConfig.serverPort}`;

after(() => {
  setTimeout(() =>  {
    common.GatewayProtocol.events.raiseEvent (common.GatewayProtocolEvent.ReleaseResources);
  }, 2000);
});

describe("Testbed", function () {
  if (TestbedConfig.gatewayConfig) {
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
  }

  it("TestData should load", async () => {
    await TestData.load();
  });
});

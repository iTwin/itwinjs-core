/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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

TestbedConfig.initializeRpcFrontend();
if (TestbedConfig.cloudRpc)
  TestbedConfig.cloudRpc.protocol.pathPrefix = TestbedConfig.localServerUrlPrefix;

describe("Testbed", function () {
  if (TestbedConfig.cloudRpc) {
    it("Server should be accessible", (done) => {
      const info = TestbedConfig.cloudRpcParams.info;

      const req = new XMLHttpRequest();
      req.open("GET", `${TestbedConfig.localServerUrlPrefix}${TestbedConfig.swaggerURI}`);
      req.addEventListener("load", () => {
        assert.equal(200, req.status);
        const desc = JSON.parse(req.responseText);
        assert(desc.info.title === info.title && desc.info.version === info.version);
        done();
      });

      req.send();
    });
  }

  it("TestData should load (#integration)", async () => {
    await TestData.load();
  });
});

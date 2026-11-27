/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";
import { installChaiAssertions } from "./testAssertions";

export { defaultOpts, deepEqualWithFpTolerance } from "./testAssertions";

installChaiAssertions();

RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;
if (!ProcessDetector.isElectronAppFrontend) {
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: `http://${window.location.hostname}:${Number(window.location.port) + 2000}`,
  };

  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);

  // This is a web-only test
  describe("Web Test Fixture", () => {
    it("Backend server should be accessible", async () => {
      const req = new XMLHttpRequest();
      req.open("GET", `${params.pathPrefix}/v3/swagger.json`);
      const loaded = new Promise((resolve) => req.addEventListener("load", resolve));
      req.send();
      await loaded;
      assert.equal(200, req.status);
      const desc = JSON.parse(req.responseText);
      assert.equal(desc.info.title, "full-stack-test");
      assert.equal(desc.info.version, "v1.0");
    });
  });
}

UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);

beforeEach(function () {
  TestUtility.beginTestCleanupScope();
});

afterEach(async function () {
  const leakError = await TestUtility.cleanupOpenIModels({ failOnLeaks: true });
  if (!leakError)
    return;

  const currentTest = this.currentTest;
  if (!currentTest)
    throw leakError;

  (currentTest as Mocha.Test & { err?: Error }).err = leakError;
  currentTest.state = "failed";
});

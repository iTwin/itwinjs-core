/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ProcessDetector } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { BentleyCloudRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/RpcInterfaces";

RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;

if (ProcessDetector.isElectronAppFrontend) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ElectronApp.startup({ iModelApp: { rpcInterfaces } });
} else {
  const config = BentleyCloudRpcManager.initializeClient({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);
  config.protocol.pathPrefix = `http://${window.location.hostname}:${Number(window.location.port) + 2000}`;

  // This is a web-only test
  describe("Web Test Fixture", () => {
    it("Backend server should be accessible", async () => {
      const req = new XMLHttpRequest();
      req.open("GET", `${config.protocol.pathPrefix}/v3/swagger.json`);
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

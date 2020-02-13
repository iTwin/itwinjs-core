/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, IModelToken, RpcOperation, RpcConfiguration } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "./common/RpcInterfaces";
import { assert } from "chai";

RpcConfiguration.developmentMode = true;

if (ElectronRpcConfiguration.isElectron) {
  ElectronRpcManager.initializeClient({}, rpcInterfaces);
} else {
  const config = BentleyCloudRpcManager.initializeClient({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);
  config.protocol.pathPrefix = `http://${window.location.hostname}:${Number(window.location.port) + 2000}`;

  for (const definition of rpcInterfaces) {
    RpcOperation.forEach(definition, (operation) => operation.policy.token = (request) => (request.findTokenPropsParameter() || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));
  }

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

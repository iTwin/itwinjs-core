/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires no-console
import { TestbedConfig } from "../common/TestbedConfig";
import { assert } from "chai";
import { TestData } from "./TestData";
import * as webpack from "webpack";
import * as path from "path";

TestbedConfig.initializeGatewayConfig();
TestbedConfig.gatewayConfig.protocol.openAPIPathPrefix = () => `http://localhost:${TestbedConfig.serverPort}`;

const { ipcRenderer, remote } = require("electron");
TestbedConfig.ipc = ipcRenderer;
remote.getCurrentWindow().setTitle(TestbedConfig.gatewayParams.info.title);
remote.require(path.join(__dirname, "../../../backend/lib/backend/index"));

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
  if (entry.indexOf(".test.js") !== -1) {
    const entryPath = `${__dirname}/${entry}`;

    describe(entry, () => {
      it("should be compatible with webpack", (done) => {
        const compiler = webpack({
          entry: entryPath, node: {
          fs: "empty",
        }});
        compiler.plugin("should-emit", () => false);
        compiler.run((err: Error, stats: webpack.Stats) => {
          if (err)
            console.error(err.stack || err);

          if (stats.hasErrors() || stats.hasWarnings()) {
            const info = stats.toJson();
            console.error(...info.errors);
            console.warn(...info.warnings);
          }

          assert.isNull(err);
          assert.isFalse(stats.hasErrors());
          assert.isFalse(stats.hasWarnings());
          done();
        });
      }).timeout(99999);
    });

    setTimeout(() => require(entryPath));
  }
}

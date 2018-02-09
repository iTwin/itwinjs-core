/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:no-var-requires no-console
import { TestbedConfig } from "../common/TestbedConfig";
import { assert } from "chai";
import { TestData } from "./TestData";
import * as webpack from "webpack";
import * as path from "path";
import { IModelJsFs } from "../../backend/IModelJsFs";

TestbedConfig.initializeGatewayConfig();
TestbedConfig.gatewayConfig.protocol.openAPIPathPrefix = () => `http://localhost:${TestbedConfig.serverPort}`;

const { ipcRenderer, remote } = require("electron");
TestbedConfig.ipc = ipcRenderer;
remote.getCurrentWindow().setTitle(TestbedConfig.gatewayParams.info.title);
remote.require(path.join(__dirname, "../backend/index"));

// tslint:disable:only-arrow-functions
// tslint:disable:space-before-function-paren
describe("Testbed", function () {
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
  });
});

for (const entry of IModelJsFs.readdirSync(__dirname)) {
  if (entry.indexOf(".test.js") !== -1 && entry.indexOf(".test.js.map") === -1) {
    const entryPath = `${__dirname}/${entry}`;

    describe(entry, function () {
      it("should be compatible with webpack", (done) => {
        const compiler = webpack({
          entry: entryPath, node: {
            fs: "empty",
          },
        });
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
      });
    });

    require(entryPath);
  }
}

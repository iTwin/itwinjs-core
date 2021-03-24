/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AppConstructorOptions, Application } from "spectron";
import { assert } from "chai";
import * as path from "path";
import * as app from "electron";
import { chrome } from "process";
import { FrustumPlanes } from "@bentley/imodeljs-common";
//import { ChromeOptions } from "electron-chromedriver";
describe("Application", function () {

  this.timeout(10000)

  beforeEach(function () {
    this.app = new Application({
      // Your electron path can be any binary
      // i.e for OSX an example path could be '/Applications/MyApp.app/Contents/MacOS/MyApp'
      // But for the sake of the example we fetch it from our node_modules.
      path: require("electron/index.js"),

      // Assuming you have the following directory structure

      //  |__ my project
      //     |__ ...
      //     |__ main.js
      //     |__ package.json
      //     |__ index.html
      //     |__ ...
      //     |__ test
      //        |__ spec.js  <- You are here! ~ Well you should be.

      // The following line tells spectron to look and use the main.js file
      // and the package.json located 1 level above.
      args: [path.join(__dirname, 'Electron.js')]
    })
    return this.app.start()
  })

  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('shows an initial window', function () {
    return this.app.client.getWindowCount().then(function (count: any) {
      assert.equal(count, 1)
      // Please note that getWindowCount() will return 2 if `dev tools` are opened.
      // assert.equal(count, 2)
    })
  })


  // let testApp: Application;
  // before(async () => {
  //   testApp = new Application({
  //     path: path.join(__dirname, "..", "..", "node_modules/.bin/electron"),
  //     args: ["app=" + path.join(__dirname, "Electron.js")],
  //     requireName: "electronRequire"
  //   });
  //   console.log("ready to await start");
  //   await testApp.start();
  // });

  // after(async () => {
  //   if (testApp && testApp.isRunning()) {
  //     return testApp.stop();
  //   } else {
  //     return testApp;
  //   }
  // });

  // it("opens window", () => {
  //   testApp.client.waitUntilWindowLoaded();
  //   return testApp.client.getWindowCount().then((count) => {
  //     // Only one window should open, note that if
  //     // dev tools are open window count will equal 2
  //     assert.equal(count, 1);
  //   });
  // });
});
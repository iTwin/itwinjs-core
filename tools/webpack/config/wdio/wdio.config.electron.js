/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const { mergeWdioConfigs } = require("../helpers");
const base = require("./wdio.config.base");
const paths = require("../paths");

// NEEDSWORK: For now, we need this monkey patch to use electron-chromedriver instead of the regular version of chromedriver...
// (Apparently the regular chromedriver used to work for electron 1.x, but now it fails to connect to the electron 2.x instance)
require.cache[require.resolve("chromedriver")] = {
  exports: { path: require.resolve("electron-chromedriver/bin/chromedriver.exe") }
};

// Extend our base config file with electron-specific settings
exports.config = mergeWdioConfigs(base.config, {
  capabilities: [{
    browserName: "chrome",
    chromeOptions: {
      binary: require.resolve("electron/dist/electron.exe"),
      args: [
        "--disable-gpu",
        `app=${paths.appBuiltMainJs}`,
      ]
    },
  }],
  beforeSuite: () => {
    // NEEDSWORK: For now, we need this monkey patch to actually allow the visual regression testing service to resize the window...
    browser.setViewportSize = (size) => {
      browser.execute((w, h) => {
        require("electron").remote.getCurrentWindow().setContentSize(w, h);
      }, size.width, size.height);
    }
  }
});

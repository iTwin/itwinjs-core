/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const { mergeWdioConfigs } = require("../helpers");
const base = require("./wdio.config.base");

// Extend our base config file with headless chrome-specific settings
exports.config = mergeWdioConfigs(base.config, {
  capabilities: [{
    browserName: "chrome",
    chromeOptions: {
      args: ["--headless", "--disable-gpu"],
    },
  }],
});

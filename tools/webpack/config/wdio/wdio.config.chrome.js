/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
var { mergeWdioConfigs } = require("../helpers");
var base = require("./wdio.config.base");

// Extend our base config file with chrome-specific settings
exports.config = mergeWdioConfigs(base.config, {
  capabilities: [{
    browserName: "chrome"
  }],
});
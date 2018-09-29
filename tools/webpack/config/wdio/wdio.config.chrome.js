/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
var { mergeWdioConfigs } = require("../helpers");
var base = require("./wdio.config.base");

// Extend our base config file with chrome-specific settings
exports.config = mergeWdioConfigs(base.config, {
  capabilities: [{
    browserName: "chrome"
  }],
});
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

var argv = require("yargs").argv;

const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const paths = require("./config/paths");
const path = require("path");
var cpx = require("cpx");

cpx.copy(path.join(paths.appTestAssets, "**", "*"), path.join(paths.appLibTests, "assets"));




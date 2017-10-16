/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const options = [
  "--excludeExternals",
  "--excludePrivate",
  "--hideGenerator",
]


const paths = require("./config/paths");
const path = require("path");

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

const args = [
  ...options,
  "--tsconfig", paths.appRoot,
  "--json", paths.appJsonDocs,
  paths.appSrc
]

spawn(path.resolve(__dirname, "../node_modules/.bin/typedoc"), args).then((code) => process.exit(code));
handleInterrupts();

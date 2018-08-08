/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;
const utils = require("./utils");

if (!yargs.changelog)
  throw new Error("Changelog file path not specified (--changelog)");

if (!yargs.name)
  throw new Error("Changelog name not specified (--name)");

utils.ensureDirectoryExists("../../out/docs/releases");

const src = path.resolve(yargs.changelog);
const dst = path.resolve("../../out/docs/releases", `${yargs.name}.md`);
fs.copyFileSync(src, dst);

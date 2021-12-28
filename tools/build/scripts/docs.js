/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

const paths = require("./config/paths");
const path = require("path");
const cpx = require("cpx2");
const fs = require("fs");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const { validateTags } = require("./utils/validateTags");
const argv = require("yargs").argv;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const source = (argv.source === undefined) ? paths.appSrc : argv.source;
const out = (argv.out === undefined) ? paths.appDocs : argv.out;
const json = (argv.json === undefined) ? paths.appJsonDocs : argv.json;

const baseUrlOptions = (argv.baseUrl === undefined) ? [] : ["--baseUrl", argv.baseUrl];
const includeOptions = (argv.includes === undefined) ? [] : ["--includes", argv.includes];

let excludeList = "**/node_modules/**/*,**/*test*/**/*";
if (argv.excludes !== undefined)
  excludeList += ",**/" + argv.excludes + "/**/*";
if (argv.excludeGlob !== undefined)
  excludeList += "," + argv.excludeGlob;

excludeList = excludeList.replace(/,/g, ',--exclude,')
const excludeArray = excludeList.split(",");
excludeArray.unshift("--exclude");

let outputOptions = [
  "--json", json
];

if (argv.onlyJson === undefined)
  outputOptions = outputOptions.concat(["--out", out]);

const readmeOption = (argv.readme === undefined) ? "none" : argv.readme;

const options = [
  "--excludePrivate",
  "--hideGenerator",
  "--logLevel",
  "Error"
];

const pluginOptions = [
  "--plugin", "typedoc-plugin-merge-modules",
  "--mergeModulesMergeMode", "module",
];

if (argv.name) options.push("--name", argv.name);

if (argv.theme) options.push("--theme", argv.theme);

const args = [
  "--entryPointStrategy", "expand", path.resolve(process.cwd(), source),
  ...options,
  ...excludeArray,
  ...outputOptions,
  "--readme", readmeOption,
  ...pluginOptions,
  ...baseUrlOptions,
  ...includeOptions
];

console.log("Arguments to TypeDoc: " + JSON.stringify(args, null, 2));

spawn(require.resolve(".bin/typedoc"), args).then((code) => {
  // Copy index.ts file to json output folder and rename to index.ts if a file is specified. Needed to add descriptions within the barrel file.
  const outputDir = path.parse(json).dir;
  if (argv.tsIndexFile) {
    cpx.copySync(path.join(source, argv.tsIndexFile), outputDir);
    fs.renameSync(path.join(outputDir, argv.tsIndexFile), path.join(outputDir, 'index.ts'));
  }
  // Copy CHANGELOG.json to json output folder
  if (fs.existsSync(path.join(process.cwd(), 'CHANGELOG.json'))) {
    cpx.copySync(path.join(process.cwd(), 'CHANGELOG.json'), outputDir);
  }

  if (code === 0) {
    let tagErrors = validateTags(json);
    if (tagErrors.toString()) {
      console.error(`JSON contains invalid tags: ${JSON.stringify(tagErrors)}`);
      fs.unlink(json);
      console.log(`JSON removed from ${json}`)
      code = 5;
    }
  }
  process.exit(code)
});
handleInterrupts();

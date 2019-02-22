/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const spawn = require('cross-spawn');
const argv = require("yargs").argv;
const fs = require("fs-extra");

if (argv.entry === undefined) {
  console.log("No argument found");
  return;
}

const isCI = (process.env.TF_BUILD);
var errorCode = 0;
const entryPointFileName = argv.entry;
const isPresentation = argv.isPresentation;

const config = {
  $schema: "https://developer.microsoft.com/json-schemas/api-extractor/api-extractor.schema.json",
  compiler: {
    configType: "tsconfig",
    rootFolder: isPresentation ? "./src" : "."
  },
  project: {
    entryPointSourceFile: isPresentation ? `../lib/${entryPointFileName}.d.ts` : `lib/${entryPointFileName}.d.ts`
  },
  policies: {
    namespaceSupport: "permissive"
  },
  validationRules: {
    missingReleaseTags: "allow"
  },
  apiJsonFile: {
    enabled: false
  },
  apiReviewFile: {
    enabled: true,
    apiReviewFolder: isPresentation ? "../../../common/api" : "../../common/api",
    tempFolder: isPresentation ? "../../../common/temp/api" : "../../common/temp/api"
  }
};

const configFileName = `lib/${entryPointFileName}.json`;
fs.writeFileSync(configFileName, JSON.stringify(config, null, 2));

const args = [
  '-c', configFileName
];
if (!isCI)
  args.push("-l");


//Temporarily re-implementing features of simple-spawn till version 7 of api-extractor is released
//Spawns a child process to run api-extractor and pipes the errors to be handled in this script
const child = spawn("api-extractor run", args)
child.stdout.on('data', (data) => {
  process.stdout.write(data);
})
child.stderr.on('data', (data) => {
  if (data.includes("You have changed the public API signature for this project.")) {
    process.stderr.write(data);
    if (isCI) {
      errorCode = 1;
    }
  }
})
child.on('error', (data) => {
  console.log(data);
});
child.on('close', (code) => {
  fs.unlinkSync(configFileName);
  fs.unlinkSync("dist/tsdoc-metadata.json");
  process.exit(errorCode);
});
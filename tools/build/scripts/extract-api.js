/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const {
  spawn,
  handleInterrupts
} = require("./utils/simpleSpawn");
const argv = require("yargs").argv;
const fs = require("fs-extra");

if (argv.entry === undefined) {
  console.log("No argument found");
  return;
}

var entryPointFileName = argv.entry;
var isPresentation = argv.isPresentation;
var configFileName = `lib/${entryPointFileName}.json`;
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
    tempFolder: isPresentation ? "../../../common/api" : "../../common/api"
  }
};

fs.writeFileSync(configFileName, JSON.stringify(config, null, 2));


spawn("api-extractor run", ['-c', configFileName]).then((code) => {
  fs.unlinkSync(configFileName);
  process.exit(0);
});
handleInterrupts();

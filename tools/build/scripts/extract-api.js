/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const argv = require("yargs").argv;
const fs = require("fs-extra");

if (argv.entry === undefined) {
  console.log("No argument found");
  return;
}

const isCI = (process.env.TF_BUILD);
const entryPointFileName = argv.entry;
const isPresentation = argv.isPresentation;
const ignoreMissingTags = argv.ignoreMissingTags;

const config = {
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
    missingReleaseTags: ignoreMissingTags ? "allow" : "error"
  },
  apiJsonFile: {
    enabled: false
  },
  apiReviewFile: {
    enabled: true,
    apiReviewFolder: isPresentation ? "../../../common/api" : "../../common/api",
    tempFolder: isPresentation ? "../../../common/temp/api" : "../../common/temp/api"
  },
  messages: {
    tsdocMessageReporting: {
      default: {
        logLevel: "none"
      }
    },
    extractorMessageReporting: {
      "ae-internal-missing-underscore": {
        addToApiReviewFile: false,
        logLevel: "none"
      }
    }
  }
};

if (!fs.existsSync("lib")) {
  process.stderr.write("lib folder not found. Run `rush build` before extract-api");
  process.exit(1);
}

const configFileName = `lib/${entryPointFileName}.json`;
fs.writeFileSync(configFileName, JSON.stringify(config, null, 2));

const args = [
  "run",
  "-c", configFileName
];
if (!isCI)
  args.push("-l");

spawn("api-extractor", args).then((code) => {
  if (fs.existsSync(configFileName))
    fs.unlinkSync(configFileName);
  process.exit(code);
});
handleInterrupts();

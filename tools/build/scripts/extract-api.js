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
  $schema: "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
  projectFolder: isPresentation ? "../src" : "../",
  compiler: {
    tsconfigFilePath: "<projectFolder>/tsconfig.json"
  },
  mainEntryPointFilePath: `${entryPointFileName}.d.ts`,
  apiReport: {
    enabled: true,
    reportFolder: "../../../common/api",
    reportTempFolder: "../../../common/temp/api"
  },
  docModel: {
    enabled: false
  },
  dtsRollup: {
    enabled: false
  },
  tsdocMetadata: {
    enabled: false
  },
  messages: {
    tsdocMessageReporting: {
      default: {
        logLevel: "none"
      }
    },
    extractorMessageReporting: {
      "ae-missing-release-tag": {
        logLevel: ignoreMissingTags ? "none" : "error",
        addToApiReportFile: true
      },
      "ae-internal-missing-underscore": {
        addToApiReportFile: false,
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

spawn(require.resolve(".bin/api-extractor"), args).then((code) => {
  if (fs.existsSync(configFileName))
    fs.unlinkSync(configFileName);
  process.exit(code);
});
handleInterrupts();

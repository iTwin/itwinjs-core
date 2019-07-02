/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const argv = require("yargs").argv;
const fs = require("fs-extra");
const path = require("path");

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
      default: {
        logLevel: "error",
        addToApiReportFile: false
      },
      "ae-incompatible-release-tags": {
        logLevel: "error",
        addToApiReportFile: false
      },
      "ae-missing-release-tag": {
        logLevel: ignoreMissingTags ? "none" : "error",
        addToApiReportFile: false
      },
      "ae-internal-missing-underscore": {
        logLevel: "none",
        addToApiReportFile: false
      },
      "ae-forgotten-export": {
        logLevel: "none",
        addToApiReportFile: false
      },
      "ae-unresolved-inheritdoc-reference": {
        logLevel: "error",
        addToApiReportFile: true
      },
      "ae-unresolved-inheritdoc-base": {
        logLevel: "error",
        addToApiReportFile: true
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

  // Only generate the extraction of the summary locally.
  if (isCI)
    process.exit(code);

  const extractSummaryArgs = [
    path.resolve(__dirname, "extract-api-summary.js"),
    "--apiSignature", path.resolve(`../../common/api/${entryPointFileName}.api.md`),
    "--outDir", path.resolve("../../common/api/summary")
  ];

  spawn("node", extractSummaryArgs).then((code) => {
    process.exit(code);
  });
});
handleInterrupts();

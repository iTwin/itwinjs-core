/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const argv = require("yargs").argv;
const fs = require("fs-extra");
const path = require("path");
const paths = require("./config/paths");

if (argv.entry === undefined) {
  console.log("No argument found");
  return;
}

function getEntryPointDirName(){
  const dirname = path.dirname(argv.entry);
  return dirname === "." ? "./lib/cjs" : dirname;
};

const isCI = (process.env.TF_BUILD);
const entryPointFileName = path.basename(argv.entry);
const entryPointDirName = getEntryPointDirName();
const ignoreMissingTags = argv.ignoreMissingTags;
const includeUnexportedApis = argv.includeUnexportedApis;

// Resolves the root of the Rush repo
const resolveRoot = relativePath => {
  // recurse until you find the "rush.json"
  const parts = paths.appSrc.split(path.sep).reverse();
  while (parts.length > 0) {
    const resolved = path.join(parts.slice().reverse().join(path.sep), "rush.json");
    if (fs.existsSync(resolved))
      return path.join(parts.slice().reverse().join(path.sep), relativePath);
    parts.shift();
  }
  process.stderr.write("Root of the Rush repository not found.  Missing a rush.json file?");
};
const rushCommon = () => {
  let resolved;
  if (!resolved)
    resolved = resolveRoot("common");
  return resolved;
};

const apiReportFolder = argv.apiReportFolder ?? path.join(rushCommon(), "/api");
const apiReportTempFolder = argv.apiReportTempFolder ?? path.join(rushCommon(), "/temp/api");
const apiSummaryFolder = argv.apiSummaryFolder ?? path.join(rushCommon(), "/api/summary");

const appDir = path.join(paths.appSrc, "..");
const projectFolder = path.relative(entryPointDirName, appDir);
const config = {
  $schema: "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
  projectFolder,
  compiler: {
    tsconfigFilePath: "<projectFolder>/tsconfig.json"
  },
  mainEntryPointFilePath: `${entryPointFileName}.d.ts`,
  apiReport: {
    enabled: true,
    reportFileName: `${entryPointFileName}.api.md`,
    reportFolder: path.resolve(apiReportFolder),
    reportTempFolder: path.resolve(apiReportTempFolder),
    includeForgottenExports: !!includeUnexportedApis,
    tagsToReport: {
      "@preview": true
    },
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

if (!fs.existsSync(entryPointDirName)) {
  process.stderr.write(`\`${entryPointDirName}\` folder not found. Build the package(s) before running \`extract-api\``);
  process.exit(1);
}

const configFileName = path.format({ dir: entryPointDirName, name: entryPointFileName, ext: ".json" });
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
    "--apiSignature", path.resolve(path.join(apiReportFolder, `${entryPointFileName}.api.md`)),
    "--outDir", path.resolve(apiSummaryFolder),
  ];

  spawn("node", extractSummaryArgs).then((code) => {
    process.exit(code);
  });

  if (process.env.GENERATE_FULL_API_REPORT)
    spawn("node", [...extractSummaryArgs, "--gatherFullReport"]).then((code) => {
      process.exit(code);
    });
});
handleInterrupts();

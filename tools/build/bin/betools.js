#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict"
const yargs = require("yargs");
var path = require("path");
var child_process = require("child_process");

yargs.strict(true)
  .wrap(Math.min(150, yargs.terminalWidth()))
  .version("2.0.0")
  .usage("Bentley Scripts Utility\n\n These scripts consist of several standard npm tasks an app may want to make use of.")
  .command("test", false, {}, () => { testCommand() })
  .command("test-tsnode", false, {}, () => { testCommand() })
  .command("docs", "Generate TypeDoc documentation by using the provided parameters to pass to TypeDoc.  Supports generating html TypeScript documentation as well as a json representation of the documentation.",
    function (yargs) {
      return yargs.options({
        "source": {
          describe: "Specify the TypeScript source directory"
        },
        "out": {
          describe: "Specify the directory of the html output"
        },
        "json": {
          describe: "Specify the directory and filename of the json output"
        },
        "baseUrl": {
          describe: "Specify a baseUrl to resolve modules"
        },
        "includes": {
          describe: "Specify a baseUrl to resolve modules"
        },
        "excludes": {
          describe: "Specify a directory, filename, or pattern to be excluded"
        },
        "excludeGlob": {
          describe: "Specify a directory, filename, or pattern to be excluded"
        },
        "testExcludeGlob": {
          describe: "Specify a directory, filename, or pattern to exclude tests. Default value: '**/*test*/**/*'"
        },
        "tsIndexFile": {
          describe: "The barrel file containing the module documentation. This file is copied to the output folder for parsing."
        },
        "onlyJson": {
          describe: "Specify a baseUrl to resolve modules"
        }
      })
    },
    (argv) => { docsCommand(argv) })
  .command("extract", "Extract sample code from test files in a specific directory",
    function (yargs) {
      return yargs.options({
        "extractFrom": {
          describe: "The path at which the sample code files are located"
        },
        "out": {
          describe: "The path at which to output the selected code"
        },
        "fileExt": {
          describe: "The extension of the files to include"
        },
        "recursive": {
          alias: "r",
          describe: "Recursively search subdirectories from"
        }
      })
    },
    (argv) => { extractCommand(argv) })
  .command("extract-api", "Extracts the API of the Typescript library starting from an entry file with a default presets. Powered by @microsoft/api-extractor (https://api-extractor.com)",
    function (yargs) {
      return yargs.options({
        "entry": {
          describe: "The main Typescript entry point for the library which is compiled to the 'main' field in the package.json"
        },
        "ignoreMissingTags": {
          describe: "Turns off the 'ae-missing-release-tag' option which returns an error when a missing release tag is detected"
        },
        "apiReportFolder": {
          describe: "Directory for the API report. Defaults to `<Rush repository root>/common/api`."
        },
        "apiReportTempFolder": {
          describe: "Directory for the API report. Defaults to `<Rush repository root>/temp/api`."
        },
        "apiSummaryFolder": {
          describe: "Directory for the API summary. Defaults to `<Rush repository root>/common/api/summary`."
        }
      })
    },
    (argv) => { extractApiCommand(argv) })
  .command("pseudolocalize", "Pseudo-localizes an english localization JSON file.",
    function (yargs) {
      return yargs.options({
        "englishDir": {
          describe: "The path to the English localization folder.  Default is `./public/locales/en`"
        },
        "out": {
          describe: "The output path to put the pseudo-localized files.  Default is `./public/locales/en-pseudo`"
        }
      })
    },
    (argv) => { pseudolocalizeCommand(argv) })
  .command("copy-assets", "copy assets from @itwin or @bentley dependencies into a destination directory",
    function (yargs) {
      return yargs.options({
        "packageJsonDir": {
          describe: "The path at which the package.json listing deps that need their assets copied can be found. defaults to '.'"
        },
        "nodeModulesDir": {
          describe: "The path to the node_modules directory where the deps that need their assets copied can be found. defaults to '.'"
        },
        "destinationDir": {
          describe: "the location to copy the assets to. defaults to './lib/assets'"
        },
      })
    },
    (argv) => { copyAssetsCommand(argv) })
  .help()
  .argv;

function testCommand(options) {
  console.error("ERROR: The test and test-tsnode commands have been removed from betools.  Please use mocha directly instead.");
  process.exit(1);
}

function getScriptPath(name) {
  return path.resolve(__dirname, path.join("..", "scripts", name));
}

function docsCommand(options) {
  const sourceOpt = options.source ? ["--source", options.source] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  const jsonOpt = options.json ? ["--json", options.json] : [];
  const baseUrlOpt = options.baseUrl ? ["--baseUrl", options.baseUrl] : [];
  const includesOpt = options.includes ? ["--includes", options.includes] : [];
  const excludesOpt = options.excludes ? ["--excludes", options.excludes] : [];
  const excludesGlobOpt = options.excludeGlob ? ["--excludeGlob", options.excludeGlob] : [];
  const testExcludeGlobOpt = options.testExcludeGlob ? ["--testExcludeGlob", options.testExcludeGlob] : [];
  const indexFileOpt = options.tsIndexFile ? ["--tsIndexFile", options.tsIndexFile] : [];
  const onlyJsonOpt = options.onlyJson ? ["--onlyJson"] : [];
  exec("node", [getScriptPath("docs.js"),
  ...sourceOpt, ...outOpt, ...jsonOpt, ...baseUrlOpt, ...includesOpt,
  ...excludesOpt, ...excludesGlobOpt, ...testExcludeGlobOpt, ...indexFileOpt, ...onlyJsonOpt]);
}

function extractCommand(options) {
  const extractOpt = options.extractFrom ? ["--extractFrom", options.extractFrom] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  const fileExt = options.fileExt ? ["--fileExt", options.fileExt] : [];
  const recursive = options.recursive ? ["--recursive"] : [];
  exec("node", [getScriptPath("extract.js"), ...extractOpt, ...outOpt, ...fileExt, ...recursive]);
}

function extractApiCommand(options) {
  const entryOpt = options.entry ? ["--entry", options.entry] : [];
  const ignoreTagsOpt = options.ignoreMissingTags ? ["--ignoreMissingTags"] : [];
  const apiReportFolderOpt = options.apiReportFolder ? ["--apiReportFolder", options.apiReportFolder] : [];
  const apiReportTempFolderOpt = options.apiReportTempFolder ? ["--apiReportTempFolder", options.apiReportTempFolder] : [];
  const apiSummaryFolderOpt = options.apiSummaryFolder ? ["--apiSummaryFolder", options.apiSummaryFolder] : [];
  exec("node", [getScriptPath("extract-api.js"), ...entryOpt, ...ignoreTagsOpt, ...apiReportFolderOpt, ...apiReportTempFolderOpt, ...apiSummaryFolderOpt]);
}

function pseudolocalizeCommand(options) {
  const englishDir = options.englishDir ? ["--englishDir", options.englishDir] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  exec("node", [getScriptPath("pseudolocalize"), ...englishDir, ...outOpt]);
}

function copyAssetsCommand(options) {
  const packageJsonDir = options.packageJsonDir ? ["--packageJsonDir", options.packageJsonDir] : [];
  const nodeModulesDir = options.nodeModulesDir ? ["--nodeModulesDir", options.nodeModulesDir] : [];
  const destinationDir = options.destinationDir ? ["--destinationDir", options.destinationDir] : [];
  exec("node", [path.resolve(__dirname, "../scripts/copy-assets.js"), ...packageJsonDir, ...nodeModulesDir, ...destinationDir]);
}

function exec(cmd, args) {
  console.log("Running command:");
  console.log(`${cmd} ${args.join(' ')}`);
  try {
    return child_process.execFileSync(cmd, args, { encoding: "utf8", stdio: 'inherit' });
  } catch (error) {
    if (error.status)
      process.exit(error.status);
    throw error;
  }
}

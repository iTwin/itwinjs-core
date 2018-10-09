#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

var program = require("commander");
var path = require("path");
var child_process = require("child_process");

program
  .version("0.1.0")
  .description("Bentley NPM Scripts Utility\n\n These scripts consist of several standard npm tasks your app may want to make use of.");

program
  .command("test")
  .description("Run mocha tests on the current repository")
  .option("--packageRoot [packageRoot]", "The root of the package to locate the Mocha bin")
  .option("--testDir [testDir]", "The location of the test directory")
  .option("--watch", "adds the --watch and --inline-diffs parameters to the Mocha command")
  .option("--debug", "adds the --inspect=9229 and --debug-brk paramters to the Mocha command")
  .action(function (options) { testCommand(options) });

program
  .command("test-tsnode")
  .description("Run the ts-node version of the Mocha tests (NOTE: This may fail when running code coverage due to a behavior within Istanbul. If this occurs, you should run the script directly with Node)")
  .option("--packageRoot [packageRoot]", "The root of the package to locate the Mocha bin")
  .option("--testDir [testDir]", "The location of the test directory")
  .option("--watch", "adds the --watch and --inline-diffs parameters to the Mocha command")
  .option("--debug", "adds the --inspect=9229 and --debug-brk paramters to the Mocha command")
  .option("--tscPaths", "adds the --require tsconfig-paths/register arguments to the Mocha command")
  .action(function (options) { testTsNodeCommand(options) });

program
  .command("docs")
  .description("Generate TypeDoc documentation")
  .option("--source [sourcePath]", "specify the TypeScript source directory")
  .option("--out [outPath]", "specify the directory of the html output")
  .option("--json [jsonPath]", "specify the directory and filename of the json output")
  .option("--baseUrl [baseUrl]", "specify a baseUrl to resolve modules")
  .option("--onlyJson", "specify a baseUrl to resolve modules")
  .option("--includes [includes]", "specify a baseUrl to resolve modules")
  .option("--excludes [excludes]", "specify a directory, filename, or pattern to be excluded")
  .action(function (options) { docsCommmand(options) });

program
  .command("printconfig")
  .description("Print the full configuration of a .json config file")
  .option("--config [configFile]", "The configuration file to investigate")
  .option("--out [outFile]", "The output location of the merged file (optional)")
  .action(function (options) { printConfigCommand(options); });

program
  .command("extract")
  .description("Extract sample code from test files in a specific directory")
  .option("--extractFrom [extractPath]", "the path at which the sample code files are located")
  .option("--out [outPath]", "the path at which to output the selected code")
  .action(function (options) { extractCommand(options); });

program.parse(process.argv);

if (!process.argv.slice(2).length)
  program.outputHelp();

function testCommand(options) {
  const rootOpt = options.packageRoot ? ["--packageRoot", options.packageRoot] : [];
  const testDirOpt = options.testDir ? ["--testDir", options.testDir] : [];
  const watchOpt = options.watch ? ["--watch"] : [];
  const debugOpt = options.debug ? ["--debug"] : [];
  exec(["node", path.resolve(__dirname, "../scripts/test.js"), ...rootOpt, ...testDirOpt, ...watchOpt, ...debugOpt]);
}

function testTsNodeCommand(options) {
  const rootOpt = options.packageRoot ? ["--packageRoot", options.packageRoot] : [];
  const testDirOpt = options.testDir ? ["--testDir", options.testDir] : [];
  const watchOpt = options.watch ? ["--watch"] : [];
  const debugOpt = options.debug ? ["--debug"] : [];
  const tscPathsOpt = options.tscPaths ? ["--tscPaths"] : [];
  exec(["node", path.resolve(__dirname, "../scripts/test-tsnode.js"), ...rootOpt, ...testDirOpt, ...watchOpt, ...debugOpt, ...tscPathsOpt]);
}

function docsCommmand(options) {
  const sourceOpt = options.source ? ["--source", options.source] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  const jsonOpt = options.json ? ["--json", options.json] : [];
  const baseUrlOpt = options.baseUrl ? ["--baseUrl", options.baseUrl] : [];
  const onlyJsonOpt = options.onlyJson ? ["--onlyJson"] : [];
  const includesOpt = options.includes ? ["--includes", options.includes] : [];
  const excludesOpt = options.excludes ? ["--excludes", options.excludes] : [];
  exec(["node", path.resolve(__dirname, "../scripts/docs.js"), ...sourceOpt, ...outOpt, ...jsonOpt, ...baseUrlOpt, ...onlyJsonOpt, ...includesOpt, ...excludesOpt]);
}

function printConfigCommand(options) {
  const configOpt = options.config ? ["--config", options.config] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  exec(["node", path.resolve(__dirname, "../scripts/printconfig.js"), ...configOpt, ...outOpt]);
}

function extractCommand(options) {
  const extractOpt = options.extractDir ? ["--extractDir", options.extractDir] : [];
  const outOpt = options.outDir ? ["--outDir", options.outdir] : [];
  exec(["node", path.resolve(__dirname, "../scripts/extract.js"), ...extractOpt, ...outOpt]);
}

function exec(cmd) {
  console.log("Running command:");
  console.log(cmd.join(" "));
  return child_process.execSync(cmd.join(" "), { encoding: "utf8", stdio: 'inherit' });
}
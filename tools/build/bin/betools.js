#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
  .option("--packageRoot [packageRoot]", "The root of the package to locate the Mocha bin.  Default is 'process.cwd()'.")
  .option("--testDir [testDir]", "The location of the test directory containing .js files. Default is './lib/test'.")
  .option("--watch", "Adds the --watch and --inline-diffs parameters to the Mocha command.")
  .option("--debug", "Adds the --inspect=9229 and --debug-brk parameters to the Mocha command.")
  .option("--defineWindow", "Adds the `--require jsdom-global/register` to the Mocha command.  Use if a window is needed for compilation.")
  .option("--opts [opts path]", "Adds the provided opts file to mocha using --opts.  See mocha docs for priority order, https://mochajs.org/api/module-lib_cli_options.html#.loadMochaOpts.")
  .option("--timeout [timeout]", "Overrides the default timeout passed to Mocha.  Default is 999999.")
  .option("--grep [pattern]", "Add the grep pattern to Mocha.")
  .option("--invert", "Adds the --invert option to Mocha, only if '--grep' is provided too.")
  .action((options) => testCommand(options));

program
  .command("test-tsnode")
  .description("Run the ts-node version of the Mocha tests (NOTE: This may fail when running code coverage due to a behavior within Istanbul. If this occurs, you should run the script directly with Node)")
  .option("--packageRoot [packageRoot]", "The root of the package to locate the Mocha bin")
  .option("--testDir [testDir]", "The location of the test directory")
  .option("--watch", "Adds the --watch and --inline-diffs parameters to the Mocha command")
  .option("--debug", "Adds the --inspect=9229 and --debug-brk paramters to the Mocha command")
  .option("--tscPaths", "Adds the --require tsconfig-paths/register arguments to the Mocha command")
  .action((options) => testTsNodeCommand(options));

program
  .command("docs")
  .description("Generate TypeDoc documentation by using the provided parameters to pass to TypeDoc.  Supports generating html TypeScript documentation as well as a json representation of the documentation.")
  .option("--source [sourcePath]", "Specify the TypeScript source directory")
  .option("--out [outPath]", "Specify the directory of the html output")
  .option("--json [jsonPath]", "Specify the directory and filename of the json output")
  .option("--baseUrl [baseUrl]", "Specify a baseUrl to resolve modules")
  .option("--onlyJson", "Specify a baseUrl to resolve modules")
  .option("--includes [includes]", "Specify a baseUrl to resolve modules")
  .option("--excludes [excludes]", "Specify a directory, filename, or pattern to be excluded")
  .action((options) => docsCommmand(options));

program
  .command("extract")
  .description("Extract sample code from test files in a specific directory")
  .option("--extractFrom [extractPath]", "The path at which the sample code files are located")
  .option("--out [outPath]", "The path at which to output the selected code")
  .option("--fileExt [fileExt]", "The extension of the files to include ")
  .option("-r, --recurisve", "Recursively search subdirectories from ")
  .action((options) => extractCommand(options));

program
  .command("pseudolocalize")
  .description("Psuedolocalizes an english localization JSON file.")
  .option("--englishDir [englishPath]", "The path to the English localization folder.  Default is `./public/locales/en`")
  .option("--out [outPath]", "The output path to put the pseudolocalized files.  Default is `./public/locales/en-pseudo`")
  .action((options) => pseudolocalizeCommand(options));

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

function extractCommand(options) {
  const extractOpt = options.extractDir ? ["--extractDir", options.extractDir] : [];
  const outOpt = options.outDir ? ["--outDir", options.outdir] : [];
  const fileExt = options.fileExt ? ["--fileExt", options.fileExt] : [];
  const recurisve = options.recurisve ? ["--recursive"] : [];
  exec(["node", path.resolve(__dirname, "../scripts/extract.js"), ...extractOpt, ...outOpt, ...fileExt, ...recurisve]);
}

function pseudolocalizeCommand(options) {
  const englishDir = options.englishDir ? ["--pseudolocalize", options.englishDir] : [];
  const outOpt = options.out ? ["--out", options.out] : [];
  exec(["node", path.resolve(__dirname, "../scripts/pseudolocalize"), ...englishDir, ...outOpt]);
}

function exec(cmd) {
  console.log("Running command:");
  console.log(cmd.join(" "));
  return child_process.execSync(cmd.join(" "), { encoding: "utf8", stdio: 'inherit' });
}
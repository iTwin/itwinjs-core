/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const chalk = require("chalk");
const {
  spawn,
  handleInterrupts
} = require("@itwin/build-tools/scripts/utils/simpleSpawn");

exports.command = "start";
exports.describe = chalk.bold("Runs the app's backend in development mode.");
exports.builder = (yargs) =>
  yargs.options({
    "source": {
      alias: "s",
      type: "string",
      describe: "The main entrypoint for webpack."
    },
    "outDir": {
      alias: "o",
      type: "string",
      describe: "The directory where bundle should be emitted."
    },
    "electron": {
      alias: "e",
      type: "boolean",
      describe: `Launch the output bundle with electron.`
    },
    "node": {
      alias: "n",
      type: "boolean",
      describe: `Launch the output bundle with node.`
    },
    "execArgs": {
      type: "string",
      describe: `Additional arguments to be passed to node (or electron).`
    },
  })
    .demandOption(["source", "outDir"]);

exports.handler = async (argv) => {
  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("development");

  const { getWebpackConfig } = require("../config/getWebpackConfig");
  const { watchBackend } = require("./utils/webpackWrappers");

  const execArgs = (argv.execArgs) ? argv.execArgs.spit(" ") : [];
  const outDir = path.resolve(process.cwd(), argv.outDir);
  const sourceFile = path.resolve(process.cwd(), argv.source);
  const outFile = path.join(outDir, path.basename(sourceFile));

  // Run a webpack watch to compile/re-compile the backend bundle.
  await watchBackend(getWebpackConfig(sourceFile, outDir, false)); // Resolves on first successful build.
  const args = [];
  const names = [];
  const colors = [];
  const quote = (s) => `"${s}"`;

  if (argv.node) {
    args.push(["node", require.resolve("nodemon/bin/nodemon"), "--max-http-header-size=16000", "--no-colors", "--watch", outFile, ...execArgs, outFile]);
    names.push("node");
    colors.push("cyan");
  }

  if (argv.electron) {
    args.push(["node", require.resolve("nodemon/bin/nodemon"), "--max-http-header-size=16000", "--no-colors", "--watch", outFile, "node_modules/electron/cli.js", ...execArgs, outFile]);
    names.push("electron");
    colors.push("magenta");
  }

  if (args.length > 0) {
    spawn("node", [
      require.resolve("concurrently"),
      ...args.map((a) => quote(a.join(" "))),
      "--color", "-c", colors.join(","),
      "--names", names.join(",")
    ]);
  }
};

// This is required to correctly handle SIGINT on windows.
handleInterrupts();
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");
exports.command = "build <target>";
exports.describe = chalk.bold("Runs a production build.");
exports.builder = (yargs) =>
  yargs.strict(true)
    .positional("target", {
      choices: ["electron", "web"],
      describe: `The target environment.`,
      type: "string"
    })
    .options({
      "frontend": {
        alias: "F",
        describe: "Only build the FRONTEND bundle",
        conflicts: "backend"
      },
      "backend": {
        alias: "B",
        describe: "Only build the BACKEND bundle",
        conflicts: "frontend"
      },
    });

exports.handler = async (argv) => {

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("production");

  const buildTarget = argv.target

  if ("electron" === buildTarget)
    process.env.ELECTRON_ENV = "production";

  const path = require("path");
  const fs = require("fs-extra");
  const webpack = require("webpack");
  const checkRequiredFiles = require("react-dev-utils/checkRequiredFiles");
  const formatWebpackMessages = require("react-dev-utils/formatWebpackMessages");
  const printHostingInstructions = require("react-dev-utils/printHostingInstructions");
  const { measureFileSizesBeforeBuild, printFileSizesAfterBuild } = require("react-dev-utils/FileSizeReporter");
  const { buildFrontend, buildBackend, saveJsonStats } = require("./utils/webpackWrappers");

  const paths = require("../config/paths");
  const frontendConfig = require("../config/webpack.config.frontend.prod");
  const backendConfig = require("../config/webpack.config.backend.prod");
  const statDumpPromises = [];

  const skipBackend = Boolean(argv.frontend);
  const skipFrontend = Boolean(argv.backend);

  async function prepFrontendBuild() {
    if (skipFrontend)
      return;

    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    const previousFileSizes = await measureFileSizesBeforeBuild(paths.appLibPublic);

    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    await fs.emptyDir(paths.appLibPublic);

    // Merge with the public folder
    await fs.copy(paths.appPublic, paths.appLibPublic, {
      dereference: true,
      filter: file => file !== paths.appHtml,
    });

    return previousFileSizes;
  }

  // Warn and crash if required files are missing
  if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs, paths.appMainJs])) {
    process.exit(1);
  }

  // This can take a while, so get it started while we build the backend.
  const prepFrontendPromise = prepFrontendBuild();

  // Start the webpack backend build
  if (!skipBackend) {
    const stats = await buildBackend(backendConfig);
    statDumpPromises.push(saveJsonStats(stats, paths.appBackendStats));
  }

  // _Now_ we need those previousFileSizes ready.
  const previousFileSizes = await prepFrontendPromise;
  console.groupEnd();
  console.log();

  // Now, start the webpack frontend build
  if (!skipFrontend) {
    const stats = await buildFrontend(frontendConfig);
    statDumpPromises.push(saveJsonStats(stats, paths.appFrontendStats));

    // These sizes are pretty large. We'll warn for bundles exceeding them.
    const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
    const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

    console.groupEnd();
    console.log("\nFile sizes after gzip:\n");
    printFileSizesAfterBuild(
      stats,
      previousFileSizes,
      paths.appLibPublic,
      WARN_AFTER_BUNDLE_GZIP_SIZE,
      WARN_AFTER_CHUNK_GZIP_SIZE
    );
    console.log();

    if (buildTarget === "web") {
      console.log(`The project's web frontend was built assuming it is located at ${chalk.green(frontendConfig.output.publicPath)}.`);
      console.log(`This can be configured via the ${chalk.green("homepage")} field of your ${chalk.cyan("package.json")}.` + "\n");
    }
  }

  if (buildTarget === "web") {
    console.log(`The ${chalk.cyan("lib")} folder is ready to be deployed.`);
  } else {
    console.log(`The built electron app can now be run with ${chalk.cyan("npm run electron")}.`);
  }

  const statsPaths = await Promise.all(statDumpPromises);
  if (statsPaths.length > 0) {
    console.log();
    console.log(`Detailed ${chalk.yellow("webpack stats files")} are available at:`);
    for (const statsPath of statsPaths) {
      console.log(`   ${chalk.bold(path.relative(process.cwd(), statsPath))}`);
    }

    console.log();
    console.log(chalk.italic(`You can explore webpack statistics with tools like:`));
    console.log(`   ${chalk.bold("Webpack Analyse:")} ${chalk.underline(chalk.cyan("http://webpack.github.io/analyse/"))}`);
    console.log(`   ${chalk.bold("Webpack Visualizer:")} ${chalk.underline(chalk.cyan("https://chrisbateman.github.io/webpack-visualizer/"))}`);
  }

  process.exit();
};

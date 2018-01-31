/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");

exports.command = "build <target>";
exports.describe = chalk.bold("Runs a production build.");
exports.builder = (yargs) =>
  yargs.positional("target", {
    choices: ["electron", "web"],
    describe: `The target environment.`,
    type: "string"
  })
  .options({
    "only": {
      type: "string",
      alias: "o",
      choices: ["frontend", "backend"],
      describe: "only build a particular bundle"
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
  const FileSizeReporter = require("react-dev-utils/FileSizeReporter");
  const { buildFrontend, buildBackend } = require("./utils/buildBackend");

  const paths = require("../config/paths");
  const frontendConfig = require("../config/webpack.config.frontend.prod");
  const backendConfig = require("../config/webpack.config.backend.prod");

  async function runBuild(name, callback) {
    const startTime = Date.now();
    console.log(`${chalk.inverse(" " + name + " ")} Starting build...`);
    await callback();  
    const elapsed = Date.now() - startTime;
    console.log(`${chalk.inverse(" " + name + " ")} Build completed successfully in ${chalk.green(elapsed.toLocaleString() + " ms")}`);
    console.log();
  }

  function copyPublicFolder() {
    fs.copySync(paths.appPublic, paths.appLibPublic, {
      dereference: true,
      filter: file => file !== paths.appHtml,
    });
  }

  const measureFileSizesBeforeBuild = FileSizeReporter.measureFileSizesBeforeBuild;
  const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;

  // These sizes are pretty large. We'll warn for bundles exceeding them.
  const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
  const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

  // Warn and crash if required files are missing
  if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs, paths.appMainJs])) {
    process.exit(1);
  }

  // First, read the current file sizes in build directory.
  // This lets us display how much they changed later.
  const previousFileSizes = await measureFileSizesBeforeBuild(paths.appLibPublic);

  // Remove all content but keep the directory so that
  // if you're in it, you don't end up in Trash
  fs.emptyDirSync(paths.appLibPublic);

  // Merge with the public folder
  copyPublicFolder();

  
  // Start the webpack backend build
  if (argv.only !== "frontend") {
    await runBuild("BACKEND", async () => buildBackend(backendConfig));
  }

  // Now, start the webpack frontend build
  if (argv.only !== "backend") {
    await runBuild("FRONTEND", async () => {
      
      console.log(chalk.dim("\nCreating an optimized production build..."));
      const stats = await buildFrontend(frontendConfig);

      console.log('File sizes after gzip:\n');
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
    });
  }

  if (buildTarget === "web") {
    console.log(`The ${chalk.cyan("lib")} folder is ready to be deployed.`);
  } else {
    console.log(`The built electron app can now be run with ${chalk.cyan("npm run electron")}.`);      
  }
};

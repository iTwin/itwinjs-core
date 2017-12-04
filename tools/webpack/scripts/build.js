/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const chalk = require('chalk');
const buildTarget = getBuildTarget();
if (!buildTarget) {
  process.exit(1);
}

if ("electron" === buildTarget)
  process.env.ELECTRON_ENV = 'production';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

const path = require('path');
const fs = require('fs-extra');
const webpack = require('webpack');
const config = require('../config/webpack.config.frontend');
const paths = require('../config/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printHostingInstructions = require('react-dev-utils/printHostingInstructions');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');

function getBuildTarget() {
  if (process.argv.length < 4) {
    console.log(chalk.red("Not enough arguments. Usage: \n"));
    console.log(`    imodeljs-react-scripts build ${chalk.yellow("(")}${chalk.green("web")}${chalk.yellow("|")}${chalk.green("electron")}${chalk.yellow(")")}`);
    console.log();
    return false;
  }

  const target = process.argv[3].toLowerCase();
  if (target === "web" || target === "electron")
    return target;

  console.log(chalk.red("Unknown target.\n"));
  console.log(`Supported targets are: ${chalk.green("web")} or ${chalk.green("electron")}`);
  return false;
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

const frontendStartTime = Date.now();

// First, read the current file sizes in build directory.
// This lets us display how much they changed later.
measureFileSizesBeforeBuild(paths.appLibPublic)
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(paths.appLibPublic);
    // Merge with the public folder
    copyPublicFolder();
    // Start the webpack build
    return build(previousFileSizes);
  })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

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
        console.log(`The project's web frontend was built assuming it is located at ${chalk.green(config.output.publicPath)}.`);
        console.log(`This can be configured via the ${chalk.green("homepage")} field of your ${chalk.cyan("package.json")}.` + "\n");
      }

      const elapsed = Date.now() - frontendStartTime;
      console.log(`${chalk.inverse(" FRONTEND ")} Build completed successfully in ${chalk.green(elapsed + "ms")}`);

    },
    err => {
      console.log(chalk.red('Failed to compile.\n'));
      console.log((err.message || err) + '\n');
      process.exit(1);
    }
  )
  .then(async () => {
    console.log();
    const backendStartTime = Date.now();
    console.log(`${chalk.inverse(" BACKEND ")} Starting build...`);
    console.log();
    
    const electronConfig = require('../config/webpack.config.backend');
    const buildBackend = require('./utils/buildBackend');
    await buildBackend(electronConfig);
    
    const elapsed = Date.now() - backendStartTime;
    console.log();
    console.log(`${chalk.inverse(" BACKEND ")} Build completed successfully in ${chalk.green(elapsed + "ms")}`);
    console.log();

    if (buildTarget === "web") {      
      console.log(`The ${chalk.cyan("lib")} folder is ready to be deployed.`);
    } else {
      console.log(`The built electron app can now be run with ${chalk.cyan("npm run electron")}.`);      
    }
  });

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
       
  console.log(`${chalk.inverse(" FRONTEND ")} Starting build...`);
  console.log(chalk.dim("\nCreating an optimized production build..."));

  let compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err);
      }
      const messages = formatWebpackMessages(stats.toJson({}, true));
      if (messages.errors.length) {
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }
      return resolve({
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      });
    });
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appLibPublic, {
    dereference: true,
    filter: file => file !== paths.appHtml,
  });
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");
exports.command = "build";
exports.describe = chalk.bold(
  `Runs a production webpack build. This means bundling JavaScript and copying "external" modules to the output directory.`
);
exports.builder = (yargs) =>
  yargs
    .strict(true)
    .options({
      source: {
        alias: "s",
        type: "string",
        describe: "The main entrypoint for webpack.",
      },
      outDir: {
        alias: "o",
        type: "string",
        describe: "The directory where bundle should be emitted.",
      },
      sourceMap: {
        type: "boolean",
        describe: "Create sourcemaps for bundle.",
      },
      profile: {
        type: "boolean",
        describe: "Enable webpack profiling and output stats files for analyzing bundle.",
      },
    })
    .demandOption(["source", "outDir"]);

exports.handler = async (argv) => {
  if (!argv.sourceMap) process.env.DISABLE_SOURCE_MAPS = true;

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("production");

  const path = require("path");
  const { buildBackend, saveJsonStats } = require("./utils/webpackWrappers");
  const { getWebpackConfig } = require("../config/getWebpackConfig");

  const outDir = path.resolve(process.cwd(), argv.outDir);
  const sourceFile = path.resolve(process.cwd(), argv.source);

  // Start the webpack backend build
  const stats = await buildBackend(getWebpackConfig(sourceFile, outDir, argv.profile));

  console.groupEnd();
  console.log();
  console.log(`The ${chalk.cyan(path.basename(outDir))} folder is ready to be deployed.`);

  if (argv.profile) {
    const statsPath = path.join(outDir, path.basename(sourceFile, ".js")) + ".stats.json";
    await saveJsonStats(stats, statsPath);
    console.log();
    console.log(`A detailed ${chalk.yellow("webpack stats file")} is available at:`);
    console.log(`   ${chalk.bold(path.relative(process.cwd(), statsPath))}`);
    console.log();
    console.log(chalk.italic(`You can explore webpack statistics with tools like:`));
    console.log(
      `   ${chalk.bold("Webpack Analyse:")} ${chalk.underline(chalk.cyan("http://webpack.github.io/analyse/"))}`
    );
    console.log(
      `   ${chalk.bold("Webpack Visualizer:")} ${chalk.underline(
        chalk.cyan("https://chrisbateman.github.io/webpack-visualizer/")
      )}`
    );
  }

  process.exit();
};

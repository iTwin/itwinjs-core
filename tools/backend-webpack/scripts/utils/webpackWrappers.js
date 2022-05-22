/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs-extra");
const webpack = require("webpack");
const chalk = require("chalk");
const { PrettyLoggingPlugin } = require("@itwin/core-webpack-tools");

function createCompiler(webpack, config, name, description, onSuccess = function () { }) {
  try {
    config.plugins.push(new PrettyLoggingPlugin(name, description, onSuccess));
    compiler = webpack(config);
  } catch (err) {
    console.log(`${chalk.red.inverse(name)} ${chalk.bold.red("Failed to configure webpack.\n")}`);
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }
  return compiler;
}

async function watchBackend(config) {
  await new Promise((resolve, reject) => {
    const compiler = createCompiler(webpack, config, ` BACKEND `, "Starting development build...", resolve);
    compiler.watch({}, (err, stats) => {
      if (err) {
        reject(err);
      }
    });
  });
}

function runWebpackAsync(compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => (err) ? reject(err) : resolve(stats))
  });
}

async function runWebpackBuild(config, name) {
  const compiler = createCompiler(webpack, config, ` ${name} `, "Starting build...");
  const stats = await runWebpackAsync(compiler);
  return stats;
}

function buildBackend(config) {
  return runWebpackBuild(config, "BACKEND");
}

async function saveJsonStats(stats, outputPath) {
  await fs.writeFile(outputPath, JSON.stringify(stats.toJson({ all: true })));
  return outputPath;
}

module.exports = {
  buildBackend,
  watchBackend,
  saveJsonStats,
};
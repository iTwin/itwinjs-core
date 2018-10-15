/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const webpack = require("webpack");
const chalk = require("chalk");
const formatWebpackMessages = require("react-dev-utils/formatWebpackMessages");
const clearConsole = require("react-dev-utils/clearConsole");

const delims = chalk.inverse(".").split(".");
const delims2 = chalk.underline.red(".").split(".");
const fixWarningColors = (w) => w.replace(delims[0], delims2[0]).replace(delims[1], delims2[1]);

class BentleyWebpackLoggingPlugin {
  constructor(name, startMessage, onSuccess) {
    this.name = name;
    this.isRebuild = false;
    this.startMessage = startMessage;
    this.startTime = Date.now();
    this.successCount = 0;
    this.onSuccess = onSuccess || function () { };
  }

  get isInteractive() { return process.stdout.isTTY && this.isWatch; }

  clearIfInteractive() {
    if (this.isInteractive)
      clearConsole();
  };

  printHeading(message, color, elapsed) {
    if (this.grouped)
      console.groupEnd();

    const newline = (this.isInteractive) ? "\n" : "";

    const myChalk = (color) ? chalk[color] : chalk;
    if (elapsed)
      console.log(`${newline + myChalk.inverse(this.name)} ${myChalk.bold(message) + chalk.gray("   (in " + elapsed.toLocaleString() + " ms)") + newline}`);
    else
      console.log(`${newline + myChalk.inverse(this.name)} ${myChalk.bold(message) + newline}`);

    console.group();
    this.grouped = true;
  }

  // Reformats warnings and errors with react-dev-utils.
  handleWarningsAndErrors(elapsed, stats) {
    const { errors, warnings } = formatWebpackMessages(stats.toJson({}, true));
    if (errors.length)
      throw new Error(errors.join("\n\n"));

    if (CONTINUOUS_INTEGRATION && warnings.length) {
      if (process.env.CI)
        console.log(chalk.yellow(`\nTreating warnings as errors because process.env.CI is set.\nMost CI servers set it automatically.\n`));
      else
        console.log(chalk.yellow(`\nTreating warnings as errors because process.env.TF_BUILD is set.\nTFS sets this automatically.\n`));

      throw new Error(warnings.join("\n\n"));
    }

    if (warnings.length) {
      if (this.isInteractive)
        this.printHeading("Compiled with warnings", "yellow", elapsed);
      console.log(warnings.map(fixWarningColors).join("\n\n"));
      console.log(`\nSearch for the ${chalk.underline(chalk.yellow("keywords"))} to learn more about tslint warnings.`);
      console.log(`To ignore a tslint warning, add ${chalk.cyan("// tslint-disable-next-line")} to the line before.\n`);
      if (!this.isInteractive)
        this.printHeading("Compiled with warnings", "yellow", elapsed);
      return false;
    }

    return true;
  }

  apply(compiler) {
    compiler.hooks.entryOption.tap("BentleyWebpackLoggingPlugin", () => {
      this.printHeading(this.startMessage);
    });

    compiler.hooks.watchRun.tap("BentleyWebpackLoggingPlugin", () => {
      this.isWatch = true;
      this.startTime = Date.now();
    });

    compiler.hooks.invalid.tap("BentleyWebpackLoggingPlugin", () => {
      this.isRebuild = true;
      this.startTime = Date.now();
      this.clearIfInteractive();
      this.printHeading("Files changed, rebuilding...");
    });

    compiler.hooks.done.tap("BentleyWebpackLoggingPlugin", (stats) => {
      this.clearIfInteractive();
      const elapsed = Date.now() - this.startTime;

      let isSuccessful;
      try {
        isSuccessful = this.handleWarningsAndErrors(elapsed, stats);
      } catch (err) {
        if (!this.isInteractive)
          this.printHeading("Failed to compile", "red", elapsed);
        isSuccessful = false;
        console.log();
        console.log(err.message || err);
        console.log();
        if (!this.isInteractive)
          this.printHeading("Failed to compile", "red", elapsed);
        if (!this.isWatch)
          throw err;
      }

      if (isSuccessful) {
        const build = (this.isRebuild) ? "Rebuild" : "Build";
        this.printHeading(build + " completed successfully!", "green", elapsed);
        this.successCount++;
        this.onSuccess(this.successCount);
      }
    });
  }
}

function printFrontendInstructions(appName, urls) {
  console.log();
  console.log(`You can now view the ${chalk.bold(appName)} frontend in the browser.`);
  console.log();

  if (urls.lanUrlForTerminal) {
    console.log(`  ${chalk.bold('Local:')}            ${urls.localUrlForTerminal}`);
    console.log(`  ${chalk.bold('On Your Network:')}  ${urls.lanUrlForTerminal}`);
  } else {
    console.log(`  ${urls.localUrlForTerminal}`);
  }

  console.log();
  console.log('Note that the development build is not optimized.');
  console.log(`To create a production build, use ` + chalk.cyan(`npm run build`));
  console.log();
}


function createCompiler(webpack, config, name, description, onSuccess = function () { }) {
  try {
    config.plugins.push(new BentleyWebpackLoggingPlugin(name, description, onSuccess));
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

module.exports = {
  printFrontendInstructions,
  createCompiler,
}
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const chalk = require("chalk");
const formatWebpackMessages = require("react-dev-utils/formatWebpackMessages");

const delims = chalk.inverse(".").split(".");
const delims2 = chalk.underline.red(".").split(".");
const fixWarningColors = (w) => w.replace(delims[0], delims2[0]).replace(delims[1], delims2[1]);

const formatter = (stats) => {
  const { errors, warnings } = formatWebpackMessages(stats);
  return { errors, warnings: warnings.map(fixWarningColors) };
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
    config.plugins.push(new BentleyWebpackLoggingPlugin(name, description, onSuccess, formatter));
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
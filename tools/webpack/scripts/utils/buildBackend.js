/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require('fs');
const path = require('path');
const paths = require('../../config/paths');
const webpack = require('webpack');
const chalk = require('chalk');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');

function runWebpackAsync(compiler) {
  return new Promise((resolve, reject) => { 
    compiler.run((err, stats) => (err) ? reject(err) : resolve(stats))
  });
}

// Reformats warnings and errors with react-dev-utils.
function handleWarningsAndErrors(stats) {
  const { errors, warnings } = formatWebpackMessages(stats.toJson({}, true));
  if (errors.length)
    throw new Error(errors.join('\n\n'));

  if (CONTINUOUS_INTEGRATION && warnings.length) {
    if (process.env.CI)
      console.log(chalk.yellow(`\nTreating warnings as errors because process.env.CI is set.\nMost CI servers set it automatically.\n`));
    else
      console.log(chalk.yellow(`\nTreating warnings as errors because process.env.TF_BUILD is set.\nTFS sets this automatically.\n`));

    throw new Error(warnings.join('\n\n'));
  }

  if (warnings.length) {
    console.log();
    console.log(chalk.yellow('Compiled with warnings.\n'));
    console.log(warnings.join('\n\n'));
    console.log(`\nSearch for the ${chalk.underline(chalk.yellow('keywords'))} to learn more about each warning.`);
    console.log(`To ignore, add ${chalk.cyan('// tslint-disable-next-line')} to the line before.\n`);
  }
}

// Creates the frontend production build and print the deployment instructions.
async function runWebpackBuild(config, name) {
  const compiler = webpack(config);

  try {
    const stats = await runWebpackAsync(compiler);
    handleWarningsAndErrors(stats);
    return stats;
  } catch (err) {    
    console.log(`${chalk.red.inverse(" " + name.toUpperCase() + " ")} Failed to compile.`);
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }
}

function buildBackend(config) {
  return runWebpackBuild(config, "BACKEND");
}

function buildFrontend(config) {
  return runWebpackBuild(config, "FRONTEND");
}

module.exports = {
  buildBackend,
  buildFrontend,
}
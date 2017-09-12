/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const webpack = require('webpack');
const chalk = require('chalk');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');

function buildElectron(config) {
  let compiler;
  try {
    compiler = webpack(config);
  } catch (err) {
    console.log(chalk.red('Failed to compile electron/server-side backend.'));
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }
  
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        throw err;
      }
      
      // Reformat warnings and errors with react-dev-utils.
      const messages = formatWebpackMessages(stats.toJson({}, true));
      const isSuccessful = !messages.errors.length && !messages.warnings.length;
      if (isSuccessful) {
        console.log(chalk.green('Electron/server-side backend compiled successfully!'));
      }
      
      // If errors exist, only show errors.
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        console.log(chalk.red('Failed to compile electron/server-side backend.\n'));
        console.log(messages.errors.join('\n\n'));
        return;
      }
      
      // Show warnings if no errors were found.
      if (messages.warnings.length) {
        console.log(chalk.yellow('Compiled electron/server-side backend with warnings.\n'));
        console.log(messages.warnings.join('\n\n'));
      }
      
      resolve();
    });
  });
}

module.exports = buildElectron;
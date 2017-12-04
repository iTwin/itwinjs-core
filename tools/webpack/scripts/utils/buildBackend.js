/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require('fs');
const path = require('path');
const paths = require('../../config/paths');
const webpack = require('webpack');
const chalk = require('chalk');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');

function buildBackend(config) {
  
  // Link the backend node_modules into the lib directory so electron can resolve imports
  if (!fs.existsSync(paths.appLib))
    fs.mkdirSync(paths.appLib)
  if (!fs.existsSync(path.resolve(paths.appLib, "node_modules/")))
    fs.symlinkSync(paths.appBackendNodeModules, path.resolve(paths.appLib, "node_modules/"), "dir");

  let compiler;
  try {
    compiler = webpack(config);
  } catch (err) {
    console.log(chalk.red('Failed to compile backend.'));
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
      
      // If errors exist, only show errors.
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        console.log(chalk.red('Failed to compile backend.\n'));
        console.log(messages.errors.join('\n\n'));
        return;
      }
      
      // Show warnings if no errors were found.
      if (messages.warnings.length) {
        console.log(chalk.yellow('Compiled backend with warnings.\n'));
        console.log(messages.warnings.join('\n\n'));
      }
      
      resolve();
    });
  });
}

module.exports = buildBackend;
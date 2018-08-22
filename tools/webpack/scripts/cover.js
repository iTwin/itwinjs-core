/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");

exports.command = "cover";
exports.describe = chalk.bold("Launches the test runner in code coverage reporting mode.");
exports.builder = require("./test").builder;
exports.handler = (argv) => {

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("test", "coverage");

  const path = require("path");
  const paths = require("../config/paths");
  const openBrowser = require("react-dev-utils/openBrowser");
  const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

  (async () => {
    const forwardedArgs = process.argv.slice(3);
    const nycrcPath = path.relative(process.cwd(), require.resolve("../config/.nycrc"));
    const reportDir = (argv.subdirectory) ? path.join(paths.appCoverage, argv.subdirectory) : paths.appCoverage;

    // Start the tests
    const args = [
      "--nycrc-path", nycrcPath,
      "--report-dir", reportDir,
      "node",
      path.resolve(__dirname, "..", "bin", "bentley-webpack-tools.js"),
      "test",
      ...forwardedArgs
    ];
    const code = await spawn(require.resolve(".bin/nyc"), args);

    // If coverage run was successful, print where to find the coverage reports
    if (code === 0) {
      const appLcovReport = path.resolve(reportDir, "lcov-report/index.html");
      const appCoberturaReport = path.resolve(reportDir, "cobertura-coverage.xml");

      let url = appLcovReport.replace(/\\/g, "/");
      url = encodeURI((url.startsWith("/") ? "file://" : "file:///") + url);

      console.log();
      console.log(`You can view a detailed ${chalk.cyan("LCOV Report")} at:   ${chalk.bold(path.relative(process.cwd(), appLcovReport))}`);
      console.log(`You can also find a ${chalk.cyan("Cobertura Report")} at:  ${chalk.bold(path.relative(process.cwd(), appCoberturaReport))}`);

      if (!CONTINUOUS_INTEGRATION) {
        openBrowser(url);
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    process.exit(code);
  })();

  handleInterrupts();
};

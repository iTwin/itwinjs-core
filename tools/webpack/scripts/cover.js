/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
require("./utils/initialize")("test", "coverage");

const chalk = require('chalk');
const path = require("path");
const paths = require("../config/paths");
const openBrowser = require('react-dev-utils/openBrowser');
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

(async () => {
  // Some additional options are required for CI builds
  const reporterOptions = (!CONTINUOUS_INTEGRATION) ? [] : [
    "--reporter=cobertura"
  ];

  // Start the tests
  const args = [
    "--reporter=lcov",
    "--reporter=text-summary",
    ...reporterOptions,
    "imodeljs-react-scripts",
    "test",
  ];
  const code = await spawn(require.resolve(".bin/nyc"), args);
  
  // If coverage run was successful, print where to find the coverage reports
  if (code === 0) {
    let url = paths.appLcovReport.replace(/\\/g, "/");
    url = encodeURI((url.startsWith("/") ? "file://" : "file:///") + url);
    
    console.log();
    console.log(`You can view a detailed ${chalk.cyan("LCOV Report")} at:   ${chalk.bold(path.relative(process.cwd(), paths.appLcovReport))}`);

    if (CONTINUOUS_INTEGRATION) {
      console.log(`You can also find a ${chalk.cyan("Cobertura Report")} at:  ${chalk.bold(path.relative(process.cwd(), paths.appCoberturaReport))}`);
    } else {
      openBrowser(url);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  
  process.exit(code);
})();

handleInterrupts();

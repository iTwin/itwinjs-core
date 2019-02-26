/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// This script is used to ignore arguments. It is needed because the "rush build" command passes the
// same arguments to the build scripts in all the packages. When we want to pass arguments to buildIModelJsModule,
// we must have a way of "absorbing" the arguments so they don't cause problems. This script is put at the end
// of the build instructions.
const yargs = require("yargs");

// Get the arguments using the ubiquitous yargs package.
function getArgs() {
    const args = yargs
        .option("verbose", {
            alias: "v"
        })
        .option("detail", {
            alias: "d",
            type: "number",
        })
        .help().argv;
    return args;
}

cmdLineArgs = getArgs();
if (cmdLineArgs.verbose || cmdLineArgs.detail > 2)
    console.log("ignoring these arguments", cmdLineArgs);
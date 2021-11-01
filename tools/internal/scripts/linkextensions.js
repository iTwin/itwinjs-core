/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const fs = require("fs");

exports.command = "linkExtensions";
exports.builder = (yargs) =>
  yargs.strict(true)
    .options({
      "extension": {
        alias: "e",
        type: "array",
        describe: "Extension to be symlinked/copied.",
      },
      "testApp": {
        alias: "t",
        describe: "Directory of the test-app.",
        type: "array",
        default: process.cwd()
      },
    })
    .demandOption(["extension", "testApp"]);

exports.handler = async (argv) => {
  const rootDir = __dirname.split("tools")[0];

  //go through every testApp specified in the arguments
  for (let testApp of argv.testApp) {

    //get path to test-app directories
    const destRoot = path.resolve(rootDir, "test-apps", testApp)
    if (!fs.existsSync(destRoot)) {
      console.log(`Cannot find the root directory of the destination: ${destRoot}`)
      return;
    }

    //check if './build/imjs_extensions' exists
    const extensionDirectory = path.join(destRoot, "build", "imjs_extensions");
    if (!fs.existsSync(extensionDirectory)) {
      fs.mkdirSync(extensionDirectory);
    }

    //symlink extensions
    for (let extension of argv.extension) {
      const buildDir = path.resolve(rootDir, "extensions", extension, "lib", "extension");
      if (!fs.existsSync(buildDir)) {
        console.log(`Cannot find the target path: ${buildDir}`)
      }
      const outDir = path.resolve(extensionDirectory, extension);
      if (fs.existsSync(outDir)) {
        console.log(`  Extension ${outDir} is already installed to ${extensionDirectory}`);
        return;
      }
      fs.symlinkSync(buildDir, outDir, "junction");
    }
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const fs = require("fs");

exports.command = "copy-config";
exports.builder = (yargs) =>
  yargs.strict(true)
    .options({
      "out": {
        alias: "o",
        describe: "Directory of the output.",
        type: "array",
        default: process.cwd()
      },
    })

exports.handler = async (argv) => {
  const rootDir = __dirname.split("tools")[0];
  let lastIndex = rootDir.lastIndexOf(path.sep + "imodeljs");
  let pathDir = rootDir.substring(0, lastIndex + 1);
  const configDir = path.resolve(pathDir, "imodeljs-config");
  const envFile = path.resolve(configDir, ".env");

  if (!fs.existsSync(configDir) || !fs.existsSync(envFile)) {
    console.log("Missing either imodeljs-config directory or .env file");
    return;
  }

  for (let destination of argv.out) {
    const destRoot = path.resolve(rootDir, "test-apps", destination)
    if (!fs.existsSync(destRoot)) {
      console.log(`Cannot find the root directory of the destination: ${destRoot}`)
      return;
    }

    // copy '.env' file
    fs.copyFile(envFile, path.resolve(destRoot, ".env"), (error) => {
      if (error) throw error;
      console.log(`Copied '${envFile}' to '${destRoot}`)
    })
  }
}

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

  let envFile = process.env.IMJS_CONFIG_FILE ? process.env.IMJS_CONFIG_FILE : "";

  if (!envFile) {
    const lastIndex = rootDir.lastIndexOf(path.sep + "imodeljs");
    const pathDir = rootDir.substring(0, lastIndex + 1);
    const configDir = path.resolve(pathDir, "imodeljs-config");
    envFile = path.resolve(configDir, ".env");
  }

  if (!fs.existsSync(envFile)) {
    console.log(`The ${envFile} path does not exist.`);
    return;
  }

  for (const destination of argv.out) {
    const destRoot = path.resolve(rootDir, destination)
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

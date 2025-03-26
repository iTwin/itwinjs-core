/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const fs = require("fs");

exports.command = "create-cjs-package-json";
exports.builder = (yargs) =>
  yargs.strict(true)
    .options({
      "out": {
        alias: "o",
        describe: "Directory of the output `package.json` file.",
        type: "string",
        default: process.cwd()
      },
    })

exports.handler = async (argv) => {
  fs.mkdirSync(argv.out, { recursive: true });
  const packageJsonPath = path.join(argv.out, "package.json");

  try {
    fs.writeFileSync(packageJsonPath, '{ "type": "commonjs" }', {});
  } catch (e) {
    console.error(`Cannot create "${packageJsonPath}": `, e);
  }
}

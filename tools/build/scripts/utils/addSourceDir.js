/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const FS = require("fs-extra");
const path = require("path");

// We cannot guarantee the folder structure of a project
// so find the project root using rush env variable if available.
const rootPackageJson = process.env.RUSHSTACK_FILE_ERROR_BASE_FOLDER
  ? path.join(process.env.RUSHSTACK_FILE_ERROR_BASE_FOLDER, "package.json")
  : "../../../../package.json"

// Check if path to root package.json is valid.
const rootPackageJsonPath = require.resolve(rootPackageJson);

// Appends the directory of the package root to the Typedoc JSON output
function addSourceDir(file, directory) {
  if (FS.existsSync(file) && FS.statSync(file).isFile()) {
    const contents = FS.readFileSync(file, "utf-8");
    const pathToRootFolder = path.dirname(rootPackageJsonPath);
    const packageRoot = directory.substring(pathToRootFolder.length + 1);
    const jsonContents = JSON.parse(contents);
    jsonContents["packageRoot"] = packageRoot.endsWith("src")
      ? packageRoot
      : `${packageRoot}\\${"src"}`;
    FS.writeFileSync(file, Buffer.from(JSON.stringify(jsonContents, null, 2)));
  }
}

module.exports = {
  addSourceDir,
};

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const FS = require("fs-extra");
const path = require("path");

// We cannot guarantee the folder structure of a project
// so find the project root using environment variables if available, starting with NODE_PROJECT, then RUSHSTACK.
const rootPackageJson = path.join(
  process.env.NODE_PROJECT_ROOT_DIRECTORY ||
    process.env.RUSHSTACK_FILE_ERROR_BASE_FOLDER ||
    "../../../../",
  "package.json"
);

// Check if path to root package.json is valid.
const rootPackageJsonPath = require.resolve(rootPackageJson);

//Find the package.json of the project and retrieve the version and repository URL
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(FS.readFileSync(packageJsonPath));
const version = packageJson.version;
const repositoryUrl = packageJson.repository?.url;
const repositoryDirectory = packageJson.repository?.directory;

if (!version || !repositoryUrl || !repositoryDirectory) {
  throw new Error("version or repository info not found in package.json");
}

// Appends the directory of the package root to the Typedoc JSON output
function addPackageMetadata(file, directory) {
  if (FS.existsSync(file) && FS.statSync(file).isFile()) {
    const contents = FS.readFileSync(file, "utf-8");
    const pathToRootFolder = path.dirname(rootPackageJsonPath);
    const packageRoot = directory.substring(pathToRootFolder.length + 1);
    const jsonContents = JSON.parse(contents);

    jsonContents["packageRoot"] = packageRoot.endsWith("src")
      ? packageRoot
      : `${packageRoot}\\${"src"}`;
    jsonContents["version"] = version;
    jsonContents["repositoryUrl"] = repositoryUrl;
    jsonContents["repositoryDirectory"] = repositoryDirectory;

    FS.writeFileSync(file, Buffer.from(JSON.stringify(jsonContents, null, 2)));
  }
}

module.exports = {
  addPackageMetadata,
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
1. Creates a staging-directory for the docs build
2. Copies the folders from itwinjs-core/docs and itwinjs-core/generated-docs.
3. Provides the ability for users to give an absolute path
4. Provides the ability to modify the default path (itwinjs-core/staging-docs) through CLI arguments
Usage: node copyReferenceFilesToStaging.js staging-docs-directory.
*/
const path = require('path');
const process = require('process');
const childProcess = require("child_process");
const options = {
  encoding: "utf8"
};

let fse;
try {
  fse = require("fs-extra");
} catch (err) {
  console.log("Please check that fs-extra is installed");
  return console.error(err);
}

let basePath;
try {
  basePath = childProcess.execSync("git rev-parse --show-toplevel", options);
  basePath = basePath.split("\n").join("");
} catch (err) {
  console.log("Could not get the root directory");
  return console.error(err);
}

let dest;
if (process.argv[2]) {
  dest = path.resolve(basePath, process.argv[2]);
} else {
  dest = path.resolve(basePath, "staging-docs");
}

try {
  fse.ensureDirSync(path.resolve(dest, "extract"));
} catch (err) {
  console.log("Could not create staging directory structure");
  console.error(err);
}

//copy docs
try {
  const referencePath = path.resolve(dest, "reference");
  const extractPath = path.resolve(dest, "extract");
  const folderList = ["core", "domains", "editor", "presentation", "ui"];

  fse.copySync(path.resolve(basePath, "docs"), dest);
  fse.copySync(path.resolve(basePath, "generated-docs", "extract"), extractPath);

  folderList.forEach(folder => {
    fse.copySync(path.resolve(basePath, "generated-docs", folder), referencePath);
  })

  console.log("Copying finished successfully");
} catch (err) {
  console.log("Error while copying reference files to staging");
  console.error(err);
}

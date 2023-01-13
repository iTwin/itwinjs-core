/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*
This script does the following:
1. Creates a staging-directory for the docs build
2. Copies the folders from itwinjs-core/docs and itwinjs-core/generated-docs.
3. Provides the ability for users to give an absolute path
4. Provides the ability to modify the default path (itwinjs-core/staging-docs) through CLI arguments
For example: node copyReferenceFilesToStaging.js itwinjs-core/core/test-staging-directory.
*/
let fse;
try {
  fse = require("fs-extra");
} catch (err) {
  console.log("Please check that fs-extra is installed");
  return console.error(err);
}
const path = require('path');
const process = require('process');

const basePath = path.resolve(__dirname, "..", "..", "..");
let dest;

if (process.argv[2]) {
  dest = process.argv[2];
} else {
  dest = "itwinjs-core/staging-docs";
}

try {
  fse.ensureDirSync(path.resolve(basePath, dest, "extract"));
} catch (err) {
  console.log("Could not create staging directory structure");
  console.error(err);
}

copyDocs();

function copyDocs() {

  const docsPath = path.resolve(basePath, dest);
  const referencePath = path.resolve(basePath, dest, "reference");
  const extractPath = path.resolve(basePath, dest, "extract");
  const folderList = ["core", "domains", "editor", "presentation", "ui"];

  try {
    fse.copySync(path.resolve(basePath, "itwinjs-core", "docs"), docsPath);
    fse.copySync(path.resolve(basePath, "itwinjs-core", "generated-docs", "extract"), extractPath);

    folderList.forEach(folder => {
      fse.copySync(path.resolve(basePath, "itwinjs-core", "generated-docs", folder), referencePath);
    })

    console.log("Copying finished sucessfully");
  } catch (err) {
    console.error(err);
  }
}

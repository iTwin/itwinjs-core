/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*
This script creates a staging-directory for the docs build and copies the folders from itwinjs-core/docs and itwinjs-core/generated-docs.
The default location of this staging directory is itwinjs-core/staging-docs but can be modified by the user through CLI arguments
For example: node copyReferenceFilesToStaging.js itwinjs-core/core/test-staging-directory.
The user can also provide an absolute path.
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
let dest;
const basePath = path.resolve(__dirname, "..", "..", "..");
if (process.argv[2]) {
  dest = process.argv[2];
} else {
  dest = "itwinjs-core/staging-docs";
}
fse.mkdir(path.resolve(basePath, dest), (err) => {
  if (err) {
    return console.error(err);
  }
  console.log("Staging directory created successfully");
  fse.mkdir(path.resolve(basePath, dest, "extract"), (err) => {
    if (err) {
      return console.error(err);
    }
    console.log("Extract folder created successfully");
    copyDocs();
  });
});
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
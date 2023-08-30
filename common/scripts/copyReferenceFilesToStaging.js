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
const fs = require("fs/promises");
const path = require("path");
const process = require("process");
const childProcess = require("child_process");
const options = {
  encoding: "utf8",
};

async function copyFilesToStaging() {
  let basePath = childProcess.execSync(
    "git rev-parse --show-toplevel",
    options
  );

  basePath = basePath.split("\n").join("");

  const dest = path.resolve(basePath, process.argv[2] ?? "staging-docs");
  await fs.mkdir(path.resolve(dest, "extract"), { recursive: true }); // avoid rejection on existing dir

  const referencePath = path.resolve(dest, "reference");
  const extractPath = path.resolve(dest, "extract");
  const folderList = ["core", "domains", "editor", "presentation", "ui"];

  await fs.cp(path.resolve(basePath, "docs"), dest, { recursive: true });
  await fs.cp(
    path.resolve(basePath, "generated-docs", "extract"),
    extractPath,
    { recursive: true }
  );

  for (const folder of folderList) {
    await fs.cp(
      path.resolve(basePath, "generated-docs", folder),
      referencePath,
      { recursive: true }
    );
  }

  console.log("Copying finished successfully");
}

copyFilesToStaging().then(() => {
  console.log("Copy finished successfully");
});

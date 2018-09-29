/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");

const cwdRequire = (id) => {
  return require(path.join(process.cwd(), "node_modules", id));
};

const ensureDirectoryExists = (directoryPath) => {
  const createDirs = [];
  let currDir = directoryPath;
  while (!fs.existsSync(currDir)) {
    createDirs.push(currDir);
    currDir = path.resolve(currDir, "../");
  }
  createDirs.reverse().forEach((dir) => fs.mkdirSync(dir));
};

module.exports = {
  cwdRequire,
  ensureDirectoryExists,
}

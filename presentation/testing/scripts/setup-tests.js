/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const chai = require("chai");
const chaiJestSnapshot = require("chai-jest-snapshot");

// Fix node's module loader to strip ?sprite from SVG imports
const m = require("module");
const origLoader = m._load;
m._load = (request, parent, isMain) => {
  return origLoader(request.replace("?sprite", ""), parent, isMain);
};

chai.use(chaiJestSnapshot);

beforeEach(function () {
  const sourceFilePath = this.currentTest.file.replace("lib\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";

  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(this.currentTest.fullTitle());
});

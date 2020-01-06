/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const chai = require("chai");
const chaiJestSnapshot = require("chai-jest-snapshot");

chai.use(chaiJestSnapshot);

beforeEach(function () {
  const sourceFilePath = this.currentTest.file.replace("lib\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";

  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(this.currentTest.fullTitle());
});

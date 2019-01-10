/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const chai = require("chai");
const chaiJestSnapshot = require("chai-jest-snapshot");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);

beforeEach(function () {
  const sourceFilePath = this.currentTest.file.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";

  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(this.currentTest.fullTitle());
});

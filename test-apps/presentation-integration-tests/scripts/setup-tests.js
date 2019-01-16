/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const chai = require("chai");
const faker = require("faker");
const chaiJestSnapshot = require("chai-jest-snapshot");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);

faker.seed(1);

beforeEach(function () {
  const currentTest = this.currentTest;

  // we want snapshot tests to use the same random data between runs
  let seed = 0;
  for (let i = 0; i < currentTest.fullTitle().length; ++i)
    seed += currentTest.fullTitle().charCodeAt(i);
  faker.seed(seed);

  const sourceFilePath = this.currentTest.file.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

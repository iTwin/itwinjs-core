/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const faker = require("faker");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const sinonChai = require("sinon-chai");
const sinon = require("sinon");

faker.seed(1);

// setup chai
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(sinonChai);

before(function () {
  chaiJestSnapshot.resetSnapshotRegistry();
});
after(function () {
  delete require.cache[__filename];
});
beforeEach(function () {
  const currentTest = this.currentTest;

  // we want snapshot tests to use the same random data between runs
  let seed = 0;
  for (let i = 0; i < currentTest.fullTitle().length; ++i)
    seed += currentTest.fullTitle().charCodeAt(i);
  faker.seed(seed);

  // set up snapshot name
  const testFilePath = currentTest.file;
  const sourceFilePath = currentTest.file.replace("lib\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});
beforeEach(() => {
  sinon.restore();
});

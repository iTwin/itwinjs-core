/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const faker = require("faker");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const spies = require("chai-spies");
const sms = require("source-map-support");

faker.seed(1);

// setup chai
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(spies);

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
  const sourceFilePath = sms.mapSourcePosition({
    source: testFilePath,
    line: 3,
    column: 1,
  }).source;
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});
beforeEach(() => {
  chai.spy.restore();
});

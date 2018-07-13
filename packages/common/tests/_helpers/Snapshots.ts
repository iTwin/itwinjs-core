/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import faker = require("faker");
import { mapSourcePosition } from "source-map-support";

// tslint:disable-next-line:no-var-requires
const chaiJestSnapshot = require("chai-jest-snapshot");

faker.seed(1);
chai.use(chaiJestSnapshot);

// tslint:disable-next-line:only-arrow-functions
before(function() {
  chaiJestSnapshot.resetSnapshotRegistry();
});

// tslint:disable-next-line:only-arrow-functions
beforeEach(function() {
  const currentTest = this.currentTest;

  // we want snapshot tests to use the same random data between runs
  let seed = 0;
  for (let i = 0; i < currentTest.fullTitle().length; ++i)
    seed += currentTest.fullTitle().charCodeAt(i);
  faker.seed(seed);

  // set up snapshot name
  const testFilePath: string = (currentTest as any).file;
  const sourceFilePath = getSourceFilePath(testFilePath);
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

const getSourceFilePath = (executedFilePath: string): string => {
  return mapSourcePosition({
    source: executedFilePath,
    line: 3,
    column: 1,
  }).source;
};

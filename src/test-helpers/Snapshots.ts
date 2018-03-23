/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as path from "path";
import * as faker from "faker";

// note: this is a hack to work around badly exported chaiJestSnapshot
// import chaiJestSnapshotR = require("chai-jest-snapshot");
// const chaiJestSnapshot = chaiJestSnapshotR as any;
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
  const testFilePath = path.parse((currentTest as any).file);
  const fixedDir = testFilePath.dir.split("\\").join("/");
  const dir = fixedDir.split("lib/").join("");
  const fileName = testFilePath.name + ".ts.snap";
  const snapPath = path.resolve(dir, fileName);
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

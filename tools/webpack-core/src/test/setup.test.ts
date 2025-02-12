/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiJestSnapshot from "chai-jest-snapshot";

chai.use(chaiJestSnapshot);

before(function () {
  chaiJestSnapshot.resetSnapshotRegistry();
});

beforeEach(function () {
  const currentTest = (this as any).currentTest;
  const sourceFilePath = currentTest.file.replace("lib\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = `${sourceFilePath}.snap`;
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

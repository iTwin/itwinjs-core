/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const chai = require("chai");
const faker = require("faker");
const chaiJestSnapshot = require("chai-jest-snapshot");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const chaiSubset = require("chai-subset");
const jsdom = require("jsdom");

console.log(`Backend PID: ${process.pid}`);

// Do not log JSDOM errors into console
require("jsdom-global")(undefined, {
  virtualConsole: new jsdom.VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),
});

chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.use(chaiSubset);

faker.seed(1);

beforeEach(function () {
  const currentTest = this.currentTest;

  // we want snapshot tests to use the same random data between runs
  let seed = 0;
  for (let i = 0; i < currentTest.fullTitle().length; ++i) {
    seed += currentTest.fullTitle().charCodeAt(i);
  }
  faker.seed(seed);

  const sourceFilePath = this.currentTest.file.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());
});

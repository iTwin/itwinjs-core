/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// A workaround to react-testing-library {dom-testing-library {wait-for-expect}} breaking somewhere,
// because somewhere (most likely in jsdom) window.Date becomes undefined.
// Similar issue mentioned in https://github.com/vuejs/vue-test-utils/issues/936
require('jsdom-global')();
window.Date = Date;

const { JSDOM } = require('jsdom');
global.DOMParser = new JSDOM().window.DOMParser;

const chai = require("chai");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const enzyme = require("enzyme/build");
const spies = require("chai-spies");

// setup enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("enzyme-adapter-react-16/build"))() });
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));

// setup chai
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(spies);
chai.use(sinonChai);
try {
  chai.use(require("chai-string"));
} catch (e) { }

before(function () {
  chaiJestSnapshot.resetSnapshotRegistry();
});

after(function () {
  delete require.cache[__filename];
});

beforeEach(function () {
  const currentTest = this.currentTest;

  try {
    // we want snapshot tests to use the same random data between runs
    const faker = require("faker");
    let seed = 0;
    for (let i = 0; i < currentTest.fullTitle().length; ++i)
      seed += currentTest.fullTitle().charCodeAt(i);
    faker.seed(seed);
  } catch (e) {
    // may throw if package doesn't use faker - ignore
  }

  // set up snapshot name
  const testFilePath = currentTest.file;
  const sourceFilePath = currentTest.file.replace("lib\\test", "src\\test").replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());

  chai.spy.restore();
});

afterEach(() => {
  try {
    const rtl = require("react-testing-library");
    rtl.cleanup();
  } catch (e) { }
});

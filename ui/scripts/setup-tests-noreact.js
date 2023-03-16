/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");

// A workaround to @testing-library/react {@testing-library/dom {wait-for-expect}} breaking somewhere,
// because somewhere (most likely in jsdom) window.Date becomes undefined.
// Similar issue mentioned in https://github.com/vuejs/vue-test-utils/issues/936
require('jsdom-global')();
window.Date = Date;
document.elementFromPoint = () => null;
window.HTMLElement.prototype.scrollIntoView = () => { };

// Fill in more missing functions left out by jsdom or mocha
performance = window.performance;

// See https://github.com/jsdom/jsdom/issues/2527
global.PointerEvent = global.MouseEvent;
global.WheelEvent = global.MouseEvent;

// See https://github.com/jsdom/jsdom/pull/2926
global.DOMRect = class DOMRect {
  constructor(x, y, width, height) {
    this.x = x || 0;
    this.y = y || 0;
    this.width = width || 0;
    this.height = height || 0;
    this.top = this.y;
    this.left = this.x;
    this.right = this.x + this.width;
    this.bottom = this.y + this.height;
  }
  toJSON() {
    return { ...this }
  }
};
global.DOMRect.fromRect = function (rect) {
  return new DOMRect(rect.x, rect.y, rect.width, rect.height);
};

const { JSDOM } = require('jsdom');
global.DOMParser = new JSDOM().window.DOMParser;

const chai = require("chai");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const spies = require("chai-spies");

// Fix node's module loader to strip ?sprite from SVG imports
const m = require("module");
const origLoader = m._load;
m._load = (request, parent, isMain) => {
  return origLoader(request.replace("?sprite", ""), parent, isMain);
};

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
  const sourceFilePath = currentTest.file.replace(path.join("lib", "cjs", "test"), path.join("src", "test")).replace(/\.(jsx?|tsx?)$/, "");
  const snapPath = sourceFilePath + ".snap";
  chaiJestSnapshot.setFilename(snapPath);
  chaiJestSnapshot.setTestName(currentTest.fullTitle());

  chai.spy.restore();
});

afterEach(async () => {
  try {
    const sinon = require("sinon");
    sinon.restore();
  } catch (e) { }
});

// This is required by our I18n module (specifically the i18next-http-backend package).
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

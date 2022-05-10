/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Node 15+ using MessageChannel prevents node.js process from exiting
// This becomes an issue when testing React code within JSDOM environment, as the test process cannot exit properly.
// https://github.com/facebook/react/issues/20756
const commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
if (commonjsGlobal.MessageChannel)
  delete commonjsGlobal.MessageChannel;

const chai = require("chai");
const faker = require("faker");
const chaiJestSnapshot = require("chai-jest-snapshot");
const chaiAsPromised = require("chai-as-promised");
const jsdom = require("jsdom");

console.log(`Backend PID: ${process.pid}`);

// Do not log JSDOM errors into console
require("jsdom-global")(undefined, {
  virtualConsole: (new jsdom.VirtualConsole()).sendTo(console, { omitJSDOMErrors: true }),
});

// Fix node's module loader to strip ?sprite from SVG imports
const m = require("module");
const origLoader = m._load;
m._load = (request, parent, isMain) => {
  return origLoader(request.replace("?sprite", ""), parent, isMain);
};

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

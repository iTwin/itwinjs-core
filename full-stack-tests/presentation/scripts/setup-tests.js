/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const chai = require("chai");
const cpx = require("cpx2");
const faker = require("faker");
const fs = require("fs");
const chaiJestSnapshot = require("chai-jest-snapshot");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const chaiSubset = require("chai-subset");
const jsdom = require("jsdom");
const sourceMapSupport = require("source-map-support");
const path = require("path");

console.log(`Backend PID: ${process.pid}`);

// see https://github.com/babel/babel/issues/4605
sourceMapSupport.install({
  environment: "node",
});

// FIXME: This goes against jsdom best practices. https://github.com/jsdom/jsdom/wiki/Don%27t-stuff-jsdom-globals-onto-the-Node-global
globalThis.window = new jsdom.JSDOM().window;

chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.use(chaiSubset);

faker.seed(1);

// Set up assets
cpx.copySync(`assets/**/*`, "lib/assets");
cpx.copySync(`public/**/*`, "lib/public");
copyITwinBackendAssets("lib/assets");
copyITwinFrontendAssets("lib/public");
function copyITwinBackendAssets(outputDir) {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "cjs", "assets");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
      cpx.copySync(`${src}/**/*`, outputDir);
    });
}
function copyITwinFrontendAssets(outputDir) {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "public");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
      cpx.copySync(`${src}/**/*`, outputDir);
    });
}

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

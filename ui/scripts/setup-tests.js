/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const chai = require("chai");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const chaiJestSnapshot = require("chai-jest-snapshot");
const enzyme = require("enzyme/build");
const spies = require("chai-spies");
const sms = require("source-map-support");

// setup enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("enzyme-adapter-react-16/build"))() });
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));

// setup chai
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiJestSnapshot);
chai.use(spies);
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

const shouldRecurseIntoDirectory = (directoryPath) => {
  return fs.lstatSync(directoryPath).isDirectory()
    && directoryPath !== "lib"
    && directoryPath !== "node_modules";
};
const requireLibModules = (dir) => {
  const files = fs.readdirSync(dir);
  files.map((fileName) => path.join(dir, fileName)).filter(shouldRecurseIntoDirectory).forEach((filePath) => {
    requireLibModules(filePath);
  });
  files.filter((fileName) => {
    return [".ts", ".tsx"].some((ext) => fileName.endsWith(ext) && !fileName.endsWith(".test" + ext));
  }).forEach((fileName) => {
    const requirePath = path.resolve(dir, path.basename(fileName));
    require(requirePath);
  });
};
requireLibModules(path.resolve(process.cwd(), "src"));

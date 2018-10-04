/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");

const cwdRequire = (id) => {
  return require(path.join(process.cwd(), "node_modules", id));
};

const ensureDirectoryExists = (directoryPath) => {
  const createDirs = [];
  let currDir = directoryPath;
  while (!fs.existsSync(currDir)) {
    createDirs.push(currDir);
    currDir = path.resolve(currDir, "../");
  }
  createDirs.reverse().forEach((dir) => fs.mkdirSync(dir));
};

// Get rid of React warning.
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
};

// Configure enzyme (testing utils for React)
const enzyme = cwdRequire("enzyme");
const Adapter = require("enzyme-adapter-react-16");
enzyme.configure({ adapter: new Adapter() });

// Register should style
const chai = cwdRequire("chai");
chai.should();

// Use sinon-chai style
const sinonChai = cwdRequire("sinon-chai");
chai.use(sinonChai);

// Configure snapshot testing
const { mapSourcePosition } = require("source-map-support");
const chaiJestSnapshot = cwdRequire("chai-jest-snapshot");
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));
chai.use(chaiJestSnapshot);
before(function () {
  chaiJestSnapshot.resetSnapshotRegistry();
});
beforeEach(function () {
  const currentTest = this.currentTest;
  chaiJestSnapshot.configureUsingMochaContext(this);

  // set up snapshot name
  const testFilePath = currentTest.file;
  const sourceFilePath = mapSourcePosition({
    source: testFilePath,
    line: 3,
    column: 1,
  }).source;
  const snapFileName = path.basename(sourceFilePath, path.extname(sourceFilePath)) + ".snap";
  chaiJestSnapshot.setFilename(path.join("tests/.snapshots/", snapFileName));
});

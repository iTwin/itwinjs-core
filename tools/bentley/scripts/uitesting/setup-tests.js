/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const utils = require("./utils");

// Get rid of React warning.
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
};

// Configure enzyme (testing utils for React)
const enzyme = utils.cwdRequire("enzyme");
const Adapter = require("enzyme-adapter-react-16");
enzyme.configure({ adapter: new Adapter() });

// Register should style
const chai = utils.cwdRequire("chai");
chai.should();

// Use sinon-chai style
const sinonChai = utils.cwdRequire("sinon-chai");
chai.use(sinonChai);

// Use dirty-chai (to avoid using side-effect getters)
const dirtyChai = utils.cwdRequire("dirty-chai");
chai.use(dirtyChai);

// Configure snapshot testing
const { mapSourcePosition } = require("source-map-support");
const chaiJestSnapshot = utils.cwdRequire("chai-jest-snapshot");
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

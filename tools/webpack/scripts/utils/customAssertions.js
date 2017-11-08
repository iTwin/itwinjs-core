const paths = require("../../config/paths");
const chai = require("chai");
global.expect = chai.expect;

const chaiJestSnapshot = require("chai-jest-snapshot");
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));
chai.use(chaiJestSnapshot);

// WIP: Right now, we need to monkey patch describe in order to get snapshot testing to work in "watch" mode.
// This should only be necessary until https://github.com/zinserjan/mocha-webpack/issues/166 is fixed.
global.globalMochaHooks = function () {

  before(function() {
    chaiJestSnapshot.resetSnapshotRegistry();
  });
  
  beforeEach(function() {
    chaiJestSnapshot.configureUsingMochaContext(this);
    chaiJestSnapshot.setFilename(paths.appSnapshots);
  });
  
}
const paths = require("../../config/paths");
const chai = require("chai");
global.expect = chai.expect;

const chaiJestSnapshot = require("chai-jest-snapshot");
chai.use(chaiJestSnapshot);

// WIP: Right now, we need to monkey patch describe in order to get snapshot testing to work in "watch" mode.
// This should only be necessary until https://github.com/zinserjan/mocha-webpack/issues/166 is fixed.
const olddescribe = describe;
global.bedescribe = function(name, callback) {

  olddescribe.call(this, name, function() {
    
    before(function() {
      chaiJestSnapshot.resetSnapshotRegistry();
    });

    beforeEach(function() {
      if (!this.currentTest.parent.title) 
        this.currentTest.parent.title = name;

      chaiJestSnapshot.configureUsingMochaContext(this);
      chaiJestSnapshot.setFilename(paths.appSnapshots);
    });

    callback();
  });
}
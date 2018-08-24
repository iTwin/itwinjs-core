const path = require("path");
const paths = require("../../config/paths");

const chaiJestSnapshot = require("chai-jest-snapshot");
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer"));
require("chai").use(chaiJestSnapshot);

// WIP: Right now, we need to monkey patch describe in order to get snapshot testing to work in "watch" mode.
// This should only be necessary until https://github.com/zinserjan/mocha-webpack/issues/166 is fixed.
global.globalMochaHooks = function (filename) {

  before(function () {
    chaiJestSnapshot.resetSnapshotRegistry();
  });

  beforeEach(function () {
    chaiJestSnapshot.configureUsingMochaContext(this);
    chaiJestSnapshot.setFilename(this.currentTest.parent.snapshotFilename);
  });

  const wrap = (method) => function (name, callback) {
    return method(name, function (arg) {
      this.snapshotFilename = path.resolve(paths.appSnapshots, filename).replace(/\.(test\.)?tsx?$/, ".snap");
      callback.call(this, arg);
    });
  };

  const newDescribe = wrap(describe);
  newDescribe.skip = wrap(describe.skip);
  newDescribe.only = wrap(describe.only);
  newDescribe.timeout = describe.timeout;
  return newDescribe;
}

const enzyme = require("enzyme");
const Adapter = require("enzyme-adapter-react-16");
enzyme.configure({ adapter: new Adapter() });

// Safely handle SCSS and CSS imports from packages in node_modules. Normally, these files are excluded by webpack.
// However, since we also skip compiling files in node_modules, we also need to ignore these files when they are required from there.
eval("require").extensions[".scss"] = (module, filename) => filename;
eval("require").extensions[".css"] = (module, filename) => filename;
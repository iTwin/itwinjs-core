const path = require('path');
const fs = require('fs');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const coverageFolder = __dirname;
const mergeIntoFolder = 'merged';
const files = fs.readdirSync(coverageFolder);
var mergedCoverageMap = null;

for (var i = 0; i < files.length; i++) {
  var fullPath = path.resolve(coverageFolder, files[i]);

  if (files[i] !== mergeIntoFolder && fs.statSync(fullPath).isDirectory()) {
    fullPath = path.resolve(fullPath, 'coverage-final.json');

    var map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
    if (mergedCoverageMap !== null) {
      mergedCoverageMap.merge(map);
    }
    else {
      mergedCoverageMap = map;
    }
  }
}

const context = libReport.createContext({
  dir: path.join(coverageFolder, mergeIntoFolder)
});

tree = libReport.summarizers.pkg(mergedCoverageMap);

tree.visit(reports.create('cobertura'), context);

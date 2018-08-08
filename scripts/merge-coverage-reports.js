/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const fs = require('fs');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');
const yargs = require("yargs").argv;

const coverageDir = yargs.coverageDir;
if (!coverageDir || !fs.lstatSync(coverageDir).isDirectory())
  throw new Error("Invalid coverage directory (specify with --coverageDir)");

const mergeIntoFolder = 'merged';
const files = fs.readdirSync(coverageDir);
if (!files || 0 === files.length)
  throw new Error("Coverage directory is empty");

let mergedCoverageMap = null;
for (let i = 0; i < files.length; i++) {
  let fullPath = path.resolve(coverageDir, files[i]);
  if (files[i] !== mergeIntoFolder && fs.statSync(fullPath).isDirectory()) {
    fullPath = path.resolve(fullPath, 'coverage-final.json');
    const map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
    if (mergedCoverageMap !== null)
      mergedCoverageMap.merge(map);
    else
      mergedCoverageMap = map;
  }
}

const context = libReport.createContext({
  dir: path.join(coverageDir, mergeIntoFolder)
});
const tree = libReport.summarizers.pkg(mergedCoverageMap);
tree.visit(reports.create('cobertura'), context);
tree.visit(reports.create('html'), context);

const path = require('path');
const fs = require('fs');
const merger = require('junit-report-merger');
const yargs = require("yargs").argv;

const reportsDir = yargs.reportsDir;
if (!reportsDir || !fs.lstatSync(reportsDir).isDirectory())
  throw new Error("Invalid reports directory (specify with --reportsDir)");

const outFilePath = path.resolve(reportsDir, "results.merged.xml");
const srcFilePaths = fs.readdirSync(reportsDir)
  .filter((fileName) => (fileName.endsWith(".xml") && !fileName.endsWith(".merged.xml")))
  .map((fileName) => path.join(reportsDir, fileName));
merger.mergeFiles(outFilePath, srcFilePaths);

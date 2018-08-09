/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

const isCI = (process.env.TF_BUILD);

const paths = require("./config/paths");
const path = require("path");
const mergeJSON = require("merge-json");
const json = require("comment-json");
const fs = require("fs-extra");
const argv = require("yargs").argv;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

if (argv.config === undefined){
  console.log("Please provide a configuration file as input with the --config parameter.")
  process.exit(1);
}

var file = argv.config;
var mergedOutput = mergeJson(file);
delete mergedOutput.extends;

var mergedString = json.stringify(mergedOutput, null, 2);
if (argv.out === undefined){
  console.log(mergedString);
}
else{
  fs.writeFileSync(argv.out, mergedString);
}

function mergeJson(jsonFilePath){
  var jsonFile = json.parse(fs.readFileSync(jsonFilePath).toString(), null, true);

  if (jsonFile.extends !== undefined && typeof jsonFile.extends === "string"){
    var baseFileName = path.resolve(path.dirname(jsonFilePath), jsonFile.extends)

    if (!fs.existsSync(baseFileName)){
      baseFileName = path.resolve(path.dirname(jsonFilePath), path.join("node_modules", jsonFile.extends));
    }

    jsonFile = mergeJSON.merge(mergeJson(baseFileName), jsonFile);
  }

  return jsonFile;
}
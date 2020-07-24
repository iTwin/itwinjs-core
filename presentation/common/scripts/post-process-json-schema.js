/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;
const { execSync } = require("child_process");

if (!yargs.path)
  throw new Error("JSON schema path not specified (--path)");

const schemaPath = path.resolve(yargs.path);
const schema = require(schemaPath);

function handleObject(obj) {
  for (const key in obj) {
    if (Array.isArray(obj[key]))
      obj[key] = handleArray(obj[key]);
    else if (typeof obj[key] === "object")
      obj[key] = handleObject(obj[key]);
    else if (typeof obj[key] === "string" && key === "description")
      obj[key] = handleDescription(obj[key]);
  }
  return obj;
}
function handleArray(arr) {
  for (let i = 0; i < arr.length; ++i) {
    if (typeof arr[i] === "object")
      arr[i] = handleObject(arr[i])
  }
  return arr;
}
function handleDescription(descr) {
  descr = descr.replace(/\[\[([\w\d\.]+)\]\]/ig, "`$1`");
  descr = descr.replace(/\*\*([\w\d\.\:]+)\*\*/ig, "$1");
  descr = descr.replace(/\[([\w\d\s\.\:]+)\]\(\$docs[\\\/\w\d-#\.]+\)/ig, "$1");
  return descr;
}

const processedSchema = handleObject(schema);
fs.writeFileSync(schemaPath, JSON.stringify(processedSchema, undefined, 2));

const isCI = (process.env.TF_BUILD);
if (isCI) {
  // break CI builds if the schema file changes during the build
  const schemaFileStatus = execSync(`git status -s "${yargs.path}"`).toString().trim();
  if (schemaFileStatus !== "") {
    console.error("JSON schema file was modified during a CI build. Please build the package locally and commit the changes.\n");
    process.exit(1);
  }
}

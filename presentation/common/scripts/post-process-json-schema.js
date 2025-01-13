/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;
const { execSync } = require("child_process");

if (!yargs.path) {
  throw new Error("JSON schema path not specified (--path)");
}

const schemaPath = path.resolve(yargs.path);
const schema = require(schemaPath);

function handleObject(obj) {
  for (const key in obj) {
    if (Array.isArray(obj[key])) {
      obj[key] = handleArray(obj[key]);
    } else if (typeof obj[key] === "object") {
      obj[key] = handleObject(obj[key]);
    } else if (typeof obj[key] === "string" && (key === "description" || key === "deprecated")) {
      obj[key] = handleDescription(obj[key]);
    }
  }
  return obj;
}
function handleArray(arr) {
  for (let i = 0; i < arr.length; ++i) {
    if (typeof arr[i] === "object") {
      arr[i] = handleObject(arr[i]);
    }
  }
  return arr;
}
function handleDescription(descr) {
  descr = descr.replace(/\r\n/g, "\n"); // fix line endings
  descr = descr.replace(/\[\[([\w\d\.]+)\]\]/gi, "`$1`"); // replace [[something]] to: `something`
  descr = descr.replace(/\*\*([\w\d\.\:]+)\*\*/gi, "$1"); // replace **something** to: something
  descr = descr.replace(/\[([\w\d\s\.\:`]+)\]\(\$docs[\\\/\w\d-#\.]+\)/gi, "$1"); // replace [something]($docs/link) to: something
  return descr;
}

const processedSchema = handleObject(schema);
fs.writeFileSync(schemaPath, JSON.stringify(processedSchema, undefined, 2));

const isCI = process.env.TF_BUILD;
if (isCI) {
  // break CI builds if the schema file changes during the build
  const schemaFileDiff = execSync(`git diff "${yargs.path}"`).toString().trim();
  if (schemaFileDiff !== "") {
    console.error(`JSON schema file was modified during a CI build. Please build the package locally and commit the changes. Diff:\n\n${schemaFileDiff}\n\n`);
    process.exit(1);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;

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

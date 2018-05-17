/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const argv = require("yargs").argv;
const fs = require("fs-extra");
const path = require("path");
const findImports = require("find-imports"); 

const rootDir = path.resolve(argv.rootDir);
let recursive = false;
if (argv.recursively !== undefined && argv.recursively === "true")
  recursive = true;

if (rootDir === undefined) {
  console.log("Error: missing --rootDir argument");
  return;
}

console.log("Grabbing .js files...");


let inputFileNames = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.resolve(dir, file);
    if (fs.lstatSync(filePath).isDirectory() && file !== "node_modules") { // Is a directory
      walk(filePath);
    } else {
      if (file.endsWith(".js")) {
        inputFileNames.push(filePath);
        continue;
      }
    }
  }
  return;
}

if (recursive === true) {
  walk(rootDir);
} else {
  inputFileNames = fs.readdirSync(rootDir).filter((fileName) => fileName.endsWith(".js"));
  const len = inputFileNames.length;
  for (let i = 0; i < len; i++)
    inputFileNames[i] = path.resolve(rootDir, inputFileNames[i]);
}

console.log("Grabbing imports...");

const imports = {};
for (const file of inputFileNames) {
  const fileResult = findImports(file, { relativeImports: true, packageImports: true });
  for (const prop in fileResult)  // Will only be one property, does not change complexity
    if (fileResult.hasOwnProperty(prop)) {
      for (const i of fileResult[prop]) {   // Loops through the imports for each file
        // Relative file paths can change, need file name by itself
        const toAdd = i.split("\\").pop().split("/").pop();
        if (!(toAdd in imports))
          imports[toAdd] = file;
      }
    }
}

console.log("Outputting imports...\n");

for (const i in imports) {
  console.log(i);
}
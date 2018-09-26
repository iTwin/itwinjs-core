/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const argv = require("yargs").argv;
const fs = require("fs-extra");
const path = require("path");

let includes = [];
if (argv.includes !== undefined)
  includes = argv.includes.split(";");

if (includes !== undefined)
  includes = ["."].concat(includes);
else
  includes = ["."];

console.log(includes);

let recursive = false;
if (argv.recursively !== undefined && argv.recursively === "true")
  recursive = true;

console.log("Grabbing files...");

// Property names are the
let inputFileNames = [];
let rootDir = "";
let rootDirAbsolute = "";

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.resolve(dir, file);
    if (fs.lstatSync(filePath).isDirectory() && file !== "node_modules") { // Is a directory
      walk(filePath);
    } else {
      const rootDiff = path.resolve(dir).substring(rootDirAbsolute.length).replace("\\", "/");
      if (file.endsWith(".ts") && !file.endsWith("d.ts") && file !== "MODULES.ts") {
        // Have to make path relative to where the file is being placed
          inputFileNames.push(rootDir + rootDiff + "/" + file);
        continue;
      }
    }
  }
  return;
}

for (const dir of includes) {
  rootDir = dir;
  rootDirAbsolute = path.resolve(dir);
  if (recursive) {
    walk(dir);
  } else {
    const fileNames = fs.readdirSync(dir);
    for (const file of fileNames) {
      if (file.endsWith(".ts") && !file.endsWith("d.ts") && file !== "MODULES.ts") {
        inputFileNames.push("./" + file);
      }
    }
  }
}

console.log("Generating master module file...");

const modLocation = includes[0] + "\\" + "MODULES.ts";
const stream = fs.createWriteStream(modLocation);

stream.once("open", (fd) => {
  stream.write("/*---------------------------------------------------------------------------------------------\n");
  stream.write("|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $\n");
  stream.write("*--------------------------------------------------------------------------------------------*/\n");
  stream.write("// This is a generated file from an npm script. Please do not modify.\n\n");

  for (const file of inputFileNames)
    stream.write('export * from "' + file.substring(0, file.length - 3) + '";\n');

  stream.end();
});

console.log("Module file created at: " + path.resolve(modLocation));
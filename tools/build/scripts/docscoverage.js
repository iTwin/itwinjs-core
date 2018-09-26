/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const argv = require("yargs").argv;
const fs = require("fs-extra");

let verbose = false;
if (argv.v !== undefined) {
  verbose = true;
  console.log("Running in verbose mode");
} else {
  console.log("Running in non-verbose mode");
  console.log("(to get a more detailed coverage report, use the command: 'npm run cover:docs -- --v')");
  console.log();
}

if (!fs.existsSync("./lib/docs/json/file.json")) {
  console.log("Error - Could not find necessary json file for input.");
  console.log("Ensure that you have ran 'npm run docs' before using this script.");
  process.exit(1);
}

const docJson = JSON.parse(fs.readFileSync("./lib/docs/json/file.json"));

if (docJson === undefined || docJson.children === undefined) {
  console.log("Error - Could not successfully parse the json document into a json object.")
  process.exit(1);
}


const coverageJSON = {
  files: []
};

function fileObjectExists(fileName) {
  for (let i = 0; i < coverageJSON.files.length; i++) {
    if (coverageJSON.files[i].fileName === fileName)
      return i;
  }
  return false;
}

function generateAndPushFileObject(fileName) {
  let fileObject;
  if (verbose) {
    fileObject = {
      fileName: fileName,
      documented: 0,
      undocumented: 0,
      enumerations: 0,
      classes: 0,
      public_methods: 0,
      properties: 0,
      accessors: 0,
    };
  } else {
    fileObject = {
      fileName: fileName,
      documented: 0,
      undocumented: 0,
      enumerations: 0,
      classes: 0,
      public_methods: 0,
    };
  }
  coverageJSON.files.push(fileObject);
  return fileObject;
}

function checkForDocumentation(child) {
  if (verbose) {
    if (!(child.kind === 4 || child.kind === 128 || child.kind === 2048 || child.kind === 1024 || child.kind === 262144)) {
      // If verbose is true, check for classes, enumerations, methods, properties, and accessors
      return;
    }
  } else {
    if (!(child.kind === 4 || child.kind === 128 || child.kind === 2048)) {
      // Only check documentation of classes, enumerations, and methods.
      return;
    }
  }

  // Check if this filename already has corresponding coverage object. If not, create it.
  let fileObject;
  const objExistCheck = fileObjectExists(child.sources[0].fileName);
  if (objExistCheck !== false) {
    fileObject = coverageJSON.files[objExistCheck];
  } else {
    fileObject = generateAndPushFileObject(child.sources[0].fileName);
  }

  if ((child.comment !== undefined && child.comment.shortText !== undefined) ||
  (child.signatures !== undefined && child.signatures[0].comment !== undefined && child.signatures[0].comment.shortText !== undefined)) {
    fileObject.documented++;
  } else {
    fileObject.undocumented++;
    switch(child.kind) {
      case 4:
        fileObject.enumerations++;
        break;
      case 128:
        fileObject.classes++;
        break;
      case 2048:
        fileObject.public_methods++;
        break;
      case 1024:
        fileObject.properties++;
        break;
      case 262144:
        fileObject.accessors++;
        break;
    }
  }
}

// For each class, check that proper documentation is in place
for (const child of docJson.children) {
  checkForDocumentation(child);
  if (child.kind === 128) {
    // Is a class, loop through all methods and check for documentation
    if (child.children !== undefined) {
      for (const subChild of child.children)
        checkForDocumentation(subChild);
    }
  }
}

// Create folder for coverage on a per-file basis
if (!fs.existsSync("./lib/docs/coveragePerFile"))
  fs.mkdirSync("./lib/docs/coveragePerFile")

// For each found file, output specific info regarding class, method, and enumerations coverage
// Also, keep a stream open for the general file holding all file percentages
const generalStream = fs.createWriteStream("./lib/docs/coverage.html");
generalStream.once("open", (fd) => {
  generalStream.write("<!DOCTYPE html><html><head><title>Index</title></head><body>");
  generalStream.write("The following is a list of Typescript files with corresponding documentation coverage percentages.<br>");
  generalStream.write("Note: Only methods, enumerations, and classes are checked for documentation.<br><br><br>");

  for (const file of coverageJSON.files) {
    let filename = file.fileName.replace(/^.*[\\\/]/, "");
    generalStream.write('<a href="coveragePerFile/' + filename + '.html">' + filename + "</a>: " + Math.round(file.documented / (file.documented + file.undocumented) * 100) + "%<br>");
    const specificStream = fs.createWriteStream("./lib/docs/coveragePerFile/" + filename + ".html");
    specificStream.write("<!DOCTYPE html><html><head><title>" + filename + "</title></head><body>");
    specificStream.write("Filename:   " + filename + "<br>");
    specificStream.write("The following is a list of how many undocumented blocks of code exist per type:<br><br><br>");
    for (const property in file) {
      if (file.hasOwnProperty(property)) {    // We only want dev-defined properties
        if (property !== "fileName" && property !== "documented" && property !== "undocumented") {
          specificStream.write(property + ":   " + file[property] + "<br>");
        }
      }
    }
    specificStream.write("</body></html>");
    specificStream.end();
  }
  generalStream.write("</body></html>");
  generalStream.end();
});


console.log("Generated documentation coverage file: " + process.cwd() + "\\lib\\docs\\coverage.html");
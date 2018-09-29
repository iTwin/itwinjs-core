/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

function pseudoLocalizeObject (objIn) {
  let objOut = {};
  for (let prop in objIn) {
    if (objIn.hasOwnProperty(prop)) {
      if (typeof objIn[prop] === "string") {
        objOut[prop] = pseudoLocalize (objIn[prop])
      } else if (typeof objIn[prop] === "object") {
        objOut[prop] = pseudoLocalizeObject (objIn[prop])
      }
    }
  }
return objOut;
}

const replacements = {
  A: "\u00C0\u00C1,\u00C2\u00C3,\u00C4\u00C5",
  a: "\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5",
  B: "\u00DF",
  c: "\u00A2\u00E7",
  C: "\u00C7\u0028",
  D: "\u00D0",
  E: "\u00C8\u00C9\u00CA\u00CB",
  e: "\u00E8\u00E9\u00EA\u00EB",
  I: "\u00CC\u00CD\u00CE\u00CF",
  i: "\u00EC\u00ED\u00EE\u00EF",
  L: "\u00A3",
  N: "\u00D1",
  n: "\u00F1",
  O: "\u00D2\u00D3\u00D4\u00D5\u00D6",
  o: "\u00F2\u00F3\u00F4\u00F5\u00F6\u00F8",
  S: "\u0024\u00A7",
  U: "\u00D9\u00DA\u00DB\u00DC",
  u: "\u00B5\u00F9\u00FA\u00FB\u00FC",
  x: "\u00D7",
  Y: "\u00DD\u00A5",
  y: "\u00FD\u00FF",
};

function pseudoLocalize (inputString) {
  let inReplace = 0;
  let outString = "";
  let replaceIndex = 0; // Note: the pseudoLocalize algorithm in Bim02 uses random, but here we cycle through because Javascript doesn't allow setting of the seed for Math.random.
  for (let iChar=0; iChar < inputString.length; iChar++) {
    let thisChar = inputString.charAt (iChar);
    let nextChar = ( (iChar+1) < inputString.length ) ? inputString.charAt(iChar+1) : 0;

    // handle the {{ and }} delimiters for placeholders - don't want to do anything to characters in between.
    if ( ('{' === thisChar) && ('{' === nextChar ) ) {
      inReplace++;
      iChar++;
      outString = outString.concat ("{{");
    } else if ( ('}' === thisChar) && ('}' === nextChar) && (inReplace > 0) ) {
      inReplace--;
      iChar++;
      outString = outString.concat ("}}");
    } else {
      let replacementChar = thisChar;
      if (0 === inReplace) {
        let replacementsForChar = replacements[thisChar];
        if (undefined !== replacementsForChar) {
          replacementChar = replacementsForChar.charAt(replaceIndex++ % replacementsForChar.length);
        }
      }
    outString = outString.concat (replacementChar);
    }
  }
return outString;
}

function isJsonFile (fileName) {
  return fileName.endsWith(".json");
}

const argv = require("yargs").argv;
const paths = require("./config/paths");
const fs = require("fs-extra")

const englishDir = (argv.englishDir === undefined) ? paths.appLocalesEnglish : argv.englishDir;
const inputFileNames = fs.readdirSync(englishDir).filter(isJsonFile);
const outDir = (argv.out === undefined) ? paths.appLocalesPseudolocalize : argv.out;
try  {
  fs.mkdirpSync (outDir);
} catch (e) {
  console.log (e);// do nothing
}


for (const inputFileName of inputFileNames) {
  const inputFilePath = englishDir + "/" + inputFileName;
  const inputFileContents = fs.readFileSync(inputFilePath, "utf8");
  const outputFileName = outDir + "/" + inputFileName;

  let jsonIn = fs.readFileSync (inputFilePath, {encoding: "utf8"});
  let objIn = JSON.parse (jsonIn);

  let objOut = pseudoLocalizeObject (objIn);
  fs.writeFileSync (outputFileName, JSON.stringify(objOut, null, 2));
}






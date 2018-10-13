/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const argv = require("yargs").argv;
const path = require("path");
const paths = require("./config/paths");
const fs = require("fs-extra");
const readDirectory = require("recursive-readdir");

const __PUBLISH_EXTRACT_START__ = "__PUBLISH_EXTRACT_START__";
const __PUBLISH_EXTRACT_END__ = "__PUBLISH_EXTRACT_END__";

const extractDir = (argv.extractFrom === undefined) ? paths.appTest : argv.extractFrom;
const outDir = (argv.out === undefined) ? paths.libExtract : argv.out;
const fileExt = (argv.fileExt === undefined) ? ["test.ts"] : argv.fileExt.split(",");
const recursive = (argv.recursive === undefined) ? false : true;

const ignoreFunction = (file, stats) => {
  if (stats.isDirectory())
    return !recursive; // don't ignore subdirectories in recursive mode
  return !fileExt.some((ext) => file.endsWith(ext)); // don't ignore files with desired extensions
};

readDirectory(extractDir, [ignoreFunction], (error, inputFileNames) => {
  for (const inputFileName of inputFileNames) {
    const inputFileContents = fs.readFileSync(inputFileName, "utf8");

    if (inputFileContents.indexOf(__PUBLISH_EXTRACT_START__) > 0) {
      console.log("Processing: " + inputFileName);
      const inputLines = inputFileContents.split("\n");
      let outputFileName = undefined;
      let outputLines = [];

      for (const inputLine of inputLines) {
        const startIndex = inputLine.indexOf(__PUBLISH_EXTRACT_START__);
        if (startIndex > 0) {
          if (outputFileName)
            throw new Error("Nested " + __PUBLISH_EXTRACT_START__);

          outputFileName = inputLine.substring(startIndex + __PUBLISH_EXTRACT_START__.length).trim();
          if (0 === outputFileName.length)
            throw new Error("Expected output file name after " + __PUBLISH_EXTRACT_START__);
        } else if (inputLine.indexOf(__PUBLISH_EXTRACT_END__) > 0) {
          if (!outputFileName)
            throw new Error("Missing " + __PUBLISH_EXTRACT_START__);

          if (!fs.existsSync(outDir))
            fs.ensureDirSync(outDir);

          const outputFilePath = path.join(outDir, outputFileName);
          console.log("> Extracting into: " + outputFilePath);
          fs.writeFileSync(outputFilePath, outputLines.join("\n"));

          outputFileName = undefined;
          outputLines = [];
        } else if (outputFileName) {
          outputLines.push(inputLine);
        }
      }

      if (outputFileName)
        throw new Error("Missing " + __PUBLISH_EXTRACT_END__);
    }
  }
});

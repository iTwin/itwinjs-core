/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

//Checks for relatives links in NextVersion.md

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const options = {
  encoding: "utf8"
};

// Get the root directory of the Git repository
const gitRootDir = execSync("git rev-parse --show-toplevel", options).trim();

// Define the relative path to the Markdown file from the Git repository root
const markdownFilePath = path.join(gitRootDir, "docs", "changehistory", "NextVersion.md");

fs.readFile(markdownFilePath, options, (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err}`);
    return;
  }

  const relativeLinkRegex = /\((\.{1,2}[\\/]+|.*\/\.{1,2}[\\/]+)[^\)]*\)/g;

  let lineNumber = 1;
  let foundRelativeLinks = false;

  const lines = data.split("\n");
  lines.forEach((line) => {
    const matches = line.match(relativeLinkRegex);

    if (matches && matches.length > 0) {
      console.error("Error: Relative link found in NextVersion.md");
      console.error(`Line: ${lineNumber}`);
      console.error(`Link: ${matches[0]}`);
      foundRelativeLinks = true;
    }
    lineNumber++;
  });

  if (foundRelativeLinks) {
    process.exit(1);
  }

  console.log("No relative links found in NextVersion.md");
});
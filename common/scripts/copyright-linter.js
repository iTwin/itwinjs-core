/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

function getFileNames(lintBranch) {
  // Get name of every file changed, added, or renamed (excluding deleted files)
  // defaults to between current branch and master, otherwise between last commit and currently
  const diffCommand = "git diff --name-only --diff-filter=d -l0 " + (lintBranch ? "master" : "HEAD~1");

  return child_process.execSync(diffCommand)
    .toString()
    .split("\n")
    // Append path name, accidentally "double counts" directory names between this file and root
    .map(f => path.join(__dirname, "../..", f))
    .filter(f => /\.(js|ts|tsx|scss|css)$/.test(f));
}

function getCopyrightBanner(useCRLF) {
  const eol = (useCRLF) ? "\r\n" : "\n";
  return `/*---------------------------------------------------------------------------------------------${eol}* Copyright (c) Bentley Systems, Incorporated. All rights reserved.${eol}* See LICENSE.md in the project root for license terms and full copyright notice.${eol}*--------------------------------------------------------------------------------------------*/${eol}`;
}

/* Regex breakdown: select block comments if they contain the word Copyright
* /?/[*] : finds either //* or /*
* (?:(?![*]/)(\\s|\\S))* : match all symbols (\s whitespace, \S non-whitespace) that are not comment block closers * /
* Copyright(\\s|\\S)*? : match Copyright and all symbols until the next comment block closer * /
* [*]/.*(\n|\r\n) : match from the comment block closer * / to the next newline
*/
const longCopyright = "/?/[*](?:(?![*]/)(\\s|\\S))*Copyright(\\s|\\S)*?[*]/.*(\n|\r\n)";
// Regex breakdown: select comments that contain the word Copyright
const shortCopyright = "//\\s*Copyright.*(\n|\r\n)";

const oldCopyrightBanner = RegExp(
  `^(${longCopyright})|(${shortCopyright})`,
  "m" // Lack of 'g' means only select the first match in each file
);

// If '--branch' is passed-in all files changed since main/master will be linted
// otherwise only files changed last commit and currently will be linted
const filePaths = getFileNames(process.argv.includes("--branch"))

if (filePaths) {
  filePaths.forEach((filePath) => {
    let fileContent = fs.readFileSync(filePath, { encoding: "utf8" });
    const lastNewlineIdx = fileContent.lastIndexOf("\n");
    const copyrightBanner = getCopyrightBanner(lastNewlineIdx > 0 && fileContent[lastNewlineIdx - 1] === "\r");

    // up-to-date
    if (fileContent.startsWith(copyrightBanner))
      return;

    fileContent = fileContent.replace(
      oldCopyrightBanner,
      copyrightBanner
    );
    if (!fileContent.includes(copyrightBanner)) {
      fileContent = copyrightBanner + fileContent;
    }
    fs.writeFileSync(filePath, fileContent);
  });
}

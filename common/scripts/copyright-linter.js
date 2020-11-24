/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

// Get all arguments after the positional argument indicator, "--"
const filePaths = process.argv.reduce((acc, cur) => {
  if (acc) {
    acc.push(cur);
    return acc;
  } else if (cur === "--") {
    return [];
  } else if (cur === "--fix") {
    // Support manually updating to fix changes made before the linter was fixed.
    return child_process.execSync("git diff --name-only master")
      .toString()
      .split("\n")
      .map(f => path.join(__dirname, "../..", f))
      .filter(f => /\.(js|ts|tsx|scss|css)$/.test(f));
  }
}, false);

function getCopyrightBanner(useCRLF) {
  const eol = (useCRLF) ? "\r\n" : "\n";
  return `/*---------------------------------------------------------------------------------------------${eol}* Copyright (c) Bentley Systems, Incorporated. All rights reserved.${eol}* See LICENSE.md in the project root for license terms and full copyright notice.${eol}*--------------------------------------------------------------------------------------------*/${eol}`;
}

const longCopyright = "/?/[*](.|\n|\r\n)*?Copyright(.|\n|\r\n)*?[*]/(\n|\r\n)";
const shortCopyright = "//\\s*Copyright.*\n";
const oldCopyrightBanner = RegExp(
  `^(${longCopyright})|(${shortCopyright})`,
  "m"
);

if (filePaths) {
  filePaths.forEach((filePath) => {
    let fileContent = fs.readFileSync(filePath, { encoding: "utf8" });
    const lastNewlineIdx = fileContent.lastIndexOf("\n");
    const copyrightBanner = getCopyrightBanner(lastNewlineIdx > 0 && fileContent[lastNewlineIdx - 1] === "\r");

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

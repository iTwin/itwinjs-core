/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");

// Get all arguments after the positional argument indicator, "--"
const filePaths = process.argv.reduce((acc, cur) => {
  if (acc) {
    acc.push(cur);
    return acc;
  } else if (cur === "--") {
    return [];
  }
}, false);

const copyrightBanner = `/*---------------------------------------------------------------------------------------------\n* Copyright (c) Bentley Systems, Incorporated. All rights reserved.\n* See LICENSE.md in the project root for license terms and full copyright notice.\n*--------------------------------------------------------------------------------------------*/`;

const longCopyright = "/?/[*](.|\n|\r\n)*?Copyright(.|\n|\r\n)*?[*]/";
const shortCopyright = "//\\s*Copyright.*\n";
const oldCopyrightBanner = RegExp(
  `^(${longCopyright})|(${shortCopyright})`,
  "m"
);

if (filePaths) {
  filePaths.forEach((filePath) => {
    let fileContent = fs.readFileSync(filePath, { encoding: "utf8" });
    if (fileContent.startsWith(copyrightBanner))
      return;

    fileContent = fileContent.replace(
      oldCopyrightBanner,
      copyrightBanner
    );
    if (!fileContent.includes(copyrightBanner)) {
      fileContent = copyrightBanner + "\n" + fileContent;
    }
    fs.writeFileSync(filePath, fileContent);
  });
}

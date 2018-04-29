/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;

const outDirectory = path.resolve("../../out/packages");
const packagePath = path.resolve("./");

const ensureOutDirectoryExists = () => {
  const createDirs = [];
  let currDir = outDirectory;
  while (!fs.existsSync(currDir)) {
    createDirs.push(currDir);
    currDir = path.resolve(currDir, "../");
  }
  createDirs.reverse().forEach((dir) => fs.mkdirSync(dir));
};
ensureOutDirectoryExists();

const stripVersionNumber = (fileName) => {
  const regex = /([\w-]+)(-\d+\.\d+\.\d+(-\w+)?)(\.tgz)/i;
  return fileName.trim().replace(regex, "$1$4");
}; 

exec(`npm pack ${packagePath}`, { cwd: outDirectory }, (err, stdout, stderr) => {
  if (err) {
    console.log(err.message);
    process.exit(1);
  }
  const oldPath = path.join(outDirectory, stdout.trim());
  const newPath = path.join(outDirectory, stripVersionNumber(stdout));
  fs.renameSync(oldPath, newPath);
  console.log(`Packed: ${newPath}`);
});

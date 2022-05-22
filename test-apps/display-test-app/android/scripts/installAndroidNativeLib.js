/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
if (process.env.IMODELJS_LOCAL_ADDON) {
  return;
}

const exec = require("child_process").exec;
const path = require("path");
const fs = require("fs-extra");
const semver = require("semver");
const packageRoot = findPackageRootDir();
let npFolder = "node_modules";
let requiredPkgVer = require(path.join(packageRoot, "package.json")).dependencies["@bentley/imodeljs-native"];
if (!requiredPkgVer) {
  npFolder = "node_modules/@itwin/core-backend/node_modules"
  requiredPkgVer = require(path.join(packageRoot, npFolder, "@bentley/imodeljs-native/package.json"))["version"];
}
// platform/os is configured here
const os = "android";
const platform = "arm64";

const targetPkgDir = path.join(packageRoot, npFolder, "@bentley/imodeljs-native");
const targetNMDir = path.join(targetPkgDir, "node_modules");
const currentPkgDir = path.join(targetPkgDir, `imodeljs-${os}-${platform}`);

/** Find package root folder where package.json exist */
function findPackageRootDir(dir = __dirname) {
  if (!fs.existsSync(dir))
    return undefined;

  for (const entry of fs.readdirSync(dir)) {
    if (entry === "package.json") {
      return dir;
    }
  }
  return findPackageRootDir(path.join(dir, ".."));
}

// check if the package requested already existed and if yes then check its version
// if the version is different then it remove the folder and if it same it return true;
function validatePackage() {
  try {
    // in case previous install fail do a clean up
    if (fs.existsSync(targetNMDir)) {
      fs.removeSync(targetNMDir);
    }
    const currentPkgVer = require(path.join(currentPkgDir, "package.json")).version;
    if (semver.eq(currentPkgVer, requiredPkgVer, false)) {
      console.log(`Already installed: @bentley/imodeljs-${os}-${platform}@${requiredPkgVer}`)
      return true;
    }
    console.log(`Removing: @bentley/imodeljs-${os}-${platform}@${currentPkgVer}`);
    fs.removeSync(currentPkgDir);
    return false;
  } catch {
    return false;
  }
}

// Install the package if required
if (!validatePackage()) {
  const installCmd = `npm install --no-save --prefix ${targetPkgDir} @bentley/imodeljs-${os}-${platform}@${requiredPkgVer}`;
  console.log(installCmd);
  exec(installCmd, (error, stdout, stderr) => {
    if (error)
      throw error;
    console.log(stdout);
    console.log(stderr);
    fs.moveSync(path.join(targetNMDir, "@bentley", `imodeljs-${os}-${platform}`), currentPkgDir);
    fs.removeSync(targetNMDir);
    console.log(`Installed: @bentley/imodeljs-${os}-${platform}@${requiredPkgVer}`);
  });
}

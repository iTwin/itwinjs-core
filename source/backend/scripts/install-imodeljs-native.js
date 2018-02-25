/*--------------------------------------------------------------------------------------+
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
+--------------------------------------------------------------------------------------*/
var exec = require('child_process').exec;

let version = require("../node_modules/@bentley/imodeljs-nodeaddon/package.json").version;

function getPlatformDir() {
    const arch = process.arch;
    if (process.platform === "win32") {
        return "win" + arch;
    }
    return process.platform + arch;
}

// *** NEEDS WORK: Move this into imodeljs_addon/NodeAddonLoader.js
function computeAddonPackageName() {
  if (typeof (process) === "undefined" || process.version === "")
    throw new Error("NodeAddonLoader could not determine process type");
  let versionCode;
  const electronVersion = process.versions.electron;
  if (typeof electronVersion !== "undefined") {
    versionCode = "e_" + electronVersion.replace(/\./g, "_");
  }
  else {
    const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
    versionCode = "n_" + nodeVersion[0] + "_" + nodeVersion[1]; // use only major and minor version numbers
  }
  let addonPackage = "@bentley/imodeljs-" + versionCode + "-" + process.platform + "-" + process.arch;

  return addonPackage;
}

let cmdLine = 'npm install --no-save ' + computeAddonPackageName() + "@" + version;

console.log(cmdLine);

/*
exec(cmdLine, function (err, stdout, stderr) {
    if (err) {
        console.error(`exec error: ${err}`);
        return;
    }
    if (stdout !== undefined)
        console.log(stdout);
    //if (stderr !== undefined)
    //    console.error (stderr);
});
*/

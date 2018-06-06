/*--------------------------------------------------------------------------------------+
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
+--------------------------------------------------------------------------------------*/
var exec = require('child_process').exec;
var path = require('path');

let version = require("../node_modules/@bentley/imodeljs-nodeaddon/package.json").version;


// *** NEEDS WORK: Move this into imodeljs_addon/NodeAddonLoader.js
function computeAddonPackageName() {
    if (typeof (process) === "undefined" || process.version === "")
        throw new Error("NodeAddonLoader could not determine process type");
    let versionCode;
    const electronVersion = process.versions.electron;
    if (typeof electronVersion !== "undefined") {
        const electronVersionParts = electronVersion.split(".");
        versionCode = "e_" + electronVersionParts[0]; // use only major version number
    }
    else {
        const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
        versionCode = "n_" + nodeVersion[0]; // use only major version number
    }
    return path.join("@bentley", "imodeljs-" + versionCode + "-" + process.platform + "-" + process.arch);
}

let cmdLine = 'npm install --no-save ' + computeAddonPackageName() + "@" + version;

console.log(cmdLine);

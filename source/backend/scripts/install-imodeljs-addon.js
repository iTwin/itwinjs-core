/*--------------------------------------------------------------------------------------+
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
+--------------------------------------------------------------------------------------*/
//=======================================================================================
// NOTE: this installation script must be kept in sync with "source/backend/NodeAddonLoader"
//=======================================================================================

var exec = require('child_process').exec;

function getPlatformDir() {
    const arch = process.arch;
    if (process.platform === "win32") {
        return "win" + arch;
    }
    return process.platform + arch;
}

function computeAddonPackageName() {
    // Examples:
    // @bentley/imodeljs-n_8_2-winx64 1.0.44
    // @bentley/imodeljs-e_1_6_11-winx64 1.0.44
    let versionCode;
    const electronVersion = process.versions.electron;
    if (typeof (electronVersion) !== "undefined") {
        versionCode = "e_" + electronVersion.replace(/\./g, '_');
    }
    else {
        const nodeVersion = process.version.substring(1).split('.'); // strip off the character 'v' from the start of the string
        versionCode = "n_" + nodeVersion[0] + '_' + nodeVersion[1]; // use only major and minor version numbers
    }
    return "@bentley/imodeljs-" + versionCode + "-" + getPlatformDir();
}

let cmdLine = 'npm install --no-save ' + computeAddonPackageName();

console.log(cmdLine + " ...");

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

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
var exec = require('child_process').exec;
var path = require('path');

let version = require(path.join("..", "node_modules", "@bentley", "imodeljs-native-platform-api", "package.json")).version;

if (typeof (process) === "undefined" || process.version === "")
    throw new Error("NodeAddonLoader could not determine process type");

function installNativePlatformPackage(version_prefix) {
    let addon = `"@bentley/imodeljs-${version_prefix}-${process.platform}-${process.arch}`;
    let cmdLine = 'npm install --no-save ' + addon + "@" + version;
    console.log(`Installing ${addon}@${version}...`);
    exec(cmdLine, (err, stdout, stderr) => {
        if (err) {
            throw err;
        }
        console.log(stdout);
    });
}
console.log('argv=' + process.argv[2]);

installNativePlatformPackage('n_8');
installNativePlatformPackage('e_2');

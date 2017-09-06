/*--------------------------------------------------------------------------------------+
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
+--------------------------------------------------------------------------------------*/
var exec = require('child_process').exec;

let addonloader = require('./addonLoader');

let cmdLine = 'npm install --no-save ' + addonloader.computeAddonPackageName();

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

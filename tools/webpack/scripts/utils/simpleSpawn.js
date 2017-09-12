/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const spawn = require('react-dev-utils/crossSpawn');
const chalk = require('chalk');

function simpleSpawn(cmd, args, cwd) {
  if (!cwd)
    cwd = process.cwd();

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: cwd,
      stdio: ['pipe', process.stdout, process.stderr]
    });
    child.on('error', function(data) { console.log(chalk.red(data)); });  
    child.on('close', ()=> resolve());
    simpleSpawn.children.push(child);
  });
}

simpleSpawn.children = [];
simpleSpawn.killAll = function() {
  simpleSpawn.children.forEach((proc) => {
    proc.stdin.end();
  });
}

function handleInterrupts(callback) {
  if (!callback) {
    callback = () => {
      simpleSpawn.killAll();
      process.exit();
    };
  }

  if (process.platform === "win32") {
    require("readline")
      .createInterface({
        input: process.stdin,
        output: process.stdout
      })
      .on("SIGINT", function () {
        process.emit("SIGINT");
      })
      .addListener("close", function () {
        process.emit("SIGINT");
      });
  }

  ['SIGINT', 'SIGTERM'].forEach(function(sig) {
    process.on(sig, function() {
      callback();
    });
  });
}

module.exports = {
  spawn: simpleSpawn,
  handleInterrupts
};
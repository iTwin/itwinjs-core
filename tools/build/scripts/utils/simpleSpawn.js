/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// Copied from \tools\webpack\scripts\utils

const spawn = require('cross-spawn');
const chalk = require('chalk');

function simpleSpawn(cmd, args, cwd) {
  if (!cwd)
    cwd = process.cwd();

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: cwd,
      env: Object.assign({ FORCE_COLOR: "1" }, process.env),
      stdio: 'pipe'
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    })
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    })
    child.on('error', function (data) { console.log(chalk.red(data)); });
    child.on('close', (code) => resolve(code));
    simpleSpawn.children.push(child);
  });
}

function simpleSpawnSync(cmd, args, cwd) {
  if (!cwd)
    cwd = process.cwd();

  const child = spawn.sync(cmd, args, {
    cwd: cwd,
    env: Object.assign({ FORCE_COLOR: "1" }, process.env),
    stdio: 'inherit'
  });

  if (child.status !== 0) {
    process.exit(child.status);
  }
}

simpleSpawn.children = [];
simpleSpawn.killAll = function () {
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

  ['SIGINT', 'SIGTERM'].forEach(function (sig) {
    process.on(sig, function () {
      callback();
    });
  });
}

module.exports = {
  spawn: simpleSpawn,
  spawnSync: simpleSpawnSync,
  handleInterrupts
};
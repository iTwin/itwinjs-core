/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const spawn = require("react-dev-utils/crossSpawn");
const chalk = require("chalk");
var kill = require('tree-kill');

function simpleSpawn(cmd, args, cwd, env) {
  if (!cwd)
    cwd = process.cwd();

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: cwd,
      env: Object.assign({FORCE_COLOR: "1"}, env || {}, process.env),
      stdio: "pipe"
    });

    child.stdout.on("data", (data) => {
      process.stdout.write(data);
    })
    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    })
    child.on("error", function(data) { console.log(chalk.red(data)); });  
    child.on("close", (code)=> resolve(code));
    simpleSpawn.children.push(child);
  });
}

simpleSpawn.children = [];
simpleSpawn.killAll = async function() {
  const promises = [];
  simpleSpawn.children.forEach((proc) => {
    promises.push(new Promise((resolve) => {
      kill(proc.pid, undefined, resolve);
    }));
  });
  await Promise.all(promises);
}

function handleInterrupts(callback) {
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

  ["SIGINT", "SIGTERM"].forEach(function(sig) {
    process.on(sig, async function() {
      if (callback)
        callback();
      await simpleSpawn.killAll();
      process.exit();
    });
  });
}

module.exports = {
  spawn: simpleSpawn,
  handleInterrupts
};
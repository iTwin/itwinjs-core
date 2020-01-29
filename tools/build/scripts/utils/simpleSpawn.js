/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const spawn = require("cross-spawn");
const chalk = require("chalk");
const kill = require("tree-kill");

function simpleSpawn(cmd, args, cwd, env = {}) {
  if (!cwd)
    cwd = process.cwd();

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: cwd,
      env: { FORCE_COLOR: "1", ...env, ...process.env },
      stdio: "pipe"
    });

    child.stdout.on("data", (data) => {
      process.stdout.write(data);
    })
    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    })
    child.on("error", function (data) { console.log(chalk.red(data)); });
    child.on("close", (code) => resolve(code));
    simpleSpawn.children.push(child);
  });
}

function simpleSpawnSync(cmd, args, cwd, env = {}) {
  if (!cwd)
    cwd = process.cwd();

  const child = spawn.sync(cmd, args, {
    cwd: cwd,
    env: { FORCE_COLOR: "1", ...env, ...process.env },
    stdio: "inherit"
  });

  if (child.status !== 0) {
    process.exit(child.status);
  }
}

simpleSpawn.children = [];
simpleSpawn.killAll = async function () {
  const promises = [];
  simpleSpawn.children.forEach((proc) => {
    promises.push(new Promise((resolve) => {
      kill(proc.pid, undefined, resolve);
    }));
  });
  await Promise.all(promises);
}

function handleInterrupts(callback) {
  if (!callback) {
    callback = async () => {
      await simpleSpawn.killAll();
      process.exit();
    };
  }

  if (process.platform === "win32") {
    require("readline")
      .createInterface({
        input: process.stdin,
        output: process.stdout
      });
  }

  ["SIGINT", "SIGTERM"].forEach(function (sig) {
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
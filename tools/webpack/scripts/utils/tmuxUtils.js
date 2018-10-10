/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const child_process = require('child_process');
const readline = require('readline');

// This file will also be pre-loaded before stmux runs.
// We need to do this so stmux thinks stdin is from the terminal, otherwise it'll just error out.
process.stdin.isTTY = true;

function spawnStmux(args) {
  // Make sure stmux is globally installed.
  // By requiring it to be globally installed, we avoid requiring users who aren't interested in terminal multiplexing having to pull and build stmux
  const binPath = child_process.execSync("npm bin -g").toString().trim();
  if (!fs.existsSync(path.join(binPath, "stmux"))) {
    console.log(path.join(binPath, "stmux"));
    console.log(chalk.red.bold("The stmux package is not installed.\n"));
    console.log("Try running: " + chalk.cyan("npm i -g stmux.\n"));
    process.exit();
  }
  const subProc = child_process.spawn("node", [
    "-r", __filename,
    path.join(binPath, "node_modules", "stmux", "bin", "stmux.js"),
    "--mouse",
    "--",
    ...args
  ],
    { stdio: ["pipe", 1, 2], shell: true });

  // Remap input to stmux (the default controls are too wonky)
  process.stdin.setRawMode(true);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on("keypress", function (chunk, key) {
    if (key && key.ctrl) {
      // CTRL + LEFT ==> Switch to left terminal
      if (key.name === "left") {
        subProc.stdin.write("\x01");
        subProc.stdin.write("\x1B[D");
      }
      // CTRL + RIGHT ==> Switch to right terminal
      if (key.name === "right") {
        subProc.stdin.write("\x01");
        subProc.stdin.write("\x1B[C");
      }
      // CTRL + UP ==> Scroll terminal up
      if (key.name === "up") {
        subProc.stdin.write("\x01v");
        subProc.stdin.write("\x1B[1A");
      }
      // CTRL + DOWN ==> Scroll terminal down
      if (key.name === "down") {
        subProc.stdin.write("\x01v");
        subProc.stdin.write("\x1B[1B");
      }
      // CTRL + C ==> Shutdown
      if (key.name === "c") {
        subProc.stdin.write("\x01k");
      }
    }
    // Also re-draw on backspace (sometimes backspace was breaking the layout)
    if (key && key.name === "backspace") {
      subProc.stdin.write("\x01l");
    }
  });
}

module.exports = { spawnStmux };

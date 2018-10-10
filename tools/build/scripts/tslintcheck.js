/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/*This script is intended as a cross-platform way to check for the phrase "tslint:disable" in .ts files
  not included in the node_modules directory. This is so we know where people are turning off rules in source. */

const fs = require("fs-extra");
const glob = require("glob");
const readline = require("readline");
const argv = require("yargs").argv;

var files = glob.sync("**/*.ts", { ignore: ["**/node_modules/**/*", "**/*.d.ts"] })

if (argv.out) {
  if (fs.existsSync(argv.out)) {
    fs.unlinkSync(argv.out);
  }
  var writeStream = fs.createWriteStream(argv.out, { flags: "a" });
}

files.forEach(file => {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity
  })

  var lineNumber = 0;

  rl.on('line', (line) => {
    lineNumber++;
    if (line.indexOf("tslint:disable") > -1) {
      if (writeStream) {
        writeStream.write(`${file}:${lineNumber}:${line}\n`);
      }
      else {
        console.log(`${file}:${lineNumber}:${line}`);
      }
    }
  });
});


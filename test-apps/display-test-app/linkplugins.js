/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs-extra")
const path = require("path");

function linkFile(srcpath, destpath, filename) {
  try {
    fs.symlinkSync(path.join(srcpath, filename), path.join(destpath, filename), "file");
  } catch (e) {
    console.log(filename + " is already linked");
  }
}
function linkDir(srcpath, destpath, dirName) {
  try {
    fs.symlinkSync(path.join(srcpath, dirName), path.join(destpath, dirName), "dir");
  } catch (e) {
    console.log(dirName + " is already linked");
  }
}

// create a symbolic link to the Markup.js plugin, simulating how the plugin will be delivered in production
const dest = path.resolve("lib", "webresources");

let src = path.resolve("..", "..", "plugins", "markup", "lib", "webresources");
linkFile(src, dest, "MarkupPlugin.js");
linkFile(src, dest, "MarkupPlugin.js.map");

src = path.resolve("..", "..", "plugins", "markup", "public");
linkDir(src, dest, "Markup");

const enLocaleDest = path.resolve(dest, "locales", "en");
const enLocaleSrc = path.resolve(src, "locales", "en");
linkFile(enLocaleSrc, enLocaleDest, "MarkupTools.json");

// create a symbolic link to the Markup.js plugin, simulating how the plugin will be delivered in production
src = path.resolve("..", "webworker-test-app", "lib", "webresources");
linkFile(src, dest, "startWebWorkerPlugin.js");
linkFile(src, dest, "startWebWorkerPlugin.js.map");

linkFile(src, dest, "testWebWorker.js");
linkFile(src, dest, "testWebWorker.js.map");

src = path.resolve("..", "webworker-test-app", "assets");
linkFile(src, dest, "galvanized03.jpg");

src = path.resolve("..", "..", "docs/core/learning/frontend");
linkFile(src, dest, "accudraw.png");




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

// create a symbolic link to the Markup.js plugin, simulating how the plugin will be delivered in production
const filename = "Markup.js";
const src = path.resolve("..", "..", "plugins", "markup", "lib", "webresources");
const dest = path.resolve("lib", "webresources");

linkFile(src, dest, "MarkupPlugin.js");
linkFile(src, dest, "MarkupPlugin.js.map");


/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const fs = require("fs");
const IModelJsConfig = require("../lib/IModelJsConfig").IModelJsConfig;
if (process.argv.length < 2) {
  console.error("Required argument <jsonFile> is missing.")
  console.log("write.js <jsonFile> [keyFilter]");
  return;
}

const jsonFile = process.argv[2];
const keyFilter = process.argv.length > 3 ? process.argv[3] : "[\w_]+";

//Locate config if one is present
Object.assign(process.env, IModelJsConfig.init(true, true));
console.log(`writing a file ${jsonFile}`);

const raw = process.env;
let ret = {};

const r = RegExp(keyFilter);
Object.keys(raw).forEach((key) => {
  if (!(key.toLowerCase() == "path" || raw[key].trim() === "" || key.match(r) === null)) {
    ret[key] = raw[key];
  }
});

fs.writeFileSync(jsonFile, JSON.stringify(ret, null, 4), { encoding: "utf8", flag: "w" });


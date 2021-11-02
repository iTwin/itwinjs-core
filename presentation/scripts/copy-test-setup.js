/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");

let dir = path.join(process.cwd(), "lib", "cjs");
if (!fs.existsSync(dir))
  fs.mkdirSync(dir);

dir = path.join(dir, "test");
if (!fs.existsSync(dir))
  fs.mkdirSync(dir);

fs.copyFileSync(path.join(__dirname, "setup-tests.js"), path.join(dir, "setup.js"));

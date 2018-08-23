/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
fs.copyFileSync(path.join(__dirname, "setup-tests.js"), path.join(process.cwd(), "lib", "setup-tests.js"));
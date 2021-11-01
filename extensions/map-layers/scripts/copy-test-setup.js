/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
fs.copyFileSync(path.join(__dirname, "setup-tests.js"), path.join(process.cwd(), "lib", "cjs", "test", "setup.js"));
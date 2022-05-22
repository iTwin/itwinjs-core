/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Node 15+ using MessageChannel prevents node.js process from exiting
// This becomes an issue when testing React code within JSDOM environment, as the test process cannot exit properly.
// https://github.com/facebook/react/issues/20756
const commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
if (commonjsGlobal.MessageChannel)
  delete commonjsGlobal.MessageChannel;

const fs = require("fs");
const path = require("path");

let dir = path.join(process.cwd(), "lib", "cjs");
if (!fs.existsSync(dir))
  fs.mkdirSync(dir);

dir = path.join(dir, "test");
if (!fs.existsSync(dir))
  fs.mkdirSync(dir);

fs.copyFileSync(path.join(__dirname, "setup-tests.js"), path.join(dir, "setup.js"));

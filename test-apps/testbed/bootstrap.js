/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const fs = require("fs");
const { ipcRenderer, remote } = require("electron");
global.___IMODELJS_CORE_DIRNAME___ = path.join(__dirname, "../..");
global.___TESTBED_IPC_RENDERER___ = ipcRenderer;
remote.getCurrentWindow().setTitle("iModelJs Testbed");
remote.require(path.join(__dirname, "lib/backend/index"));

const jsPath = "lib/dist/testbed.js";
require("vm").runInThisContext(fs.readFileSync(jsPath), { filename: "file:///" + path.join(__dirname, jsPath).replace(/\\/g, '/') });

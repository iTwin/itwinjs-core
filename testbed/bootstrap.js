/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const { ipcRenderer, remote } = require("electron");
global.___IMODELJS_CORE_DIRNAME___ = path.join(__dirname, "..");
global.___TESTBED_IPC_RENDERER___ = ipcRenderer;
remote.getCurrentWindow().setTitle("iModelJS Testbed");
remote.require(path.join(__dirname, "lib/backend/index"));
require(path.join(__dirname, "lib/dist/testbed.js"));

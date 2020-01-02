/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { initializeBackend, getRpcInterfaces } from "./backend";
import { IModelJsElectronManager } from "@bentley/electron-manager";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

import * as electron from "electron";

// --------------------------------------------------------------------------------------
// ------- Initialization and setup of host and tools before starting app ---------------

// Start the backend
initializeBackend();

if (process.argv.length > 2 && process.argv[2].split(".").pop() === "json")
  DisplayPerfRpcInterface.jsonFilePath = process.argv[2];

// --------------------------------------------------------------------------------------
// ---------------- This part copied from protogist ElectronMain.ts ---------------------
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW); // Make max window the default

(async () => { // tslint:disable-line:no-floating-promises
  const manager = new IModelJsElectronManager(path.join(__dirname, "..", "webresources"));

  await manager.initialize({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      experimentalFeatures: true, // Needed for CSS Grid support
    },
    autoHideMenuBar: true,
    show: !maximizeWindow,
  });

  // Initialize application gateway configuration for the backend
  ElectronRpcManager.initializeImpl({}, getRpcInterfaces());

  if (manager.mainWindow) {
    if (maximizeWindow) {
      manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
      manager.mainWindow.show();
    }
    if (autoOpenDevTools)
      manager.mainWindow.webContents.toggleDevTools();
  }

  // tslint:disable-next-line:no-var-requires
  const configPathname = path.normalize(path.join(__dirname, "../webresources", "config.json"));
  const configuration = require(configPathname);
  if (configuration.useIModelBank) {
    electron.app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
      // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
      event.preventDefault();
      callback(true);
    });
  }

  // Handle custom keyboard shortcuts
  electron.app.on("web-contents-created", (_e, wc) => {
    wc.on("before-input-event", (event, input) => {
      // CTRL + SHIFT + I  ==> Toggle DevTools
      if (input.key === "I" && input.control && !input.alt && !input.meta && input.shift) {
        if (manager.mainWindow)
          manager.mainWindow.webContents.toggleDevTools();

        event.preventDefault();
      }
    });
  });
})();

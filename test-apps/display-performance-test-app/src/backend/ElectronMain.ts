/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as url from "url";

import { ElectronRpcManager } from "@bentley/imodeljs-common/lib/common";
import { initializeBackend, getRpcInterfaces } from "./backend";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsElectronAppManager } from "@bentley/imodeljs-backend";

import * as electron from "electron";

// --------------------------------------------------------------------------------------
// ------- Initialization and setup of host and tools before starting app ---------------

// Start the backend
initializeBackend();

// Set up logging (by default, no logging is enabled)
const logLevelEnv = process.env.SVT_LOG_LEVEL as string;
const logLevel = undefined !== logLevelEnv ? Logger.ParseLogLevel(logLevelEnv) : LogLevel.None;
Logger.setLevelDefault(logLevel);

// --------------------------------------------------------------------------------------
// ---------------- This part copied from protogist ElectronMain.ts ---------------------
const isDevBuild = (process.env.NODE_ENV === "development");
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined !== process.env.SVT_MAXIMIZE_WINDOW);

(async () => {
  const manager = new IModelJsElectronAppManager(electron);
  if (!isDevBuild)
    manager.frontendURL = url.format({
      pathname: path.join(__dirname, "public/index.html"),
      protocol: "file:",
      slashes: true,
    });

  await manager.initialize({
    width: 1280,
    height: 800,
    webPreferences: {
      webSecurity: !isDevBuild, // Workaround for CORS issue in dev build
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
  const configuration = require(path.join(__dirname, "public", "configuration.json"));
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

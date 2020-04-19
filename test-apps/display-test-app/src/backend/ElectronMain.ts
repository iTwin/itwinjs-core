/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { initializeBackend, getRpcInterfaces } from "./backend";
import { IModelJsElectronManager, WebpackDevServerElectronManager, StandardElectronManager } from "@bentley/electron-manager";

import * as electron from "electron";

// Start the backend
initializeBackend();

const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

(async () => { // tslint:disable-line:no-floating-promises
  let manager: StandardElectronManager;
  if (process.env.NODE_ENV === "production")
    manager = new IModelJsElectronManager(path.join(__dirname, "..", "..", "build"));
  else
    manager = new WebpackDevServerElectronManager(3000); // port should match the port of the local dev server

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
  ElectronRpcManager.initializeImpl({}, getRpcInterfaces("native"));

  if (manager.mainWindow) {
    if (maximizeWindow) {
      manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
      manager.mainWindow.show();
    }
    if (autoOpenDevTools)
      manager.mainWindow.webContents.toggleDevTools();
  }

  const configPathname = path.normalize(path.join(__dirname, "..", "..", "build", "configuration.json"));
  const configuration = require(configPathname); // tslint:disable-line:no-var-requires
  if (configuration.useIModelBank) {
    electron.app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
      // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
      event.preventDefault();
      callback(true);
    });
  }
})();

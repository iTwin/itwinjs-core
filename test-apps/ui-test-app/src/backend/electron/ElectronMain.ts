/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as electron from "electron";

import { assert } from "@bentley/bentleyjs-core";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager, WebpackDevServerElectronManager, StandardElectronManager } from "@bentley/electron-manager";

/**
 * Initializes Electron backend
 */
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

export default function initialize(rpcs: RpcInterfaceDefinition[]) {
  (async () => { // tslint:disable-line:no-floating-promises
    let manager: StandardElectronManager;
    if (process.env.NODE_ENV === "production")
      manager = new IModelJsElectronManager(path.join(__dirname, "..", "build"));
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
      width: 800,
      height: 650,
      webPreferences: {
        nodeIntegration: true,
        experimentalFeatures: true, // Needed for CSS Grid support
        // preload: path.join(__dirname, "preload.js"),
      },
      autoHideMenuBar: true,
      show: !maximizeWindow,
    });

    // tell ElectronRpcManager which RPC interfaces to handle
    ElectronRpcManager.initializeImpl({}, rpcs);

    if (manager.mainWindow) {
      if (maximizeWindow) {
        manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
        manager.mainWindow.show();
      }
      if (autoOpenDevTools)
        manager.mainWindow.webContents.toggleDevTools();
    }
  })();
}

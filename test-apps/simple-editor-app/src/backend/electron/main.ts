/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as electron from "electron";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager } from "@bentley/electron-manager";
/**
 * Initializes Electron backend
 */
export default function initialize(rpcs: RpcInterfaceDefinition[]) {
  (async () => { // tslint:disable-line:no-floating-promises
    const manager = new IModelJsElectronManager(path.join(__dirname, "..", "..", "webresources"));

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
        experimentalFeatures: true, // Needed for CSS Grid support
        nodeIntegration: true,
        preload: path.join(__dirname, "preload.js"),
      },
      autoHideMenuBar: true,
      show: false,
    });

    // tell ElectronRpcManager which RPC interfaces to handle
    ElectronRpcManager.initializeImpl({}, rpcs);
    if (manager.mainWindow) {
      manager.mainWindow.show();

      const autoOpenDevTools = (undefined !== process.env.SIMPLE_EDITOR_APP_DEV_TOOLS);
      if (autoOpenDevTools)
        manager.mainWindow.webContents.toggleDevTools();
    }
  })();
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as electron from "electron";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager } from "@bentley/electron-manager";
/**
 * Initializes Electron backend
 */

const autoOpenDevTools = false;

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
      width: 800,
      height: 650,
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });
    // tell ElectronRpcManager which RPC interfaces to handle
    ElectronRpcManager.initializeImpl({}, rpcs);
    if (manager.mainWindow && autoOpenDevTools)
      manager.mainWindow.webContents.toggleDevTools();

  })();
}

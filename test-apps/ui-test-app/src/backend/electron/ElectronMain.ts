/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as electron from "electron";
import * as path from "path";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronBackendOptions, initializeElectronBackend } from "../../../../../core/electron-manager/lib/ElectronBackend";

/**
 * Initializes Electron backend
 */
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

export default async function initialize(rpcInterfaces: RpcInterfaceDefinition[]) {
  const opts: ElectronBackendOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
    rpcInterfaces,
    developmentServer: process.env.NODE_ENV === "development",
  };

  const manager = initializeElectronBackend(opts);

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

  await manager.openMainWindow({ width: 800, height: 650, show: !maximizeWindow, title: "Ui Test App" });
  assert(manager.mainWindow !== undefined);

  if (maximizeWindow) {
    manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    manager.mainWindow.show();
  }
  if (autoOpenDevTools)
    manager.mainWindow.webContents.toggleDevTools();
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronHost, ElectronHostOptions } from "@bentley/electron-manager/lib/ElectronBackend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";

/**
 * Initializes Electron backend
 */
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

export default async function initialize(rpcInterfaces: RpcInterfaceDefinition[]) {
  const electronHost: ElectronHostOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
    rpcInterfaces,
    developmentServer: process.env.NODE_ENV === "development",
  };

  await ElectronHost.startup({ electronHost });

  // Handle custom keyboard shortcuts
  ElectronHost.app.on("web-contents-created", (_e, wc) => {
    wc.on("before-input-event", (event, input) => {
      // CTRL + SHIFT + I  ==> Toggle DevTools
      if (input.key === "I" && input.control && !input.alt && !input.meta && input.shift) {
        if (ElectronHost.mainWindow)
          ElectronHost.mainWindow.webContents.toggleDevTools();

        event.preventDefault();
      }
    });
  });

  await ElectronHost.openMainWindow({ width: 800, height: 650, show: !maximizeWindow, title: "Ui Test App" });
  assert(ElectronHost.mainWindow !== undefined);

  if (maximizeWindow) {
    ElectronHost.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    ElectronHost.mainWindow.show();
  }
  if (autoOpenDevTools)
    ElectronHost.mainWindow.webContents.toggleDevTools();
}

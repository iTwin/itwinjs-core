/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronBackend, ElectronBackendOptions } from "@bentley/electron-manager/lib/ElectronBackend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";

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

  const backend = ElectronBackend.initialize(opts);

  // Handle custom keyboard shortcuts
  backend.app.on("web-contents-created", (_e, wc) => {
    wc.on("before-input-event", (event, input) => {
      // CTRL + SHIFT + I  ==> Toggle DevTools
      if (input.key === "I" && input.control && !input.alt && !input.meta && input.shift) {
        if (backend.mainWindow)
          backend.mainWindow.webContents.toggleDevTools();

        event.preventDefault();
      }
    });
  });

  await backend.openMainWindow({ width: 800, height: 650, show: !maximizeWindow, title: "Ui Test App" });
  assert(backend.mainWindow !== undefined);

  if (maximizeWindow) {
    backend.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    backend.mainWindow.show();
  }
  if (autoOpenDevTools)
    backend.mainWindow.webContents.toggleDevTools();
}

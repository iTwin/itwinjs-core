/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as electron from "electron";
import * as path from "path";
import { IModelJsElectronManager, WebpackDevServerElectronManager } from "@bentley/electron-manager";
import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { getRpcInterfaces, initializeBackend } from "./backend";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises

  const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
  const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

  let width = 1280;
  let height = 800;
  const sizeStr = process.env.SVT_WINDOW_SIZE;
  if (typeof sizeStr === "string") {
    const parts = sizeStr.split(",");
    if (parts.length === 2) {
      const w = Number.parseInt(parts[0], 10);
      const h = Number.parseInt(parts[1], 10);

      if (!Number.isNaN(w))
        width = w;

      if (!Number.isNaN(h))
        height = h;
    }
  }

  const manager = (process.env.NODE_ENV === "production") ?
    new IModelJsElectronManager(path.join(__dirname, "..", "..", "build")) :
    new WebpackDevServerElectronManager(3000); // port should match the port of the local dev server

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
    width,
    height,
    show: !maximizeWindow,
  });

  // Start the backend
  await initializeBackend();

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
  const configuration = require(configPathname); // eslint-disable-line @typescript-eslint/no-var-requires
  if (configuration.useIModelBank) {
    electron.app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
      // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
      event.preventDefault();
      callback(true);
    });
  }
})();

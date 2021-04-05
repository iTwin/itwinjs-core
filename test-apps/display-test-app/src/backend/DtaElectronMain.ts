/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronHost, ElectronHostOptions } from "@bentley/electron-manager/lib/ElectronBackend";
import { dtaChannel, DtaIpcInterface } from "../common/DtaIpcInterface";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";
import { IpcHandler } from "@bentley/imodeljs-backend";

const mainWindowName = "mainWindow";
const getWindowSize = () => {
  const sizeStr = process.env.SVT_WINDOW_SIZE;
  if (typeof sizeStr === "string") {
    const parts = sizeStr.split(",");
    if (parts.length === 2) {
      let width = Number.parseInt(parts[0], 10);
      let height = Number.parseInt(parts[1], 10);

      if (Number.isNaN(width))
        width = 1280;

      if (Number.isNaN(height))
        height = 1024;
      return { width, height, x: 100, y: 100 };
    }
  }

  return ElectronHost.getWindowSizeSetting(mainWindowName);
};

class DtaHandler extends IpcHandler implements DtaIpcInterface {
  public get channelName() { return dtaChannel; }
  public async sayHello() {
    return "Hello from backend";
  }
}

/**
 * This is the function that gets called when we start display-test-app via `electron DtaElectronMain.js` from the command line.
 * It runs in the Electron main process and hosts the iModeljs backend (IModelHost) code. It starts the render (frontend) process
 * that starts from the file "index.ts". That launches the iModel.js frontend (IModelApp).
 */
const dtaElectronMain = async () => {
  const opts: ElectronHostOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "build"),
    iconName: "display-test-app.ico",
    rpcInterfaces: getRpcInterfaces(),
    ipcHandlers: [DtaHandler],
    developmentServer: process.env.NODE_ENV === "development",
    authConfig: {
      clientId: "imodeljs-electron-test",
      scope: "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party imodel-extension-service-api offline_access",
    },
  };

  await initializeDtaBackend(opts);

  // Restore previous window size, position and maximized state
  const sizeAndPosition = getWindowSize();
  const maximizeWindow = undefined === sizeAndPosition || ElectronHost.getWindowMaximizedSetting(mainWindowName);

  // after backend is initialized, start display-test-app frontend process and open the window
  await ElectronHost.openMainWindow({ ...sizeAndPosition, show: !maximizeWindow, title: "Display Test App", storeWindowName: mainWindowName });
  assert(ElectronHost.mainWindow !== undefined);

  if (maximizeWindow) {
    ElectronHost.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    ElectronHost.mainWindow.show();
  }

  if (undefined === process.env.SVT_NO_DEV_TOOLS)
    ElectronHost.mainWindow.webContents.toggleDevTools();

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

  const configPathname = path.normalize(path.join(__dirname, "..", "..", "build", "configuration.json"));
  const configuration = require(configPathname); // eslint-disable-line @typescript-eslint/no-var-requires
  if (configuration.useIModelBank) {
    ElectronHost.app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
      // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
      event.preventDefault();
      callback(true);
    });
  }

};

// execute this immediately when we load
dtaElectronMain(); // eslint-disable-line @typescript-eslint/no-floating-promises

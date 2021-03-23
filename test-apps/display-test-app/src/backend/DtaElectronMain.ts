/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronHost, ElectronHostOptions, ElectronWindowState } from "@bentley/electron-manager/lib/ElectronBackend";
import { dtaChannel, DtaIpcInterface } from "../common/DtaIpcInterface";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";
import { IpcHandler } from "@bentley/imodeljs-backend";

let mainWindowState: ElectronWindowState;
const storageName = "display-test-app";
const defaultWidth = 1280;
const defaultHeight = 800;

const getWindowSize = () => {
  const sizeAndPosition = mainWindowState.getPreviousSizeAndPosition();

  const sizeStr = process.env.SVT_WINDOW_SIZE;
  if (typeof sizeStr === "string") {
    const parts = sizeStr.split(",");
    if (parts.length === 2) {
      const w = Number.parseInt(parts[0], 10);
      const h = Number.parseInt(parts[1], 10);

      if (!Number.isNaN(w))
        sizeAndPosition.width = w;

      if (!Number.isNaN(h))
        sizeAndPosition.height = h;
    }
  }

  return sizeAndPosition;
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
  };

  await initializeDtaBackend(opts);

  const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
  const maximizeWindowConfig = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW);

  // Restore previous window size, position and maximized state
  mainWindowState = ElectronHost.initializeMainWindowState(storageName, defaultWidth, defaultHeight, false);
  const sizeAndPosition = getWindowSize();
  const maximizeWindow = maximizeWindowConfig || mainWindowState.getPreviousMaximizedState();

  // after backend is initialized, start display-test-app frontend process and open the window
  await ElectronHost.openMainWindow({ ...sizeAndPosition, show: !maximizeWindow, title: "Display Test App" });
  assert(ElectronHost.mainWindow !== undefined);

  if (maximizeWindow) {
    ElectronHost.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    ElectronHost.mainWindow.show();
  }

  if (autoOpenDevTools)
    ElectronHost.mainWindow.webContents.toggleDevTools();

  // Monitor and save window size, position and maximized state changes
  mainWindowState.monitorWindowStateChanges(ElectronHost.mainWindow);

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

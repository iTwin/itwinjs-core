/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as url from "url";

import { Logger } from "@bentley/bentleyjs-core";
import { IModelReadRpcInterface, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";

// we 'require' rather than the import, because there's a bug in the .d.ts files for electron 1.16.1
// (WebviewTag incorrectly implement HTMLElement) that prevents us from compiling with the import.
// import { app, protocol, BrowserWindow } from "electron";
// tslint:disable-next-line:no-var-requires
const electron = require("electron");

// --------------------------------------------------------------------------------------
// -------------- This part copied from ProtogistBackend.ts ---------------------------
// Start the backend
IModelHost.startup();

Logger.initializeToConsole(); // configure logging for imodeljs-core

// --------------------------------------------------------------------------------------
// ---------------- This part copied from protogist ElectronMain.ts ---------------------
const isDevBuild = (process.env.NODE_ENV === "development");
let winRef: any;

function createWindow() {

  const win = new electron.BrowserWindow({
    webPreferences: {
      webSecurity: !isDevBuild, // Workaround for CORS issue in dev build
      experimentalFeatures: true, // Needed for CSS Grid support
    },
    autoHideMenuBar: true,
  });
  winRef = win;
  winRef.toggleDevTools();

  if (isDevBuild) {
    win.loadURL(url.format({
      pathname: "localhost:3000",
      protocol: "http:",
      slashes: true,
    }));
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, "public/index.html"),
      protocol: "file:",
      slashes: true,
    }));
  }

  win.on("closed", () => {
    winRef = null;
  });
}

electron.app.on("ready", () => {
  // Initialize application gateway configuration for the backend
  ElectronRpcManager.initializeImpl({}, [IModelReadRpcInterface]);

  createWindow();
});

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin")
    electron.app.quit();
});

// Handle custom keyboard shortcuts
electron.app.on("web-contents-created", (_e: any, wc: any) => {
  wc.on("before-input-event", (event: any, input: any) => {
    // CTRL + SHIFT + I  ==> Toggle DevTools
    if (input.key === "I" && input.control && !input.alt && !input.meta && input.shift) {
      if (winRef)
        winRef.toggleDevTools();

      event.preventDefault();
    }
  });
});

electron.app.on("activate", () => {
  if (winRef === null)
    createWindow();
});

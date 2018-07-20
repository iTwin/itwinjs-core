/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as url from "url";

import { ElectronRpcManager } from "@bentley/imodeljs-common/lib/common";
import { initializeBackend, getRpcInterfaces } from "./backend";

// we 'require' rather than the import, because there's a bug in the .d.ts files for electron 1.16.1
// (WebviewTag incorrectly implement HTMLElement) that prevents us from compiling with the import.
// import { app, protocol, BrowserWindow } from "electron";
// tslint:disable-next-line:no-var-requires
const electron = require("electron");

// --------------------------------------------------------------------------------------
// ------- Initialization and setup of host and tools before starting app ---------------

// Start the backend
initializeBackend();

// --------------------------------------------------------------------------------------
// ---------------- This part copied from protogist ElectronMain.ts ---------------------
const isDevBuild = (process.env.NODE_ENV === "development");
const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
let winRef: any;

function createWindow() {

  const win = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      webSecurity: !isDevBuild, // Workaround for CORS issue in dev build
      experimentalFeatures: true, // Needed for CSS Grid support
    },
    autoHideMenuBar: true,
  });
  winRef = win;
  if (autoOpenDevTools)
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
  ElectronRpcManager.initializeImpl({}, getRpcInterfaces());

  createWindow();
});

// tslint:disable-next-line:no-var-requires
const configuration = require(path.join(__dirname, "public", "configuration.json"));
if (configuration.useIModelBank) {
  electron.app.on("certificate-error", (event: any, _webContents: any, _url: string, _error: any, _certificate: any, callback: any) => {
    // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
    event.preventDefault();
    callback(true);
  });
}

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

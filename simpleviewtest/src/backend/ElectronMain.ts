/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import * as url from "url";

import { IModelReadRpcInterface, IModelTileRpcInterface, StandaloneIModelRpcInterface, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { Logger } from "@bentley/bentleyjs-core";

// we 'require' rather than the import, because there's a bug in the .d.ts files for electron 1.16.1
// (WebviewTag incorrectly implement HTMLElement) that prevents us from compiling with the import.
// import { app, protocol, BrowserWindow } from "electron";
// tslint:disable-next-line:no-var-requires
const electron = require("electron");

// Store SVT settings in the configuration.json file, which will be read by the application
const configuration = {
  userName: "bistroDEV_pmadm1@mailinator.com",
  password: "pmadm1",
  projectName: "plant-sta",
  iModelName: "NabeelQATestiModel",
};
const filename = process.env.SVT_STANDALONE_FILENAME;
if (filename !== undefined) {
  configuration.iModelName = filename;
  (configuration as any).viewName = process.env.SVT_STANDALONE_VIEWNAME;  // optional
  (configuration as any).standalone = true;
}
fs.writeFileSync("./lib/backend/public/configuration.json", JSON.stringify(configuration), "utf8");

// --------------------------------------------------------------------------------------
// ------- Initialization and setup of host and tools before starting app ---------------

// Start the backend
IModelHost.startup();

Logger.initializeToConsole(); // configure logging for imodeljs-core

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
  ElectronRpcManager.initializeImpl({}, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);

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

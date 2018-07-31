/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { app, protocol, BrowserWindow } from "electron";
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from "electron-devtools-installer";
import * as path from "path";
import * as url from "url";

import { IModelTileRpcInterface, IModelReadRpcInterface, ElectronRpcManager } from "@bentley/imodeljs-common";

// FIXME: I have to use require here because no type definitions are being published for this module:
// tslint:disable-next-line:no-var-requires
// const { GatewayRegistry } = require("@bentley/imodeljs-common/lib/gateway/core/GatewayRegistry");

const isDevBuild = (process.env.NODE_ENV === "development");
let winRef: any;

const iconPath = (isDevBuild) ? path.join(__dirname, "../public/appicon.ico") : path.join(__dirname, "public/appicon.ico");

function createWindow() {
  installExtension(REACT_DEVELOPER_TOOLS);
  installExtension(REDUX_DEVTOOLS);

  const win = new BrowserWindow({
    webPreferences: {
      webSecurity: !isDevBuild, // Workaround for CORS issue in dev build
      experimentalFeatures: true, // Needed for CSS Grid support
    },
    autoHideMenuBar: true,
    icon: iconPath,
  });
  winRef = win;

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

app.on("ready", () => {
  // Initialize application gateway configuration for the backend
  ElectronRpcManager.initializeImpl({}, [IModelTileRpcInterface, IModelReadRpcInterface]);

  createWindow();

  protocol.registerFileProtocol("electron", (request, callback) => {
    let assetPath = request.url.substr("electron://".length);
    assetPath = assetPath.replace(/#.*$/, "");
    callback(path.normalize(`${__dirname}/public/${assetPath}`));
  }, (error) => {
    if (error)
      // tslint:disable-next-line:no-console
      console.error("Failed to register protocol");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin")
    app.quit();
});

// Handle custom keyboard shortcuts
app.on("web-contents-created", (_e, wc) => {
  wc.on("before-input-event", (event, input) => {
    // CTRL + SHIFT + I  ==> Toggle DevTools
    if (input.key === "I" && input.control && !input.alt && !input.meta && input.shift) {
      if (winRef)
        winRef.toggleDevTools();

      event.preventDefault();
    }
  });
});

app.on("activate", () => {
  if (winRef === null)
    createWindow();
});

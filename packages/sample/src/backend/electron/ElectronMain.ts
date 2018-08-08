/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { app, protocol, BrowserWindow } from "electron";
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from "electron-devtools-installer";
import * as path from "path";
import * as url from "url";

// Initialize my application rpc configuration for the backend
import {
  ElectronRpcManager,
  StandaloneIModelRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface,
} from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Backend.Imports
import { PresentationRpcInterface } from "@bentley/presentation-common";
// __PUBLISH_EXTRACT_END__
import SampleRpcInterface from "../../common/SampleRpcInterface";

const otherRpcInterfaces = [StandaloneIModelRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface, SampleRpcInterface];
// __PUBLISH_EXTRACT_START__ Backend.Initialization.RpcInterface
ElectronRpcManager.initializeImpl({}, [...otherRpcInterfaces, PresentationRpcInterface]);
// __PUBLISH_EXTRACT_END__

const isDevBuild = (process.env.NODE_ENV === "development");
let winRef: any;

const iconPath = (isDevBuild) ? path.join(__dirname, "../public/appicon.ico") : path.join(__dirname, "public/appicon.ico");

function createWindow() {
  // tslint:disable:no-console
  installExtension(REACT_DEVELOPER_TOOLS);
    // .then((name) => console.log(`Added Extension:  ${name}`))
    // .catch((err) => console.log("An error occurred: ", err));

  installExtension(REDUX_DEVTOOLS);
    // .then((name) => console.log(`Added Extension:  ${name}`))
    // .catch((err) => console.log("An error occurred: ", err));
  // tslint:enable:no-console

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

app.on("ready", createWindow);

app.on("ready", () => {
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

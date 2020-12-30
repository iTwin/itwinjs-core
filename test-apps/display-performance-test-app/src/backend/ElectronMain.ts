/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as electron from "electron";
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { IModelJsElectronManager } from "@bentley/electron-manager";
import { ElectronRpcManager } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { getRpcInterfaces, initializeBackend } from "./backend";
import { BackendIpc } from "@bentley/imodeljs-backend";

const dptaElectronMain = async () => {

  // Start the backend
  await initializeBackend();

  if (process.argv.length > 2 && process.argv[2].split(".").pop() === "json")
    DisplayPerfRpcInterface.jsonFilePath = process.argv[2];

  const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
  const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW); // Make max window the default

  const manager = new IModelJsElectronManager({ webResourcesPath: path.join(__dirname, "..", "..", "build") });

  await manager.initialize({ width: 1280, height: 800, show: !maximizeWindow });
  assert(manager.mainWindow !== undefined);
  BackendIpc.initialize(manager);

  // Initialize rpcs for the backend
  ElectronRpcManager.initializeImpl({}, getRpcInterfaces(), manager);

  if (maximizeWindow) {
    manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    manager.mainWindow.show();
  }
  if (autoOpenDevTools)
    manager.mainWindow.webContents.toggleDevTools();

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
};

// execute this immediately when we load
dptaElectronMain(); // eslint-disable-line @typescript-eslint/no-floating-promises

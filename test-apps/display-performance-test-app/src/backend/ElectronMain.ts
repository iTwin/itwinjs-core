/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { getRpcInterfaces, initializeBackend } from "./backend";
import { ElectronBackend } from "@bentley/electron-manager/lib/ElectronBackend";

const dptaElectronMain = async () => {

  const manager = ElectronBackend.initialize({ webResourcesPath: path.join(__dirname, "..", "..", "build"), rpcInterfaces: getRpcInterfaces() });

  // Start the backend
  await initializeBackend();

  if (process.argv.length > 2 && process.argv[2].split(".").pop() === "json")
    DisplayPerfRpcInterface.jsonFilePath = process.argv[2];

  const autoOpenDevTools = (undefined === process.env.SVT_NO_DEV_TOOLS);
  const maximizeWindow = (undefined === process.env.SVT_NO_MAXIMIZE_WINDOW); // Make max window the default

  await manager.openMainWindow({ width: 1280, height: 800, show: !maximizeWindow });
  assert(manager.mainWindow !== undefined);

  if (maximizeWindow) {
    manager.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    manager.mainWindow.show();
  }
  if (autoOpenDevTools)
    manager.mainWindow.webContents.toggleDevTools();

  // Handle custom keyboard shortcuts
  manager.app.on("web-contents-created", (_e, wc) => {
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

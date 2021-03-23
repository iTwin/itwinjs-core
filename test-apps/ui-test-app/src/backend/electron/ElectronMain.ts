/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronHost, ElectronHostOptions, ElectronWindowState } from "@bentley/electron-manager/lib/ElectronBackend";
import { getSupportedRpcs } from "../../common/rpcs";
import { BasicManipulationCommand, EditCommandAdmin } from "@bentley/imodeljs-editor-backend";

// cSpell:ignore testapp unmaximize

/**
 * Initializes Electron backend
 */
const autoOpenDevTools = (undefined === process.env.imjs_TESTAPP_NO_DEV_TOOLS);
const maximizeWindowConfig = (undefined !== process.env.imjs_TESTAPP_MAXIMIZE_WINDOW);
const windowTitle = "Ui Test App";
const storageName = "ui-test-app";
const defaultWidth = 1280;
const defaultHeight = 1024;
let mainWindowState: ElectronWindowState;

export async function initializeElectron() {
  const electronHost: ElectronHostOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
    rpcInterfaces: getSupportedRpcs(),
    developmentServer: process.env.NODE_ENV === "development",
  };

  await ElectronHost.startup({ electronHost });
  EditCommandAdmin.register(BasicManipulationCommand);

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

  // Restore previous window size, position and maximized state
  mainWindowState = new ElectronWindowState(storageName, defaultWidth, defaultHeight, false);
  const sizeAndPosition = mainWindowState.getPreviousSizeAndPosition();
  const maximizeWindow = maximizeWindowConfig || mainWindowState.getPreviousMaximizedState();

  await ElectronHost.openMainWindow({ ...sizeAndPosition, show: !maximizeWindow, title: windowTitle });
  assert(ElectronHost.mainWindow !== undefined);

  if (maximizeWindow) {
    ElectronHost.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    ElectronHost.mainWindow.show();
  }

  if (autoOpenDevTools)
    ElectronHost.mainWindow.webContents.toggleDevTools();

  // Monitor window state changes and save window size, position and maximized
  mainWindowState.monitorWindowStateChanges(ElectronHost.mainWindow);
}

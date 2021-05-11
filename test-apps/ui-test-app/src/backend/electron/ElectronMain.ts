/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { assert } from "@bentley/bentleyjs-core";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
import { BasicManipulationCommand, EditCommandAdmin } from "@bentley/imodeljs-editor-backend";
import { getSupportedRpcs } from "../../common/rpcs";

const mainWindowName = "mainWindow";

/** Initializes Electron backend */
export async function initializeElectron() {

  const opt = {
    electronHost: {
      webResourcesPath: join(__dirname, "..", "..", "..", "build"),
      developmentServer: process.env.NODE_ENV === "development",
      rpcInterfaces: getSupportedRpcs(),
    },
    nativeHost: {
      applicationName: "ui-test-app",
    },
  };

  await ElectronHost.startup(opt);
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
  const sizeAndPosition = ElectronHost.getWindowSizeSetting(mainWindowName);
  const maximizeWindow = undefined === sizeAndPosition || ElectronHost.getWindowMaximizedSetting(mainWindowName);

  await ElectronHost.openMainWindow({ ...sizeAndPosition, show: !maximizeWindow, title: "Ui Test App", storeWindowName: mainWindowName });
  assert(ElectronHost.mainWindow !== undefined);

  if (maximizeWindow) {
    ElectronHost.mainWindow.maximize(); // maximize before showing to avoid resize event on startup
    ElectronHost.mainWindow.show();
  }

  if ((undefined === process.env.imjs_TESTAPP_NO_DEV_TOOLS))
    ElectronHost.mainWindow.webContents.toggleDevTools();
}

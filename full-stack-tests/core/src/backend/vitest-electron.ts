/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ipcMain } from "electron";
import { ElectronHost } from "@itwin/core-electron/main";
import { installElectronFrameRouting } from "@itwin/vitest-browser-bridge/electron/frame-routing";

installElectronFrameRouting(
  ipcMain,
  () => ElectronHost.electron?.BrowserWindow.getAllWindows().map((window) => window.webContents) ?? [],
);

// Install routing before backend startup registers its IPC handlers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = require("./backend") as Promise<(() => Promise<void>) | undefined>;

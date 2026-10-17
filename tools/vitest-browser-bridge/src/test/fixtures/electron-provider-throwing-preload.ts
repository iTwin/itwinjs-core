/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { contextBridge } from "electron";

// Expose the expected global before throwing, so tests that only check the global would still pass.
contextBridge.exposeInMainWorld("__vitestBrowserBridgeUserPreload", {
  loaded: true,
  processType: process.type,
});
throw new Error("intentional preload failure");

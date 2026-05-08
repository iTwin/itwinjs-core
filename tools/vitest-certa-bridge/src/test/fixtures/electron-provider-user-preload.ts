/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("__electronProviderUserPreload", {
  loaded: true,
  processType: process.type,
});

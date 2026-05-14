/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { app } from "electron";
import { registerBackendCallback } from "../../index";

export = function initElectronProviderBackendSmoke() {
  registerBackendCallback("electron-provider:add", (a: number, b: number) => a + b);
  registerBackendCallback("electron-provider:asyncEcho", async (value: string) => ({ echoed: value }));
  registerBackendCallback("electron-provider:mainProcessInfo", () => ({
    appReady: app.isReady(),
    electronVersion: process.versions.electron,
    processType: process.type,
  }));
};

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { clearBackendCallbacks, dispatchBackendCallback } from "./backend.js";
import {
  CALLBACK_BRIDGE_GLOBAL,
  CALLBACK_CHANNEL,
  CALLBACK_METHOD,
} from "./protocol.js";

/** The small part of Electron's ipcMain API required by the test-only callback handler.
 * @internal
 */
export interface IpcMainCallbackHost {
  handle(channel: string, listener: (event: unknown, payload: unknown) => Promise<unknown>): void;
  removeHandler(channel: string): void;
}

/** Options used to compose the generated preload script.
 * @internal
 */
export interface ElectronPreloadCompositionOptions {
  /** Optional absolute path to a consumer preload loaded before the callback bridge. */
  readonly userPreloadModule?: string;
  /** Per-provider-session token closed over by the generated preload. */
  readonly token: string;
  /** Override the callback channel only for focused transport tests. */
  readonly channel?: string;
}

/** Install the token-validated callback handler and return its idempotent teardown function.
 * @internal
 */
export function installElectronCallbackHandler(ipcMain: IpcMainCallbackHost, token: string, channel = CALLBACK_CHANNEL): () => void {
  let disposed = false;
  ipcMain.handle(channel, async (_event, payload) => dispatchBackendCallback(payload, token));

  return () => {
    if (disposed)
      return;
    disposed = true;
    ipcMain.removeHandler(channel);
    clearBackendCallbacks();
  };
}

/** Compose a preload that preserves a consumer preload and adds only the test callback bridge.
 * @internal
 */
export function composeElectronPreloadSource(options: ElectronPreloadCompositionOptions): string {
  if (typeof options.token !== "string" || options.token.length === 0)
    throw new Error("Callback token must be a non-empty string.");

  const channel = options.channel ?? CALLBACK_CHANNEL;
  const userPreload = options.userPreloadModule === undefined
    ? ""
    : `\nrequire(${JSON.stringify(options.userPreloadModule)});`;

  return `"use strict";\nconst { contextBridge, ipcRenderer } = require("electron");${userPreload}\nconst callbackBridge = Object.freeze({\n  invoke: (invocation) => ipcRenderer.invoke(${JSON.stringify(channel)}, {\n    method: invocation && invocation.method,\n    name: invocation && invocation.name,\n    args: invocation && invocation.args,\n    token: ${JSON.stringify(options.token)},\n  }),\n});\ncontextBridge.exposeInMainWorld(${JSON.stringify(CALLBACK_BRIDGE_GLOBAL)}, callbackBridge);\n// ${CALLBACK_METHOD} is validated by the main-process protocol.\n`;
}

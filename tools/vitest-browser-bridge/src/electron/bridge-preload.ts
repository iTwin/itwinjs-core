/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { contextBridge, ipcRenderer } from "electron";
import type * as protocol from "../callbacks/protocol.js";

// Sandboxed preloads can only require Electron and a few Node built-ins, not local modules, so the
// protocol constants are repeated here. Their types tie them to protocol.ts: a mismatch fails to compile.
const CALLBACK_CHANNEL: typeof protocol.CALLBACK_CHANNEL = "vitest-browser-bridge:callback";
const CALLBACK_BRIDGE_GLOBAL: typeof protocol.CALLBACK_BRIDGE_GLOBAL = "__vitestCallbackBridge";

const callbackBridge = Object.freeze({
  invoke: async (request: protocol.CallbackRequest) => ipcRenderer.invoke(CALLBACK_CHANNEL, request),
});

contextBridge.exposeInMainWorld(CALLBACK_BRIDGE_GLOBAL, callbackBridge);

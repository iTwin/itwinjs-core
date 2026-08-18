/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { contextBridge, ipcRenderer } from "electron";
import {
  CALLBACK_BRIDGE_GLOBAL,
  CALLBACK_CHANNEL,
  type CallbackRequest,
} from "../callbacks/protocol.js";

const callbackBridge = Object.freeze({
  invoke: async (request: CallbackRequest) => ipcRenderer.invoke(CALLBACK_CHANNEL, request),
});

contextBridge.exposeInMainWorld(CALLBACK_BRIDGE_GLOBAL, callbackBridge);

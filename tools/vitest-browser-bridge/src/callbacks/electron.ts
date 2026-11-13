/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { dispatchBackendCallback } from "./backend.js";
import { CALLBACK_CHANNEL, type CallbackResponse } from "./protocol.js";

interface IpcMainCallbackEvent {
  readonly sender: {
    readonly id: number;
  };
}

/** The small part of Electron's ipcMain API required by the test-only callback handler. */
interface IpcMainCallbackHost {
  handle(channel: string, listener: (event: IpcMainCallbackEvent, payload: unknown) => Promise<unknown>): void;
  removeHandler(channel: string): void;
}

/** Install the callback handler for the provider-owned browser window.
 * @internal
 */
export function installElectronCallbackHandler(
  ipcMain: IpcMainCallbackHost,
  expectedSenderId: number,
): () => void {
  let disposed = false;
  ipcMain.handle(CALLBACK_CHANNEL, async (event, payload) => {
    if (event.sender.id !== expectedSenderId)
      throw new Error("Callback request came from an unexpected Electron browser window.");
    return ensureCloneable(await dispatchBackendCallback(payload));
  });

  return () => {
    if (disposed)
      return;
    disposed = true;
    ipcMain.removeHandler(CALLBACK_CHANNEL);
  };
}

/** Electron copies IPC replies with the structured clone algorithm. Check the result here so a value it
 * cannot copy, such as a function, becomes an ordinary callback failure instead of an opaque IPC error.
 */
function ensureCloneable(response: CallbackResponse): CallbackResponse {
  if (!response.ok)
    return response;
  try {
    structuredClone(response.value);
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { message: `Backend callback result cannot be sent over Electron IPC: ${reason}` } };
  }
}

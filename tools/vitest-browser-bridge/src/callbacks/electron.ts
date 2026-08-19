/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { dispatchBackendCallback } from "./backend.js";
import { CALLBACK_CHANNEL } from "./protocol.js";

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

/** Install the callback handler for one provider-owned WebContents.
 * @internal
 */
export function installElectronCallbackHandler(
  ipcMain: IpcMainCallbackHost,
  expectedWebContentsId: number,
): () => void {
  let disposed = false;
  ipcMain.handle(CALLBACK_CHANNEL, async (event, payload) => {
    if (event.sender.id !== expectedWebContentsId)
      throw new Error("Callback request came from an unexpected Electron WebContents.");
    return dispatchBackendCallback(payload);
  });

  return () => {
    if (disposed)
      return;
    disposed = true;
    ipcMain.removeHandler(CALLBACK_CHANNEL);
  };
}

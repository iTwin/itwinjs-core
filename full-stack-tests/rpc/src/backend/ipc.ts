/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { IpcWebSocketBackend, iTwinChannel } from "@itwin/core-common";
import { BackendTestCallbacks } from "../common/SideChannels";

export async function setupIpcTest(before = async () => { }) {
  let socket: IpcWebSocketBackend;
  let ready: () => void;
  const started = new Promise<void>((resolve) => ready = resolve);

  registerBackendCallback(BackendTestCallbacks.startIpcTest, () => {
    setTimeout(async () => {
      await before();
      socket = new IpcWebSocketBackend();

      socket.addListener("test", (_evt: Event, ...arg: any[]) => {
        if (arg[0] !== 1 || arg[1] !== 2 || arg[2] !== 3) {
          throw new Error("failed");
        }
      });

      socket.handle("testinvoke", async (_event: Event, methodName: string, ...args: any[]) => {
        return [methodName, ...args];
      });

      socket.handle(iTwinChannel("ipc-app"), async (_event: Event, _methodName: string, ..._args: any[]) => {
        return { result: undefined };
      });

      socket.handle(iTwinChannel("nativeApp"), async (_event: Event, methodName: string, ..._args: any[]) => {
        return { result: (methodName === "initializeAuth") ? 0 : {} };
      });

      ready();
    });

    return true;
  });

  registerBackendCallback(BackendTestCallbacks.sendIpcMessage, async () => {
    await started;
    socket.send("test", 4, 5, 6);
    return true;
  });
}

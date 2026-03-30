/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { IpcHost } from "@itwin/core-backend";
import { IpcWebSocketBackend, iTwinChannel } from "@itwin/core-common";
import { BackendTestCallbacks } from "../common/SideChannels";

function orderTest(socket: { handle(channel: string, listener: (event: any, ...args: any[]) => Promise<any>): void }) {
  socket.handle("a", async (_event: Event, methodName: string, ..._args: any[]) => {
    return [methodName, "a"];
  });

  socket.handle("b", async (_event: Event, methodName: string, ..._args: any[]) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([methodName, "b"]), 1000);
    });
  });

  socket.handle("c", async (_event: Event, methodName: string, ..._args: any[]) => {
    return [methodName, "c"];
  });
}

export function setupIpcTestElectron() {
  orderTest(require("electron").ipcMain); // eslint-disable-line @typescript-eslint/no-require-imports

  // Return immediately and deliver result on responseChannel to avoid deadlocks
  registerBackendCallback(BackendTestCallbacks.invokeIpcApp, (channel: string, responseChannel: string, ...args: any[]) => {
    void IpcHost.invoke(channel, ...args)
      .then((result) => IpcHost.send(responseChannel, { result }))
      .catch((error: unknown) => IpcHost.send(responseChannel, { error }));
    return true;
  });
}

export async function setupIpcTest(before = async () => { }, socketOverride?: IpcWebSocketBackend) {
  let socket: IpcWebSocketBackend;
  let ready: () => void;
  const started = new Promise<void>((resolve) => ready = resolve);

  registerBackendCallback(BackendTestCallbacks.startIpcTest, () => {
    setTimeout(async () => {
      await before();
      socket = socketOverride || (new IpcWebSocketBackend());

      socket.addListener("test", (_evt: Event, ...arg: any[]) => {
        if (arg[0] !== 1 || arg[1] !== 2 || arg[2] !== 3) {
          throw new Error("failed");
        }
      });

      socket.handle("testinvoke", async (_event: Event, methodName: string, ...args: any[]) => {
        return [methodName, ...args];
      });

      orderTest(socket);

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

  // WebSocket Certa callbacks use HTTP, so we can await IpcHost.invoke directly.
  registerBackendCallback(BackendTestCallbacks.invokeIpcApp, async (channel: string, ...args: any[]) => {
    return IpcHost.invoke(channel, ...args);
  });
}

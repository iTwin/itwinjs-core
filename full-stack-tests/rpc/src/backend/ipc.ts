/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { IpcWebSocketBackend } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";

export async function setupIpcTest(before = async () => { }) {
  let socket: IpcWebSocketBackend;

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
    });

    return true;
  });

  registerBackendCallback(BackendTestCallbacks.sendIpcMessage, () => {
    socket.send("test", 4, 5, 6);
    return true;
  });
}

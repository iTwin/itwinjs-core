/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { IpcListener, IpcSocket } from "@itwin/core-common";
import { ElectronRpcProtocol } from "../../common/ElectronRpcProtocol";
import { FrontendIpcTransport } from "../../common/ElectronIpcTransport";
import type { TestSuite } from "./ElectronBackendTests";

const OBJECTS_CHANNEL = "itwin.rpc.objects";

export const electronIpcTransportTestSuite: TestSuite = {
  title: "ElectronIpcTransport tests.",
  tests: [
    {
      title: "Should ignore a response after its request was removed during shutdown.",
      func: testLateResponseAfterShutdown,
    },
  ],
};

async function testLateResponseAfterShutdown() {
  const listeners = new Map<string, IpcListener>();
  const socket: IpcSocket = {
    send: () => undefined,
    addListener: (channel, listener) => {
      listeners.set(channel, listener);
      return () => listeners.delete(channel);
    },
    removeListener: (channel, listener) => {
      if (listeners.get(channel) === listener)
        listeners.delete(channel);
    },
  };
  // A real ElectronRpcProtocol would register itself as the module-wide transport singleton. The
  // transport only reads these two members, so a stub of exactly that surface keeps the test isolated.
  const protocol: Pick<ElectronRpcProtocol, "ipcSocket" | "requests"> = { ipcSocket: socket, requests: new Map() };
  new FrontendIpcTransport(protocol as ElectronRpcProtocol);
  const objectsListener = listeners.get(OBJECTS_CHANNEL);
  if (!objectsListener)
    throw new Error(`No listener registered for ${OBJECTS_CHANNEL}`);

  const response = {
    id: "late-response",
    interfaceName: "test",
    result: { data: [] },
    rawResult: undefined,
    status: 0,
  };

  // The transport dispatches the response without awaiting it, so a failure surfaces as an unhandled
  // rejection rather than propagating out of the listener.
  const rejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", onUnhandledRejection);
  try {
    // The request map is empty, as it is after ElectronApp.shutdown() disposes requests.
    objectsListener(new Event("ipc"), response);
    await BeDuration.wait(1); // give Node a turn to report an unhandled rejection
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
  }

  assert.deepEqual(rejections, []);
}

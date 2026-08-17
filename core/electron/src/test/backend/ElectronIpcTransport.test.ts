/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IpcListener, IpcSocket } from "@itwin/core-common";
import { ElectronRpcProtocol } from "../../common/ElectronRpcProtocol";
import { FrontendIpcTransport } from "../../common/ElectronIpcTransport";
import type { TestSuite } from "./ElectronBackendTests";

const OBJECTS_CHANNEL = "itwin.rpc.objects";

class TestFrontendIpcTransport extends FrontendIpcTransport {
  private _completion?: Promise<void>;

  protected override async handleComplete(id: string) {
    this._completion = super.handleComplete(id);
    // Keep the rejected promise observable through waitForCompletion without making it unhandled.
    await this._completion.catch(() => undefined);
  }

  public async waitForCompletion() {
    const completion = this._completion;
    if (!completion)
      throw new Error("The transport did not complete the response.");

    await completion;
  }
}

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
  const protocol = { ipcSocket: socket, requests: new Map() } as unknown as ElectronRpcProtocol;
  const transport = new TestFrontendIpcTransport(protocol);
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
  objectsListener(undefined as any, response);

  // The request map is empty, as it is after ElectronApp.shutdown() disposes requests.
  assert.isUndefined(protocol.requests.get(response.id));
  await transport.waitForCompletion();
}

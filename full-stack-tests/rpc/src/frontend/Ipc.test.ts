/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { IpcWebSocketFrontend } from "@itwin/core-common";
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";

function orderTest(
  it: Mocha.TestFunction,
  socketSource: () => { invoke(channel: string, ...args: any[]): Promise<any> }
) {
  async function onResponse(request: Promise<any>, responses: string[]) {
    const data = await request;
    responses.push(data[0]);
  }

  it("should preserve order", async () => {
    const socket = socketSource();

    const responses: string[] = [];

    const a = socket.invoke("a", "a");
    const b = socket.invoke("b", "b");
    const c = socket.invoke("c", "c");

    onResponse(a, responses); // eslint-disable-line @typescript-eslint/no-floating-promises
    onResponse(b, responses); // eslint-disable-line @typescript-eslint/no-floating-promises
    onResponse(c, responses); // eslint-disable-line @typescript-eslint/no-floating-promises

    await Promise.all([a, b, c]);
    assert.deepEqual(responses, ["a", "c", "b"]);
  });
}

if (ProcessDetector.isElectronAppFrontend) {
  describe("ElectronIpc", () => {
    orderTest(it, () => require("electron").ipcRenderer); // eslint-disable-line @typescript-eslint/no-var-requires
  });
} else {
  describe("IpcWebSocket", () => {
    let socket: IpcWebSocketFrontend;

    before(async () => {
      assert(await executeBackendCallback(BackendTestCallbacks.startIpcTest));
      socket = new IpcWebSocketFrontend();
    });

    it("should support send/receive", async () => {
      return new Promise(async (resolve) => {
        socket.addListener("test", (_evt: Event, ...arg: any[]) => {
          assert.equal(arg[0], 4);
          assert.equal(arg[1], 5);
          assert.equal(arg[2], 6);
          resolve();
        });

        socket.send("test", 1, 2, 3);

        assert(
          await executeBackendCallback(BackendTestCallbacks.sendIpcMessage)
        );
      });
    });

    it("should support invoke", async () => {
      return new Promise(async (resolve) => {
        const invoked = await socket.invoke("testinvoke", "hi", 1, 2, 3);
        assert.equal(invoked[0], "hi");
        assert.equal(invoked[1], 1);
        assert.equal(invoked[2], 2);
        assert.equal(invoked[3], 3);
        resolve();
      });
    });

    orderTest(it, () => socket);
  });
}

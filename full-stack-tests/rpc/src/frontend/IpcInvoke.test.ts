/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { IpcApp } from "@itwin/core-frontend";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";
import { currentEnvironment } from "./_Setup.test";
import type { IpcInvokeReturn } from "@itwin/core-common";

if (ProcessDetector.isElectronAppFrontend) {
  describe("IpcApp/IpcHost (Electron)", () => {
    before(() => {
      assert.isTrue(IpcApp.isValid, "Expected IpcApp to be initialized by ElectronApp");
    });

    it("can handle invoke", async () => {
      const remove = IpcApp.handle("ipc-app-handle-test", async (msg: string) => `pong:${msg}`);
      try {
        const response = new Promise<IpcInvokeReturn>((resolve) => {
          const off = IpcApp.addListener("test-result-channel", (_e, r: IpcInvokeReturn) => { off(); resolve(r); });
        });
        await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-handle-test", "test-result-channel", "ping");
        assert.equal((await response).result, "pong:ping");
      } finally {
        remove();
      }
    });
  });
} else {
  describe("IpcApp/IpcHost (WebSocket)", () => {
    before(async () => {
      assert.equal(currentEnvironment, "websocket");
      assert(await executeBackendCallback(BackendTestCallbacks.startIpcTest));
      assert.isTrue(IpcApp.isValid, "Expected IpcApp to be initialized by LocalhostIpcApp");
    });

    it("can handle invoke", async () => {
      const remove = IpcApp.handle("ipc-app-handle-test", async (msg: string) => `pong:${msg}`);
      try {
        const result = await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-handle-test", "ping");
        assert.equal(result, "pong:ping");
      } finally {
        remove();
      }
    });
  });
}

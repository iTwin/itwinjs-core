/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, IModelStatus, ITwinError, ProcessDetector } from "@itwin/core-bentley";
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { IpcApp, IpcHandler } from "@itwin/core-frontend";
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

    describe("forwards frontend-thrown error details to backend", () => {
      interface MyITwinError extends ITwinError {
        foo: number;
        nested: { bar: string };
      }

      class TestErrorIpcHandler extends IpcHandler {
        public get channelName() { return "ipc-app-error-forwarding-test"; }

        // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
        public async throwDumbString() { throw "failed"; }
        // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
        public async throwDumbObj() { throw { error: "failed" }; }
        public async throwBasicError() { throw new Error("basic"); }
        public async throwITwinBasic() { throw ITwinError.create({ iTwinErrorId: { scope: "s", key: "k" }, message: "m" }); }
        public async throwITwinCustom() {
          throw ITwinError.create<MyITwinError>({ iTwinErrorId: { scope: "s", key: "k" }, message: "m", foo: 42, nested: { bar: "bar" } });
        }
        public async throwBentleyError() {
          throw new BentleyError(IModelStatus.NotFound, "m", () => ({ foo: 42, nested: { bar: "bar" } }));
        }
      }

      let remove: (() => void) | undefined;

      before(() => {
        remove = TestErrorIpcHandler.register();
      });

      after(() => {
        remove?.();
      });

      const invokeAndGetError = async (methodName: string) => {
        const responseChannel = `test-error-result-channel-${methodName}`;
        const response = new Promise<IpcInvokeReturn>((resolve) => {
          const off = IpcApp.addListener(responseChannel, (_e, r: IpcInvokeReturn) => { off(); resolve(r); });
        });

        await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-error-forwarding-test", responseChannel, methodName);
        const callbackResult = await response as any;
        assert.exists(callbackResult.result);
        assert.exists(callbackResult.result.error);
        return callbackResult.result.error;
      };

      it("forwards thrown string", async () => {
        assert.equal(await invokeAndGetError("throwDumbString"), "failed");
      });

      it("forwards thrown object", async () => {
        const dumbObj = await invokeAndGetError("throwDumbObj");
        assert.equal(dumbObj.error, "failed");
      });

      it("forwards Error message and stack", async () => {
        const basic = await invokeAndGetError("throwBasicError");
        assert.equal(basic.message, "basic");
        assert.isString(basic.stack);
      });

      it("forwards ITwinError identity", async () => {
        const itwinBasic = await invokeAndGetError("throwITwinBasic");
        assert.equal(itwinBasic.message, "m");
        assert.isTrue(ITwinError.isError(itwinBasic, "s", "k"));
      });

      it("forwards custom ITwinError fields", async () => {
        const itwinCustom = await invokeAndGetError("throwITwinCustom") as MyITwinError;
        assert.equal(itwinCustom.message, "m");
        assert.isTrue(ITwinError.isError<MyITwinError>(itwinCustom, "s", "k"));
        assert.equal(itwinCustom.foo, 42);
        assert.deepEqual(itwinCustom.nested, { bar: "bar" });
      });

      it("forwards BentleyError metadata", async () => {
        const bentley = await invokeAndGetError("throwBentleyError");
        assert.equal(bentley.message, "m");
        assert.isTrue(BentleyError.isError(bentley, IModelStatus.NotFound));
        assert.deepEqual(bentley.loggingMetadata, { foo: 42, nested: { bar: "bar" } });
      });
    });
  });
} else {
  describe("IpcApp/IpcHost (WebSocket)", () => {
    const isWebsocketEnvironment = () => currentEnvironment === "websocket";

    before(async () => {
      if (!isWebsocketEnvironment())
        return;

      assert(await executeBackendCallback(BackendTestCallbacks.startIpcTest));
      assert.isTrue(IpcApp.isValid, "Expected IpcApp to be initialized by LocalhostIpcApp");
    });

    it("websocket invoke is not applicable outside websocket mode", () => {
      if (isWebsocketEnvironment())
        return;

      assert.notEqual(currentEnvironment, "websocket");
    });

    it("can handle invoke in websocket mode", async () => {
      if (!isWebsocketEnvironment())
        return;

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

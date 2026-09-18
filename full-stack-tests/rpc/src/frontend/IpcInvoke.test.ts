/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, IModelStatus, ITwinError, ProcessDetector } from "@itwin/core-bentley";
import { executeBackendCallback } from "./executeBackendCallback";
import { IpcApp, IpcHandler } from "@itwin/core-frontend";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";
import { currentEnvironment } from "./testSetup";
import type { IpcInvokeReturn } from "@itwin/core-common";
import { afterAll, beforeAll } from "vitest";

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

interface IpcInvokeAdapter {
  registerErrorHandler(): () => void;
  invokeError(methodName: string): Promise<any>;
  invokeProxyError(methodName: string): Promise<any>;
}

function addErrorForwardingTests(adapter: IpcInvokeAdapter) {
  describe("forwards frontend-thrown error details to backend", () => {
    let remove: (() => void) | undefined;

    beforeAll(() => {
      remove = adapter.registerErrorHandler();
    });

    afterAll(() => {
      remove?.();
    });

    it("forwards thrown string", async () => {
      assert.equal(await adapter.invokeError("throwDumbString"), "failed");
    });

    it("forwards thrown object", async () => {
      const dumbObj = await adapter.invokeError("throwDumbObj");
      assert.equal(dumbObj.error, "failed");
    });

    it("forwards Error message and stack", async () => {
      const basic = await adapter.invokeError("throwBasicError");
      assert.equal(basic.message, "basic");
      assert.isString(basic.stack);
    });

    it("forwards ITwinError identity", async () => {
      const itwinBasic = await adapter.invokeError("throwITwinBasic");
      assert.equal(itwinBasic.message, "m");
      assert.isTrue(ITwinError.isError(itwinBasic, "s", "k"));
    });

    it("forwards custom ITwinError fields", async () => {
      const itwinCustom = await adapter.invokeError("throwITwinCustom") as MyITwinError;
      assert.equal(itwinCustom.message, "m");
      assert.isTrue(ITwinError.isError<MyITwinError>(itwinCustom, "s", "k"));
      assert.equal(itwinCustom.foo, 42);
      assert.deepEqual(itwinCustom.nested, { bar: "bar" });
    });

    it("forwards BentleyError metadata", async () => {
      const bentley = await adapter.invokeError("throwBentleyError");
      assert.equal(bentley.message, "m");
      assert.isTrue(BentleyError.isError(bentley, IModelStatus.NotFound));
      assert.deepEqual(bentley.loggingMetadata, { foo: 42, nested: { bar: "bar" } });
    });

    it("backend proxy rebuilds a typed BentleyError with metadata", async () => {
      const info = await adapter.invokeProxyError("throwBentleyError");
      assert.isTrue(info.isBentleyError, "backend should rebuild a BentleyError");
      assert.isTrue(info.isITwinError, "backend should rebuild an error identifiable via ITwinError.isError");
      assert.equal(info.errorNumber, IModelStatus.NotFound);
      assert.equal(info.message, "m");
      assert.deepEqual(info.loggingMetadata, { foo: 42, nested: { bar: "bar" } });
    });

    it("backend proxy rebuilds a plain Error for a non-BentleyError", async () => {
      const info = await adapter.invokeProxyError("throwBasicError");
      assert.isFalse(info.isBentleyError, "a basic Error must not be rebuilt as a BentleyError");
      assert.equal(info.message, "basic");
    });
  });
}

if (ProcessDetector.isElectronAppFrontend) {
  describe("IpcApp/IpcHost (Electron)", () => {
    beforeAll(() => {
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

    addErrorForwardingTests({
      registerErrorHandler: () => TestErrorIpcHandler.register(),
      invokeError: async (methodName) => {
        const responseChannel = `test-error-result-channel-${methodName}`;
        const response = new Promise<IpcInvokeReturn>((resolve) => {
          const off = IpcApp.addListener(responseChannel, (_e, r: IpcInvokeReturn) => { off(); resolve(r); });
        });

        await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-error-forwarding-test", responseChannel, methodName);
        const callbackResult = await response as any;
        assert.exists(callbackResult.result);
        assert.exists(callbackResult.result.error);
        return callbackResult.result.error;
      },
      invokeProxyError: async (methodName) => {
        const responseChannel = `test-proxy-error-channel-${methodName}`;
        const response = new Promise<any>((resolve) => {
          const off = IpcApp.addListener(responseChannel, (_e, r: any) => { off(); resolve(r); });
        });

        await executeBackendCallback(BackendTestCallbacks.invokeIpcAppProxy, "ipc-app-error-forwarding-test", responseChannel, methodName);
        const callbackResult = await response;
        assert.isFalse(callbackResult.ok, "expected the proxy call to reject on the backend");
        return callbackResult.errorInfo;
      },
    });
  });
} else {
  describe("IpcApp/IpcHost (WebSocket)", () => {
    beforeAll(async () => {
      assert.equal(currentEnvironment, "websocket");
      assert(await executeBackendCallback(BackendTestCallbacks.startIpcTest));
      assert.isTrue(IpcApp.isValid, "Expected IpcApp to be initialized by LocalhostIpcApp");
    });

    it("can handle invoke in websocket mode", async () => {
      const remove = IpcApp.handle("ipc-app-handle-test", async (msg: string) => `pong:${msg}`);
      try {
        const result = await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-handle-test", "ping");
        assert.equal(result, "pong:ping");
      } finally {
        remove();
      }
    });

    it("can invoke via makeIpcProxy in websocket mode", async () => {
      class WsHandler extends IpcHandler {
        public get channelName() { return "ipc-app-proxy-test"; }
        public async echo(msg: string) { return `pong:${msg}`; }
      }
      const remove = WsHandler.register();
      try {
        const callbackResult = JSON.parse(await executeBackendCallback(BackendTestCallbacks.invokeIpcAppProxy, "ipc-app-proxy-test", "echo", "ping") as string);
        assert.isTrue(callbackResult.ok);
        assert.equal(callbackResult.result, "pong:ping");
      } finally {
        remove();
      }
    });

    addErrorForwardingTests({
      registerErrorHandler: () => TestErrorIpcHandler.register(),
      invokeError: async (methodName) => {
        const callbackResult = await executeBackendCallback(BackendTestCallbacks.invokeIpcApp, "ipc-app-error-forwarding-test", methodName);
        assert.exists(callbackResult.error, "expected the invoke to resolve with a serialized error envelope");
        return callbackResult.error;
      },
      invokeProxyError: async (methodName) => {
        const callbackResult = JSON.parse(await executeBackendCallback(BackendTestCallbacks.invokeIpcAppProxy, "ipc-app-error-forwarding-test", methodName) as string);
        assert.isFalse(callbackResult.ok, "expected the proxy call to reject on the backend");
        return callbackResult.errorInfo;
      },
    });
  });
}

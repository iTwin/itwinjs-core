/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BentleyError, IModelStatus } from "@itwin/core-bentley";
import { BackendError, IpcInvokeReturn, serializeIpcError } from "@itwin/core-common";
import { IpcApp, IpcHandler } from "../IpcApp";

interface MockIpcInterface {
  mockMethod: () => Promise<string>;
  echo: (a: string, b: number) => Promise<string>;
  throwPlainError: () => Promise<never>;
  throwBentleyError: () => Promise<never>;
}

class MockIpcHandler extends IpcHandler implements MockIpcInterface {
  public override get channelName() { return "mock-channel"; }

  public async mockMethod(): Promise<string> {
    return "mock-value";
  }
  public async echo(a: string, b: number): Promise<string> {
    return `${a}:${b}`;
  }
  public async throwPlainError(): Promise<never> {
    throw new Error("plain failure");
  }
  public async throwBentleyError(): Promise<never> {
    throw new BentleyError(IModelStatus.NotFound, "boom", () => ({ detail: 42 }));
  }

  async #privateFunction(): Promise<void> { }
}

describe("IpcApp", () => {
  let socket: {
    send: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    invoke: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    socket = {
      send: vi.fn(),
      addListener: vi.fn().mockReturnValue(() => { }),
      removeListener: vi.fn(),
      invoke: vi.fn(),
    };
    (IpcApp as any)._ipc = socket; // inject the mock socket without a full IModelApp startup
  });

  afterEach(() => {
    (IpcApp as any)._ipc = undefined;
    vi.restoreAllMocks();
  });

  describe("handle", () => {
    it("registers a listener on the iTwinChannel-prefixed channel", () => {
      IpcApp.handle("my-channel", async () => "x");
      expect(socket.addListener).toHaveBeenCalledOnce();
      expect(socket.addListener.mock.calls[0][0]).to.equal("itwin.my-channel");
    });

    it("invokes the handler with stripped args and replies on the response channel", async () => {
      const handler = vi.fn(async (a: string, b: number) => `${a}:${b}`);
      IpcApp.handle("my-channel", handler);
      const listener = socket.addListener.mock.calls[0][1];

      // simulate the backend pushing a request: (event, responseChannel, ...args)
      await listener(undefined, "itwin.resp-1", "hello", 7);

      expect(handler).toHaveBeenCalledWith("hello", 7); // event + responseChannel are stripped
      expect(socket.send).toHaveBeenCalledWith("itwin.resp-1", "hello:7"); // reply goes back on the response channel
    });

    it("returns the function that removes the listener", () => {
      const remove = () => { };
      socket.addListener.mockReturnValue(remove);
      expect(IpcApp.handle("my-channel", async () => "x")).to.equal(remove);
    });

    it("sends a serialized error response instead of hanging when the handler throws", async () => {
      const handler = vi.fn(async () => { throw new Error("handler-failure"); });
      IpcApp.handle("my-channel", handler);
      const listener = socket.addListener.mock.calls[0][1];

      await listener(undefined, "itwin.resp-1", "hello");

      expect(socket.send).toHaveBeenCalledOnce();
      const [responseChannel, response] = socket.send.mock.calls[0];
      expect(responseChannel).to.equal("itwin.resp-1");
      // response is the serialized-error envelope (see serializeIpcError), not left unsent - otherwise
      // the corresponding IpcHost.invoke on the backend would hang until invokeTimeout/shutdown.
      expect(response.error).to.exist;
      expect(response.error.message).to.equal("handler-failure");
    });

    it("sends a serialized error response when the handler rejects", async () => {
      const handler = vi.fn(async () => Promise.reject(new Error("rejected")));
      IpcApp.handle("my-channel", handler);
      const listener = socket.addListener.mock.calls[0][1];

      await listener(undefined, "itwin.resp-1");

      const [, response] = socket.send.mock.calls[0];
      expect(response.error.message).to.equal("rejected");
    });
  });

  describe("IpcHandler", () => {
    // Drives a registered IpcHandler the same way the backend would: pushes (responseChannel, funcName, ...args)
    // through the registered listener and returns the IpcInvokeReturn envelope it replies with.
    let dispatch: (funcName: string, ...args: any[]) => Promise<IpcInvokeReturn>;

    beforeEach(() => {
      MockIpcHandler.register();
      const call = socket.addListener.mock.calls.find((c: any[]) => c[0] === "itwin.mock-channel");
      expect(call, "IpcHandler.register should add a listener on its channel").to.not.be.undefined;
      const listener = call![1];
      dispatch = async (funcName, ...args) => {
        await listener(undefined, "itwin.resp", funcName, ...args);
        return socket.send.mock.calls.at(-1)![1] as IpcInvokeReturn;
      };
    });

    it("calls public methods and returns the result", async () => {
      const ret = await dispatch("mockMethod");
      expect(ret.result).to.equal("mock-value");
      expect(ret.error).to.be.undefined;
    });

    it("passes arguments through to the implementation", async () => {
      const ret = await dispatch("echo", "hi", 9);
      expect(ret.result).to.equal("hi:9");
    });

    it("rejects methods inherited from Object", async () => {
      const ret = await dispatch("toString");
      expect(ret.result).to.be.undefined;
      expect(ret.error).to.not.be.undefined;
    });

    it("rejects private (#) methods", async () => {
      const ret = await dispatch("#privateFunction");
      expect(ret.result).to.be.undefined;
      expect(ret.error).to.not.be.undefined;
    });

    it("returns an error for unknown methods", async () => {
      const ret = await dispatch("doesNotExist");
      expect(ret.result).to.be.undefined;
      expect((ret.error as any).message).to.contain("doesNotExist");
    });

    it("serializes a thrown plain Error including its stack", async () => {
      const ret = await dispatch("throwPlainError");
      expect(ret.result).to.be.undefined;
      const error = ret.error as any;
      expect(error.message).to.equal("plain failure");
      expect(typeof error.stack).to.equal("string"); // frontend always includes the stack
    });

    it("serializes a thrown BentleyError preserving identity and logging metadata", async () => {
      const ret = await dispatch("throwBentleyError");
      const error = ret.error as any;
      expect(error.message).to.equal("boom");
      expect(error.iTwinErrorId.scope).to.equal("bentley-error"); // BentleyError identity is preserved for typed reconstruction
      expect(error.iTwinErrorId.key).to.be.a("string");
      expect(error.loggingMetadata).to.deep.equal({ detail: 42 });
    });
  });

  describe("makeIpcProxy error reconstruction", () => {
    // Drives the caller side (_callIpcChannel): mocks the backend's reply with an {error} envelope and asserts
    // how the frontend rebuilds and rethrows it via the shared rebuildIpcError(err, BackendError) helper.
    async function invokeExpectingThrow(envelope: IpcInvokeReturn): Promise<any> {
      socket.invoke.mockResolvedValue(envelope);
      const proxy = IpcApp.makeIpcProxy<MockIpcInterface>("mock-channel");
      try {
        await proxy.mockMethod();
        expect.fail("proxy call should have rejected");
      } catch (err) {
        return err;
      }
    }

    it("rebuilds a thrown BentleyError as a BackendError preserving identity and metadata", async () => {
      const original = new BentleyError(IModelStatus.NotFound, "boom", () => ({ detail: 42 }));
      const err = await invokeExpectingThrow(serializeIpcError(original, true));
      expect(err).to.be.instanceOf(BackendError);
      expect(BentleyError.isError(err, IModelStatus.NotFound)).to.be.true; // same iTwinErrorId identity
      expect(err.errorNumber).to.equal(IModelStatus.NotFound);
      expect(err.message).to.equal("boom");
      expect(err.loggingMetadata).to.deep.equal({ detail: 42 });
    });

    it("rebuilds a thrown plain Error as a plain Error with message and own properties", async () => {
      const original = Object.assign(new Error("plain failure"), { custom: "field" });
      const err = await invokeExpectingThrow(serializeIpcError(original, true));
      expect(err).to.be.instanceOf(Error);
      expect(err).to.not.be.instanceOf(BackendError);
      expect(err.message).to.equal("plain failure");
      expect(err.custom).to.equal("field");
    });

    it("forwards a non-object error verbatim", async () => {
      const err = await invokeExpectingThrow({ error: "just a string" });
      expect(err).to.equal("just a string");
    });
  });
});

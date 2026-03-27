import * as sinon from "sinon";
import { expect } from "chai";
import { IpcInvokeReturn, IpcSocketBackend } from "@itwin/core-common";
import { IpcHandler, IpcHost } from "../IpcHost";

interface MockIpcInterface {
  mockMethod: () => string;
  throwNestedError: () => never;
  throwCircularError: () => never;
}

class OuterError extends Error {
  public readonly context: { cause: Error };
  public readonly errors: Error[];
  constructor(public readonly originalError: Error) {
    super("outer");
    this.context = { cause: originalError };
    this.errors = [new Error("array-child-1"), new Error("array-child-2")];
  }
}

class MockIpcHandler extends IpcHandler implements MockIpcInterface {
  public override get channelName() { return "mock-channel"; }

  public mockMethod(): string {
    return "mock-value";
  }

  public throwNestedError(): never {
    const inner = new Error("inner-message");
    throw new OuterError(inner);
  }

  public throwCircularError(): never {
    const err = new Error("circular") as any;
    err.cause = err; // circular reference
    throw err;
  }

  #privateFunction(): void { }
}

describe("IpcHost", () => {
  let socket: sinon.SinonStubbedInstance<IpcSocketBackend>;

  beforeEach(async () => {
    socket = {
      send: sinon.stub(),
      addListener: sinon.stub(),
      removeListener: sinon.stub(),
      handle: sinon.stub(),
    };

    await IpcHost.startup({ ipcHost: { socket } });
  });

  describe("IpcHandler", () => {
    let handler: (...args: any[]) => Promise<IpcInvokeReturn>;

    beforeEach(() => {
      MockIpcHandler.register();
      const handleCall = socket.handle.getCalls().find((call) => call.args[0] === "itwin.mock-channel")!;
      expect(handleCall).to.not.be.undefined;
      handler = handleCall.args[1];
    });

    it("should call public methods", async () => {
      const ipcReturn = await handler(undefined, "mockMethod");
      expect(ipcReturn.result).to.equal("mock-value");
      expect(ipcReturn.error).to.be.undefined;
    });

    it("should not call private methods", async () => {
      const ipcReturn = await handler(undefined, "#privateFunction");
      expect(ipcReturn.result).to.be.undefined;
      expect(ipcReturn.error).to.not.be.undefined;
    });

    it("should not call methods inherited from Object", async () => {
      const ipcReturn = await handler(undefined, "toString");
      expect(ipcReturn.result).to.be.undefined;
      expect(ipcReturn.error).to.not.be.undefined;
    });

    it("should serialize nested Error properties preserving message and stack", async () => {
      const ipcReturn = await handler(undefined, "throwNestedError");
      const error = ipcReturn.error as any;
      // Top-level error
      expect(error.message).to.equal("outer");
      expect(error.stack).to.be.a("string");
      // Direct Error property
      expect(error.originalError.message).to.equal("inner-message");
      expect(error.originalError.stack).to.be.a("string");
      // Error nested inside a plain-object property
      expect(error.context.cause.message).to.equal("inner-message");
      expect(error.context.cause.stack).to.be.a("string");
      // Array of Errors stays an array
      expect(Array.isArray(error.errors)).to.be.true;
      expect(error.errors[0].message).to.equal("array-child-1");
      expect(error.errors[1].message).to.equal("array-child-2");
    });

    it("should omit stack on nested Errors when IpcHost.noStack is set", async () => {
      const originalNoStack = IpcHost.noStack;
      IpcHost.noStack = true;
      try {
        const ipcReturn = await handler(undefined, "throwNestedError");
        const error = ipcReturn.error as any;
        expect(error.stack).to.be.undefined;
        expect(error.originalError.stack).to.be.undefined;
        expect(error.context.cause.stack).to.be.undefined;
        expect(error.errors[0].stack).to.be.undefined;
        expect(error.errors[1].stack).to.be.undefined;
      } finally {
        IpcHost.noStack = originalNoStack;
      }
    });

    it("should not infinitely recurse on circular Error references", async () => {
      const ipcReturn = await handler(undefined, "throwCircularError");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("circular");
      expect(error.cause).to.be.undefined;
    });
  });
});

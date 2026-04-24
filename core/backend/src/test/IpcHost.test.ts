import * as sinon from "sinon";
import { expect } from "chai";
import { BentleyError, IModelStatus } from "@itwin/core-bentley";
import { IpcInvokeReturn, IpcSocketBackend } from "@itwin/core-common";
import { IpcHandler, IpcHost } from "../IpcHost";

interface MockIpcInterface {
  mockMethod: () => string;
  throwNestedError: () => never;
  throwCircularError: () => never;
  throwErrorWithNativeCause: () => never;
  throwBentleyErrorWithFunctionMetaData: () => never;
  throwBentleyErrorWithObjectMetaData: () => never;
  throwNestedBentleyErrorWithFunctionMetaData: () => never;
  throwErrorWithFunctionProperty: () => never;
  throwErrorWithSymbolProperty: () => never;
  throwErrorWithDateProperty: () => never;
  throwErrorWithClassInstanceProperty: () => never;
  throwErrorWithMixedArray: () => never;
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

  public throwErrorWithNativeCause(): never {
    throw new Error("native-cause-outer", { cause: new Error("native-cause-inner") });
  }

  public throwBentleyErrorWithFunctionMetaData(): never {
    throw new BentleyError(IModelStatus.BadArg, "bentley-fn-meta", () => ({ detail: "computed" }));
  }

  public throwBentleyErrorWithObjectMetaData(): never {
    throw new BentleyError(IModelStatus.BadArg, "bentley-obj-meta", { detail: "static" });
  }

  public throwNestedBentleyErrorWithFunctionMetaData(): never {
    const inner = new BentleyError(IModelStatus.BadArg, "inner-bentley", () => ({ detail: "nested-computed" }));
    const outer = new Error("outer") as any;
    outer.cause = inner;
    throw outer;
  }

  public throwErrorWithFunctionProperty(): never {
    const err = new Error("fn-prop") as any;
    err.retry = () => {};
    throw err;
  }

  public throwErrorWithSymbolProperty(): never {
    const err = new Error("sym-prop") as any;
    err[Symbol("tag")] = "should-be-dropped";
    throw err;
  }

  public throwErrorWithDateProperty(): never {
    const err = new Error("date-prop") as any;
    err.timestamp = new Date("2024-01-01");
    throw err;
  }

  public throwErrorWithClassInstanceProperty(): never {
    const err = new Error("class-instance-prop") as any;
    err.request = new URL("https://example.com"); // arbitrary non-plain class instance
    throw err;
  }

  public throwErrorWithMixedArray(): never {
    const err = new Error("mixed-array") as any;
    err.items = ["string-value", 42, new Date("2024-01-01"), new URL("https://example.com"), new Error("array-error")];
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

    it("should serialize native Error.cause even though it is non-enumerable", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithNativeCause");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("native-cause-outer");
      expect(error.cause).to.not.be.undefined;
      expect(error.cause.message).to.equal("native-cause-inner");
      expect(error.cause.stack).to.be.a("string");
    });

    it("should drop _metaData and expose loggingMetadata when BentleyError has a GetMetaDataFunction", async () => {
      const ipcReturn = await handler(undefined, "throwBentleyErrorWithFunctionMetaData");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("bentley-fn-meta");
      // _metaData is a function — must not survive serialization
      expect(error._metaData).to.be.undefined;
      // loggingMetadata should be the resolved object
      expect(error.loggingMetadata).to.deep.equal({ detail: "computed" });
    });

    it("should drop _metaData and expose loggingMetadata when BentleyError has an object metaData", async () => {
      const ipcReturn = await handler(undefined, "throwBentleyErrorWithObjectMetaData");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("bentley-obj-meta");
      expect(error._metaData).to.be.undefined;
      expect(error.loggingMetadata).to.deep.equal({ detail: "static" });
    });

    it("should drop function-valued _metaData on a nested BentleyError and still expose loggingMetadata", async () => {
      const ipcReturn = await handler(undefined, "throwNestedBentleyErrorWithFunctionMetaData");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("outer");
      // The nested BentleyError inside .cause must also have _metaData stripped and loggingMetadata populated
      expect(error.cause).to.not.be.undefined;
      expect(error.cause.message).to.equal("inner-bentley");
      expect(error.cause._metaData).to.be.undefined;
      expect(error.cause.loggingMetadata).to.deep.equal({ detail: "nested-computed" });
    });

    it("should drop arbitrary function-valued properties from a thrown Error", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithFunctionProperty");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("fn-prop");
      expect(error.retry).to.be.undefined;
    });

    it("should not include symbol-keyed properties from a thrown Error", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithSymbolProperty");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("sym-prop");
      // { ...e } copies enumerable own symbol-keyed properties too.
      // The serializer explicitly strips them (they cannot be structured-cloned).
      expect(Object.getOwnPropertySymbols(error)).to.have.length(0);
    });

    it("should preserve Date properties", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithDateProperty");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("date-prop");
      expect(error.timestamp).to.deep.equal(new Date("2024-01-01"));
    });

    it("should drop non-plain class instance properties", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithClassInstanceProperty");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("class-instance-prop");
      expect(error.request).to.be.undefined;
    });

    it("should sanitize mixed arrays: preserve primitives and Dates, drop non-plain class instances, recurse into Errors", async () => {
      const ipcReturn = await handler(undefined, "throwErrorWithMixedArray");
      const error = ipcReturn.error as any;
      expect(error.message).to.equal("mixed-array");
      expect(Array.isArray(error.items)).to.be.true;
      expect(error.items[0]).to.equal("string-value");      // primitive: preserved
      expect(error.items[1]).to.equal(42);                   // primitive: preserved
      expect(error.items[2]).to.deep.equal(new Date("2024-01-01")); // Date: preserved
      expect(error.items[3]).to.be.undefined;                // class instance: dropped (→ undefined)
      expect(error.items[4].message).to.equal("array-error"); // Error: recursed
    });
  });
});

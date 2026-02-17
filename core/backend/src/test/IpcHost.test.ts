import * as sinon from "sinon";
import { expect } from "chai";
import { IpcInvokeReturn, IpcSocketBackend } from "@itwin/core-common";
import { IpcHandler, IpcHost } from "../IpcHost";

interface MockIpcInterface {
  mockMethod: () => string;
}

class MockIpcHandler extends IpcHandler implements MockIpcInterface {
  public override get channelName() { return "mock-channel"; }

  public mockMethod(): string {
    return "mock-value";
  }

  #privateFunction(): void { }
}

describe("IpcHost", () => {
  let socket: sinon.SinonStubbedInstance<IpcSocketBackend>;

  interface IpcHostTestInternals {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _nextInvokeId: number;
  }

  beforeEach(async () => {
    socket = {
      send: sinon.stub(),
      addListener: sinon.stub(),
      removeListener: sinon.stub(),
      handle: sinon.stub(),
    };

    await IpcHost.startup({ ipcHost: { socket } });
  });

  afterEach(() => {
    const host = IpcHost as unknown as IpcHostTestInternals;
    host._nextInvokeId = 0;
  });

  describe("IpcHandler", () => {
    it("should call public methods", async () => {
      MockIpcHandler.register();

      const handleCall = socket.handle.getCalls().find((call) => call.args[0] === "itwin.mock-channel")!;
      expect(handleCall).to.not.be.undefined;

      const handler = handleCall.args[1];
      expect(typeof handler).to.equal("function");

      const ipcReturn: IpcInvokeReturn = await handler(undefined, "mockMethod");

      expect(ipcReturn.result).to.equal("mock-value");
      expect(ipcReturn.error).to.be.undefined;
    });

    it("should not call private methods", async () => {
      MockIpcHandler.register();

      const handleCall = socket.handle.getCalls().find((call) => call.args[0] === "itwin.mock-channel")!;
      expect(handleCall).to.not.be.undefined;

      const handler = handleCall.args[1];
      expect(typeof handler).to.equal("function");

      const ipcReturn: IpcInvokeReturn = await handler(undefined, "#privateFunction");

      expect(ipcReturn.result).to.be.undefined;
      expect(ipcReturn.error).to.not.be.undefined;
    });

    it("should not call methods inherited from Object", async () => {
      MockIpcHandler.register();

      const handleCall = socket.handle.getCalls().find((call) => call.args[0] === "itwin.mock-channel")!;
      expect(handleCall).to.not.be.undefined;

      const handler = handleCall.args[1];
      expect(typeof handler).to.equal("function");

      const ipcReturn: IpcInvokeReturn = await handler(undefined, "toString");

      expect(ipcReturn.result).to.be.undefined;
      expect(ipcReturn.error).to.not.be.undefined;
    });
  });

  describe("IpcHost.invoke", () => {
    /** Simulates the frontend: captures per-request listeners and provides a `respond` helper by call index. */
    function mockFrontend() {
      const listeners = new Map<string, (event: any, result: any) => void>();
      socket.addListener.callsFake((ch: string, fn: (event: any, result: any) => void) => {
        listeners.set(ch, fn);
        return () => listeners.delete(ch);
      });

      return {
        respond: (callIndex: number, result: unknown) => {
          const responseChannel = socket.send.getCall(callIndex).args[1] as string;
          const listener = listeners.get(responseChannel);
          if (!listener)
            throw new Error(`No listener found for response channel ${responseChannel}`);
          listener(undefined, result);
        },
      };
    }

    it("should resolve with the frontend's response", async () => {
      const frontend = mockFrontend();
      const promise = IpcHost.invoke("ch", "a", "b");
      frontend.respond(0, "hello");
      expect(await promise).to.equal("hello");
    });

    it("should route concurrent invokes to the correct caller", async () => {
      const frontend = mockFrontend();
      const p1 = IpcHost.invoke("ch");
      const p2 = IpcHost.invoke("ch");

      // respond out of order
      frontend.respond(1, "second");
      frontend.respond(0, "first");

      expect(await p1).to.equal("first");
      expect(await p2).to.equal("second");
    });
  });
});

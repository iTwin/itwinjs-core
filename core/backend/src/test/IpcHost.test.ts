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
    it("should send message and receive response", async () => {
      const result = "response-value";
      socket.addListener.callsFake((_, listener: (event: any, response: IpcInvokeReturn) => void) => {
        void Promise.resolve().then(() => {
          listener(undefined, { result });
        });
        return () => { };
      });

      const ipcReturn = await IpcHost.invoke("request-channel", "arg1", "arg2");

      expect(ipcReturn.result).to.equal(result);
      expect(socket.send.calledOnce).to.be.true;
      expect(socket.addListener.calledOnce).to.be.true;

      const sendArgs = socket.send.firstCall.args;
      expect(sendArgs[0]).to.equal("itwin.request-channel");
      expect(sendArgs[1]).to.match(/:response:\d+$/);
      expect(sendArgs[2]).to.equal("arg1");
      expect(sendArgs[3]).to.equal("arg2");
    });

    it("should generate unique response channels for parallel invokes", async () => {
      type IpcListener = (event: any, response: IpcInvokeReturn) => void;
      const listeners = new Map<string, IpcListener>();

      socket.addListener.callsFake((channel: string, listener: IpcListener) => {
        listeners.set(channel, listener);
        return () => { };
      });

      const p1 = IpcHost.invoke("channel");
      const p2 = IpcHost.invoke("channel");

      expect(listeners.size).to.equal(2);

      // Respond and verify correct routing
      const [ch1, ch2] = [...listeners.keys()];
      expect(listeners.get(ch1)).to.not.be.undefined;
      expect(listeners.get(ch2)).to.not.be.undefined;
      listeners.get(ch1)!(undefined, { result: "r1" });
      listeners.get(ch2)!(undefined, { result: "r2" });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.result).to.equal("r1");
      expect(r2.result).to.equal("r2");
    });
  });
});

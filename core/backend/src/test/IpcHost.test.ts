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
      socket.addListener.callsFake((_channel: string, listener: (event: any, id: number, response: IpcInvokeReturn) => void) => {
        void Promise.resolve().then(() => {
          const requestId = socket.send.firstCall.args[2] as number;
          listener(undefined, requestId, { result });
        });
        return () => { };
      });

      const ipcReturn = await IpcHost.invoke("request-channel", "arg1", "arg2") as IpcInvokeReturn;

      expect(ipcReturn.result).to.equal(result);
      expect(socket.send.calledOnce).to.be.true;
      expect(socket.addListener.calledOnce).to.be.true;

      const sendArgs = socket.send.firstCall.args;
      expect(sendArgs[0]).to.equal("itwin.request-channel");
      expect(sendArgs[1]).to.equal("itwin.__invoke_response__");
      expect(sendArgs[2]).to.be.a("number");
      expect(sendArgs[3]).to.equal("arg1");
      expect(sendArgs[4]).to.equal("arg2");
    });

    it("should dispatch parallel invokes by requestId using a single shared listener", async () => {
      type IpcListener = (event: any, id: number, response: any) => void;
      let sharedListener: IpcListener | undefined;

      socket.addListener.callsFake((_channel: string, listener: IpcListener) => {
        sharedListener = listener;
        return () => { };
      });

      const p1 = IpcHost.invoke("channel");
      const p2 = IpcHost.invoke("channel");

      // Only one listener should be registered (shared for the channel)
      expect(socket.addListener.callCount).to.equal(1);
      expect(sharedListener).to.not.be.undefined;

      // Extract requestIds from send calls
      const requestId1 = socket.send.getCall(0).args[2] as number;
      const requestId2 = socket.send.getCall(1).args[2] as number;
      expect(requestId1).to.not.equal(requestId2);

      // Respond using the shared listener with different requestIds
      sharedListener!(undefined, requestId1, { result: "r1" });
      sharedListener!(undefined, requestId2, { result: "r2" });

      const [r1, r2] = await Promise.all([p1, p2]) as IpcInvokeReturn[];
      expect(r1.result).to.equal("r1");
      expect(r2.result).to.equal("r2");
    });
  });
});

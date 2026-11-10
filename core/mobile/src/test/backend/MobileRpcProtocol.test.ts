import { setImmediate } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import { expect } from "chai";
import { IpcInvokeReturn, IpcWebSocket, IpcWebSocketFrontend, IpcWebSocketMessageType, RpcInterface, RpcManager, RpcMarshaling, RpcRequest, RpcRequestStatus, unwrapIpcInvokeReturn } from "@itwin/core-common";
import { MobileRpcManager } from "../../common/MobileRpcManager";
import { MobileRpcProtocol } from "../../common/MobileRpcProtocol";
import { MobileRpcRequest } from "../../common/MobileRpcRequest";

/* eslint-disable @typescript-eslint/no-deprecated */

class TestSocket extends EventTarget {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public readyState = TestSocket.CONNECTING;
  public bufferedAmount = 0;
  public sent: unknown[] = [];

  public send(data: unknown) { this.sent.push(data); }
  public close() { this.readyState = TestSocket.CLOSED; }
  public open() {
    this.readyState = TestSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }
}

class TestRpc extends RpcInterface {
  public static readonly interfaceName = "MobileDisconnectTestRpc";
  public static readonly interfaceVersion = "1.0.0";
  public async operation(): Promise<void> { return this.forward(arguments); }
}

describe("MobileRpcProtocol disconnects", () => {
  let protocol: MobileRpcProtocol;
  let socket: TestSocket;
  let request: MobileRpcRequest;
  let response: Promise<unknown>;
  let submitted: Promise<void>;
  const token = "a".repeat(64);
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const socketDescriptor = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  const originalTransport = IpcWebSocket.transport;
  let originalReceivers: typeof IpcWebSocket.receivers;

  beforeEach(() => {
    submitted = Promise.resolve();
    originalReceivers = new Set(IpcWebSocket.receivers);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { hash: `#port=12345&rpcToken=${token}` }, setInterval, clearInterval },
    });
    Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: TestSocket });
    protocol = MobileRpcManager.initializeClient([TestRpc]).protocol;
    socket = protocol.socket as unknown as TestSocket;
  });

  afterEach(async () => {
    request?.cancel();
    socket.close();
    socket.dispatchEvent(new Event("close"));
    await submitted;
    RpcManager.terminateInterface(TestRpc);
    IpcWebSocket.transport = originalTransport;
    for (const receiver of IpcWebSocket.receivers) {
      if (!originalReceivers.has(receiver))
        IpcWebSocket.receivers.delete(receiver);
    }
    if (windowDescriptor)
      Object.defineProperty(globalThis, "window", windowDescriptor);
    else
      Reflect.deleteProperty(globalThis, "window");
    if (socketDescriptor)
      Object.defineProperty(globalThis, "WebSocket", socketDescriptor);
    else
      Reflect.deleteProperty(globalThis, "WebSocket");
  });

  async function submit(open: boolean) {
    if (open)
      socket.open();
    request = new MobileRpcRequest(RpcManager.getClientForInterface(TestRpc), "operation", []);
    response = request.response.then(() => undefined, (error: unknown) => error);
    submitted = request.submit();
    await setImmediate();
    expect(protocol.requests.size).to.equal(1);
  }

  it("roundtrips binary values in messages no larger than 4 MiB", () => {
    const chunkSize = 4 * 1024 * 1024;
    const source = new Uint8Array(2 * chunkSize + 19);
    for (let index = 0; index < source.length; ++index)
      source[index] = index % 251;
    const value = [source.subarray(7), source.subarray(3, chunkSize + 3), new Uint8Array()];
    const serialized = RpcMarshaling.serialize(protocol, value);
    expect(serialized.data.map((part) => part.byteLength)).to.deep.equal([chunkSize, chunkSize, 12, chunkSize, 0]);
    expect(RpcMarshaling.deserialize(protocol, serialized)).to.deep.equal(value);
  });

  it("roundtrips overlapping chunked RPC calls over real sockets in both directions", function () {
    this.timeout(15000);
    const fixture = require.resolve("./MobileRpcMemoryTestProcess");
    const result = spawnSync(process.execPath, ["--expose-gc", fixture, "roundtrip"], { encoding: "utf8", timeout: 10000 });
    const diagnostics = `${result.stdout}\n${result.stderr}`;
    expect(result.error, diagnostics).to.equal(undefined);
    expect(result.signal, diagnostics).to.equal(null);
    expect(result.status, diagnostics).to.equal(0);
  });

  it("pauses a partially sent request until the socket buffer drains", async () => {
    socket.open();
    const first = new Uint8Array(4 * 1024 * 1024);
    const last = new Uint8Array([9]);
    let completed = () => {};
    const sent = new Promise<void>((resolve) => { completed = resolve; });
    socket.send = (data) => {
      socket.sent.push(data);
      if (data instanceof Uint8Array)
        socket.bufferedAmount += data.byteLength;
      if (socket.sent.length === 3)
        completed();
    };
    protocol.sendToBackend(["header", first, last]);
    expect(socket.sent).to.deep.equal(["header", first]);
    socket.bufferedAmount = 0;
    await sent;
    expect(socket.sent).to.deep.equal(["header", first, last]);
  });

  it("discards unsent chunks when the socket closes under backpressure", async () => {
    socket.open();
    socket.bufferedAmount = 4 * 1024 * 1024;
    protocol.sendToBackend(["header", new Uint8Array([1])]);
    expect(socket.sent).to.have.lengthOf(0);
    socket.close();
    socket.dispatchEvent(new Event("close"));
    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    socket.open();
    await setImmediate();
    expect(socket.sent).to.have.lengthOf(0);
  });

  for (const open of [true, false]) {
    it(`rejects ${open ? "in-flight" : "queued"} requests when the socket closes`, async function () {
      this.timeout(1000);
      await submit(open);
      socket.close();
      socket.dispatchEvent(new Event("close"));
      expect(await response).to.be.instanceOf(Error);
      await submitted;
      expect(protocol.requests.size).to.equal(0);
      expect(RpcRequest.activeRequests.has(request.id)).to.equal(false);
    });
  }

  it("rejects requests instead of throwing from the socket error listener", async function () {
    this.timeout(1000);
    await submit(true);
    socket.dispatchEvent(new Event("error"));
    expect(await response).to.be.instanceOf(Error);
    await submitted;
    expect(RpcRequest.activeRequests.has(request.id)).to.equal(false);
  });

  it("rejects new requests on a closed connection instead of queueing forever", async function () {
    this.timeout(1000);
    socket.open();
    socket.close();
    socket.dispatchEvent(new Event("close"));
    request = new MobileRpcRequest(RpcManager.getClientForInterface(TestRpc), "operation", []);
    response = request.response.then(() => undefined, (error: unknown) => error);
    submitted = request.submit();
    expect(await response).to.be.instanceOf(Error);
    await submitted;
    expect(protocol.requests.size).to.equal(0);
  });

  it("ignores close events from a socket replaced by native reconnection", async () => {
    const oldSocket = socket;
    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    await submit(true);
    oldSocket.dispatchEvent(new Event("close"));
    expect(protocol.requests.has(request.id)).to.equal(true);
    expect(RpcRequest.activeRequests.has(request.id)).to.equal(true);
    expect(socket.sent).to.have.lengthOf(1);
  });

  it("does not replay disconnected queued requests when native reconnects", async () => {
    await submit(false);
    socket.close();
    socket.dispatchEvent(new Event("close"));
    expect(await response).to.be.instanceOf(Error);
    await submitted;

    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    socket.open();
    expect(socket.sent).to.have.lengthOf(0);
    await submit(false);
    expect(socket.sent).to.have.lengthOf(1);
  });

  it("settles requests when sending throws", async () => {
    const error = new Error("Send failed");
    socket.send = () => { throw error; };
    socket.open();
    request = new MobileRpcRequest(RpcManager.getClientForInterface(TestRpc), "operation", []);
    response = request.response.then(() => undefined, (reason: unknown) => reason);
    submitted = request.submit();
    expect(await response).to.equal(error);
    await submitted;
    expect(protocol.requests.size).to.equal(0);
  });

  it("handles a response received immediately during send", async () => {
    socket.open();
    socket.send = () => {
      socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({
        id: request.id, interfaceName: TestRpc.interfaceName, status: protocol.getCode(RpcRequestStatus.Resolved),
        result: RpcMarshaling.serialize(protocol, undefined),
      }) }));
    };
    request = new MobileRpcRequest(RpcManager.getClientForInterface(TestRpc), "operation", []);
    response = request.response.then(() => undefined, (error: unknown) => error);
    submitted = request.submit();
    expect(await response).to.equal(undefined);
    await submitted;
    expect(protocol.requests.size).to.equal(0);
  });

  it("does not send a request whose encoding completes after disconnect", async () => {
    let resume = () => {};
    const paused = new Promise<void>((resolve) => { resume = resolve; });
    const serialize = protocol.serialize.bind(protocol);
    protocol.serialize = async (value) => {
      await paused;
      return serialize(value);
    };
    await submit(true);
    socket.close();
    socket.dispatchEvent(new Event("close"));
    expect(await response).to.be.instanceOf(Error);
    resume();
    await submitted;
    await setImmediate();
    expect(socket.sent).to.have.lengthOf(0);
  });

  for (const inFlight of [true, false]) {
    it(`settles IPC invokes ${inFlight ? "in flight" : "still encoding"} when disconnected`, async () => {
      socket.open();
      const ipc = new IpcWebSocketFrontend();
      const result = ipc.invoke("itwin.test", "operation") as Promise<IpcInvokeReturn>;
      if (inFlight)
        await setImmediate();
      socket.close();
      socket.dispatchEvent(new Event("close"));
      const value = await result;
      expect(() => unwrapIpcInvokeReturn(value)).to.throw("Mobile RPC socket closed.");
    });
  }

  it("settles IPC invokes made after a disconnect", async () => {
    socket.open();
    socket.close();
    socket.dispatchEvent(new Event("close"));
    const ipc = new IpcWebSocketFrontend();
    const result = await ipc.invoke("itwin.test", "operation") as IpcInvokeReturn;
    expect(() => unwrapIpcInvokeReturn(result)).to.throw("Mobile RPC socket closed.");
  });

  it("settles IPC invokes from a connection replaced by native reconnection", async () => {
    socket.open();
    const ipc = new IpcWebSocketFrontend();
    const result = ipc.invoke("itwin.test", "operation") as Promise<IpcInvokeReturn>;
    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    const value = await result;
    expect(() => unwrapIpcInvokeReturn(value)).to.throw("Mobile RPC socket replaced.");
  });

  it("preserves IPC invokes queued while the replacement socket connects", async () => {
    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    const ipc = new IpcWebSocketFrontend();
    const result = ipc.invoke("itwin.test", "operation") as Promise<IpcInvokeReturn>;
    await setImmediate();
    expect(socket.sent).to.have.lengthOf(0);
    socket.open();
    expect(socket.sent).to.have.lengthOf(1);
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({
      id: "itwin.test", interfaceName: "__ipc__", status: 0,
      result: RpcMarshaling.serialize(protocol, {
        type: IpcWebSocketMessageType.Response, channel: "itwin.test", response: 1, data: { result: "completed" }, sequence: -1,
      }),
    }) }));
    expect(unwrapIpcInvokeReturn(await result)).to.equal("completed");
  });

  it("retains the native-triggered retry of already-active RPC requests", async () => {
    await submit(true);
    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    socket.open();
    await setImmediate();
    expect(socket.sent).to.have.lengthOf(1);
    expect(protocol.requests.has(request.id)).to.equal(true);
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({
      id: request.id, interfaceName: TestRpc.interfaceName, status: protocol.getCode(RpcRequestStatus.Resolved),
      result: RpcMarshaling.serialize(protocol, undefined),
    }) }));
    expect(await response).to.equal(undefined);
    await submitted;
    expect(RpcRequest.activeRequests.has(request.id)).to.equal(false);
  });

  it("discards partial and abandoned responses and completes new requests after reconnect", async () => {
    await submit(true);
    const abandoned = {
      id: request.id, interfaceName: TestRpc.interfaceName, status: protocol.getCode(RpcRequestStatus.Resolved),
      result: RpcMarshaling.serialize(protocol, undefined),
    };
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ ...abandoned, result: { ...abandoned.result, data: [1, 1] } }) }));
    socket.dispatchEvent(new MessageEvent("message", { data: new Uint8Array([1]).buffer }));
    socket.close();
    socket.dispatchEvent(new Event("close"));
    expect(await response).to.be.instanceOf(Error);
    await submitted;

    (window as any)._imodeljs_rpc_reconnect(12346, token);
    socket = protocol.socket as unknown as TestSocket;
    await submit(true);
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(abandoned) }));
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ ...abandoned, id: request.id }) }));
    expect(await response).to.equal(undefined);
    await submitted;
    expect(protocol.requests.size).to.equal(0);
  });
});

import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { once } from "node:events";
import { setImmediate } from "node:timers/promises";
import * as WebSocket from "ws";
import { Logger } from "@itwin/core-bentley";
import { IpcWebSocket, IpcWebSocketMessageType, RpcInterface, RpcManager, RpcMarshaling } from "@itwin/core-common";
import { MobileHost } from "../../backend/MobileHost";
import { MobileRpcServer } from "../../backend/MobileRpcServer";
import { MobileRpcManager } from "../../common/MobileRpcManager";
import { MobileRpcProtocol } from "../../common/MobileRpcProtocol";

export async function run(mode: "connected" | "pending" | "string" | "binary" | "callback-error" | "throw-error" | "socket-error" | "missing-connection" | "send-queue" | "interrupted-upload" | "restarted-upload" | "late-replies"): Promise<void> {
  MobileHost.reconnect = () => undefined;
  const pending = mode === "pending" ? ["pending response", new Uint8Array([9])] : undefined;
  let server = new MobileRpcServer(pending);
  let client: WebSocket | undefined;
  try {
    while (!MobileRpcServer.interop.port)
      await setImmediate();

    const frontend = new WebSocket(`ws://127.0.0.1:${MobileRpcServer.interop.port}`, `itwin-rpc.${MobileRpcServer.rpcToken}`);
    client = frontend;
    const replayed: WebSocket.Data[] = [];
    const replayComplete = mode === "pending" ? new Promise<void>((resolve) => {
      frontend.on("message", (data) => {
        replayed.push(data);
        if (replayed.length === 2)
          resolve();
      });
    }) : Promise.resolve();
    await once(client, "open");
    await replayComplete;
    if (pending) {
      deepStrictEqual(replayed, ["pending response", Buffer.from([9])]);
      strictEqual(pending.length, 0);
    }

    const { interop } = MobileRpcServer;
    let received = once(client, "message");
    interop.sendString("small response", interop.connectionId);
    strictEqual((await received)[0], "small response");

    received = once(client, "message");
    interop.sendBinary(new Uint8Array([1, 2, 3]), interop.connectionId);
    deepStrictEqual((await received)[0], Buffer.from([1, 2, 3]));
    process.stdout.write("Connected transfers succeeded.\n");

    if (mode === "connected" || mode === "pending")
      return;

    if (mode === "interrupted-upload" || mode === "restarted-upload") {
      MobileRpcProtocol.obtainInterop = () => interop;
      const protocol = MobileRpcManager.initializeImpl([]).protocol;
      const source = new Uint8Array(4 * 1024 * 1024 + 19).fill(0x5a);
      const parameters = RpcMarshaling.serialize(protocol, [{
        type: IpcWebSocketMessageType.Send, channel: "itwin.upload", sequence: 0, data: [source],
      }]);
      const chunks = parameters.data;
      const header = JSON.stringify({ operation: { interfaceDefinition: "__ipc__" }, parameters: { ...parameters, data: chunks.map((part) => part.byteLength) } });
      let receivedChunk = () => {};
      const partial = new Promise<void>((resolve) => { receivedChunk = resolve; });
      const handler = interop.handler;
      interop.handler = (data, connectionId) => {
        handler(data, connectionId);
        if (typeof data !== "string")
          receivedChunk();
      };
      client.send(header);
      client.send(chunks[0]);
      await partial;
      strictEqual((Reflect.get(protocol, "_partialData") as unknown[]).length, 1);
      const backendConnection = Reflect.get(server, "_connection") as WebSocket;
      const uploadConnectionClosed = once(backendConnection, "close");
      if (mode === "restarted-upload")
        server[Symbol.dispose]();
      else
        client.close();
      await uploadConnectionClosed;
      strictEqual(Reflect.get(protocol, "_partialRequest"), undefined);
      strictEqual((Reflect.get(protocol, "_partialData") as unknown[]).length, 0);
      if (mode === "restarted-upload") {
        interop.port = 0;
        server = new MobileRpcServer();
        while (!interop.port)
          await setImmediate();
      }
      client = new WebSocket(`ws://127.0.0.1:${interop.port}`, `itwin-rpc.${MobileRpcServer.rpcToken}`);
      await once(client, "open");
      const completed = new Promise<void>((resolve) => {
        IpcWebSocket.receivers.add((_event, message) => {
          if (message.channel === "itwin.upload") {
            deepStrictEqual(message.data, [source]);
            resolve();
          }
        });
      });
      client.send(header);
      for (const chunk of chunks)
        client.send(chunk);
      await completed;
      return;
    }

    if (mode === "send-queue") {
      const connection = Reflect.get(server, "_connection") as WebSocket;
      const originalSend = connection.send.bind(connection);
      const sent: WebSocket.Data[] = [];
      const callbacks: Array<(error?: Error) => void> = [];
      try {
        connection.send = ((data: WebSocket.Data, callback: (error?: Error) => void) => {
          sent.push(data);
          callbacks.push(callback);
        }) as WebSocket["send"];
        interop.sendString("first", interop.connectionId);
        interop.sendBinary(new Uint8Array([2]), interop.connectionId);
        interop.sendString("third", interop.connectionId);
        deepStrictEqual(sent, ["first"]);
        callbacks.shift()?.();
        deepStrictEqual(sent, ["first", new Uint8Array([2])]);
        callbacks.shift()?.();
        deepStrictEqual(sent, ["first", new Uint8Array([2]), "third"]);
        callbacks.shift()?.();
        interop.sendString("fourth", interop.connectionId);
        interop.sendString("discarded", interop.connectionId);
        const backendClosed = once(connection, "close");
        client.close();
        await backendClosed;
        callbacks.shift()?.();
        strictEqual(sent.length, 4);
        strictEqual((Reflect.get(server, "_sendQueue") as unknown[]).length, 0);
      } finally {
        connection.send = originalSend;
      }
      return;
    }

    if (mode === "missing-connection") {
      const connection = Reflect.get(server, "_connection") as WebSocket;
      try {
        Reflect.set(server, "_connection", undefined);
        throws(() => interop.sendString("response", interop.connectionId), /No connection\./);
        throws(() => interop.sendBinary(new Uint8Array([1]), interop.connectionId), /No connection\./);
      } finally {
        Reflect.set(server, "_connection", connection);
      }
      return;
    }

    if (mode === "callback-error" || mode === "throw-error" || mode === "socket-error") {
      const connection = Reflect.get(server, "_connection") as WebSocket;
      const failed = once(client, "close");
      const error = new Error("Injected socket failure");
      if (mode === "socket-error") {
        connection.emit("error", error);
      } else {
        connection.send = ((_data: WebSocket.Data, callback: (err?: Error) => void) => {
          if (mode === "throw-error")
            throw error;
          process.nextTick(() => callback(error));
        }) as WebSocket["send"];
        interop.sendString("response", interop.connectionId);
      }
      await failed;
      await setImmediate();
      process.stdout.write("Backend survived a socket failure.\n");
      return;
    }

    if (mode === "late-replies") {
      MobileRpcProtocol.obtainInterop = () => interop;
      let invoked = () => {};
      const invocationReceived = new Promise<void>((resolve) => { invoked = resolve; });
      let release = () => {};
      const released = new Promise<void>((resolve) => { release = resolve; });
      class LateRpc extends RpcInterface {
        public static readonly interfaceName = "MobileLateRpc";
        public static readonly interfaceVersion = "1.0.0";
        public async operation(): Promise<string> { return this.forward(arguments); }
      }
      class LateRpcImpl extends RpcInterface {
        public async operation(): Promise<string> {
          invoked();
          await released;
          return "late";
        }
      }
      RpcManager.registerImpl(LateRpc, LateRpcImpl);
      const protocol = MobileRpcManager.initializeImpl([LateRpc]).protocol;
      const transport = IpcWebSocket.transport;

      client.send(JSON.stringify({
        id: "late-request", method: "", path: "",
        operation: { interfaceDefinition: LateRpc.interfaceName, operationName: "operation", interfaceVersion: LateRpc.interfaceVersion },
        parameters: RpcMarshaling.serialize(protocol, []),
      }));
      await invocationReceived;

      const lateClosed = once(client, "close");
      client.close();
      await lateClosed;

      const lateErrors: unknown[] = [];
      Logger.logError = (_category, message) => { lateErrors.push(message); };

      // Backend-originated IPC messages must observe the transport failure so pending IpcHost.invoke calls reject.
      throws(
        () => transport.send({ type: IpcWebSocketMessageType.Push, channel: "itwin.event", data: ["event"], sequence: -1 }),
        /Mobile RPC socket is not open\./,
      );

      // An undeliverable reply to a frontend invoke is dropped; the frontend settles its own pending invocations.
      transport.send({ type: IpcWebSocketMessageType.Response, channel: "itwin.invoke", response: 1, data: ["result"], sequence: -1 });
      strictEqual(lateErrors.includes("Dropped IPC response: socket failed."), true);

      // A late ordinary RPC reply is dropped without crashing the backend.
      release();
      while (!lateErrors.includes("Dropped mobile RPC response: socket failed."))
        await setImmediate();
      process.stdout.write("Backend survived late replies.\n");
      return;
    }

    const closed = once(client, "close");
    client.close();
    await closed;
    process.stdout.write("Client disconnected.\n");

    const loggedErrors: unknown[] = [];
    Logger.logError = (_category, message) => { loggedErrors.push(message); };
    if (mode === "string")
      throws(() => interop.sendString("late response", interop.connectionId), /Mobile RPC socket is not open\./);
    else
      throws(() => interop.sendBinary(new Uint8Array([4, 5, 6]), interop.connectionId), /Mobile RPC socket is not open\./);

    await setImmediate();
    deepStrictEqual(loggedErrors, ["Cannot send mobile RPC message: socket is not open."]);
    process.stdout.write("Backend survived the late send.\n");
  } finally {
    client?.terminate();
    server[Symbol.dispose]();
  }
}

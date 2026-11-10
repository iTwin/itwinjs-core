import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { once } from "node:events";
import { setImmediate } from "node:timers/promises";
import * as WebSocket from "ws";
import { Logger } from "@itwin/core-bentley";
import { MobileHost } from "../../backend/MobileHost";
import { MobileRpcServer } from "../../backend/MobileRpcServer";

export async function run(mode: "connected" | "pending" | "string" | "binary" | "callback-error" | "throw-error" | "socket-error" | "missing-connection"): Promise<void> {
  MobileHost.reconnect = () => undefined;
  const pending = mode === "pending" ? ["pending response", new Uint8Array([9])] : undefined;
  const server = new MobileRpcServer(pending);
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

    const closed = once(client, "close");
    client.close();
    await closed;
    process.stdout.write("Client disconnected.\n");

    const loggedErrors: unknown[] = [];
    Logger.logError = (_category, message) => { loggedErrors.push(message); };
    if (mode === "string")
      interop.sendString("late response", interop.connectionId);
    else
      interop.sendBinary(new Uint8Array([4, 5, 6]), interop.connectionId);

    await setImmediate();
  deepStrictEqual(loggedErrors, ["Cannot send mobile RPC message: socket is not open."]);
    process.stdout.write("Backend survived the late send.\n");
  } finally {
    client?.terminate();
    server[Symbol.dispose]();
  }
}

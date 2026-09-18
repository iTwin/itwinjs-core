/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IpcWebSocket, IpcWebSocketMessage, IpcWebSocketMessageType, iTwinChannel } from "@itwin/core-common";
import { chromeBackendIdentityHeader, chromeBackendStartupTimeout } from "../common/ChromeTestBackend";
import { fullstackIpcChannel } from "../common/FullStackTestIpc";
import { verifyChromeBackend } from "../frontend/ChromeBackendPreflight";

const backendUrl = "http://127.0.0.1:5010";
const backendId = "owned-backend";
let sockets: TestWebSocket[];
let response: Response;
let reply: boolean;
let ipcResult: unknown;

class TestWebSocket extends EventTarget {
  public readonly requests: IpcWebSocketMessage[] = [];
  public closed = false;
  public constructor(public readonly url: string) {
    super();
    sockets.push(this);
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  public send(part: string) {
    const [serialized, followers] = JSON.parse(part) as [string, number];
    expect(followers).toBe(0);
    const request = JSON.parse(serialized) as IpcWebSocketMessage;
    this.requests.push(request);
    if (reply) {
      const message = {
        type: IpcWebSocketMessageType.Response,
        channel: request.channel,
        response: request.request,
        data: ipcResult,
        sequence: 0,
      };
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify([JSON.stringify(message), 0]) })));
    }
  }

  public close() {
    if (this.closed)
      return;
    this.closed = true;
    queueMicrotask(() => this.dispatchEvent(Object.assign(new Event("close"), { code: 1000 })));
  }
}

beforeEach(() => {
  sockets = [];
  reply = true;
  ipcResult = { result: { commandId: "full-stack-tests", version: "1.0.0" } };
  response = new Response(JSON.stringify({ info: { title: "full-stack-test", version: "v1.0" } }), {
    status: 200,
    headers: { [chromeBackendIdentityHeader]: backendId },
  });
  vi.stubGlobal("fetch", vi.fn(async () => response));
  vi.stubGlobal("WebSocket", TestWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("core Chrome browser preflight", () => {
  it("verifies the real HTTP and IPC routes without installing a global IPC transport", async () => {
    const transport = IpcWebSocket.transport;
    const receivers = [...IpcWebSocket.receivers];
    await verifyChromeBackend(backendUrl, backendId);
    expect(fetch).toHaveBeenCalledWith(`${backendUrl}/v3/swagger.json`, { cache: "no-store", signal: expect.any(AbortSignal) });
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe("ws://127.0.0.1:5010/ipc");
    expect(sockets[0].requests).toEqual([{
      type: IpcWebSocketMessageType.Invoke,
      channel: iTwinChannel(fullstackIpcChannel),
      method: "ping",
      data: [],
      request: 1,
      sequence: 0,
    }]);
    expect(sockets[0].closed).toBe(true);
    expect(IpcWebSocket.transport).toBe(transport);
    expect([...IpcWebSocket.receivers]).toEqual(receivers);
  });

  it("rejects a reachable but different backend before opening an IPC connection", async () => {
    response.headers.set(chromeBackendIdentityHeader, "different-run");
    await expect(verifyChromeBackend(backendUrl, backendId)).rejects.toThrow(/5010\/v3\/swagger.json.*identity/i);
    expect(sockets).toHaveLength(0);
  });

  it("retains the request URL and underlying HTTP failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(verifyChromeBackend(backendUrl, backendId)).rejects.toThrow("http://127.0.0.1:5010/v3/swagger.json: Failed to fetch");
    expect(sockets).toHaveLength(0);
  });

  it("does not mistake an HTTP error page for readiness", async () => {
    response = new Response("Unavailable", { status: 503 });
    await expect(verifyChromeBackend(backendUrl, backendId)).rejects.toThrow("HTTP 503");
  });

  it("requires a successful IPC invocation rather than just an open WebSocket", async () => {
    ipcResult = { error: { message: "Handler unavailable" } };
    await expect(verifyChromeBackend(backendUrl, backendId)).rejects.toThrow(/ws:\/\/127.0.0.1:5010\/ipc.*ping/i);
    expect(sockets[0].closed).toBe(true);
  });

  it("bounds a missing IPC response by the existing startup deadline and closes the socket", async () => {
    vi.useFakeTimers();
    reply = false;
    const opening = verifyChromeBackend(backendUrl, backendId);
    const rejection = expect(opening).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(chromeBackendStartupTimeout);
    await rejection;
    expect(sockets[0].closed).toBe(true);
  });
});

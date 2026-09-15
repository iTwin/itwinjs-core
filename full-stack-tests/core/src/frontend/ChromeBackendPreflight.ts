/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IpcWebSocketMessage, IpcWebSocketMessageType, IpcWebSocketTransport, iTwinChannel } from "@itwin/core-common";
import { chromeBackendIdentityHeader, chromeBackendStartupTimeout } from "../common/ChromeTestBackend";
import { fullstackIpcChannel } from "../common/FullStackTestIpc";

// Use the normal IPC codec without installing IpcApp's process-global transport.
class PreflightTransport extends IpcWebSocketTransport {
  public constructor(private readonly _socket: WebSocket) { super(); }
  public send(message: IpcWebSocketMessage) {
    for (const part of this.serialize(message))
      this._socket.send(part);
  }
  public async receive(data: unknown) { return this.notifyIncoming(data, this._socket); }
  public close() { this.notifyClose(this._socket); }
}

async function pingBackend(url: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const socket = new WebSocket(url);
  const transport = new PreflightTransport(socket);
  const channel = iTwinChannel(fullstackIpcChannel);
  let onAbort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      let received = false;
      onAbort = () => reject(new Error("Timed out waiting for the IPC ping and connection close."));
      signal.addEventListener("abort", onAbort, { once: true });
      socket.addEventListener("open", () => {
        try {
          transport.send({ type: IpcWebSocketMessageType.Invoke, channel, method: "ping", data: [], request: 1, sequence: 0 });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, { once: true });
      socket.addEventListener("message", (event) => {
        void transport.receive(event.data).then((message) => {
          if (message.type !== IpcWebSocketMessageType.Response || message.channel !== channel || message.response !== 1)
            return;
          const response = message.data as unknown as { result?: { commandId?: string, version?: string } } | undefined;
          if (response?.result?.commandId !== "full-stack-tests" || response.result.version !== "1.0.0")
            throw new Error("The backend did not return a successful test IPC ping.");
          received = true;
          socket.close();
        }).catch(reject);
      });
      socket.addEventListener("error", () => reject(new Error("WebSocket connection error.")), { once: true });
      socket.addEventListener("close", (event) => {
        if (received)
          resolve();
        else
          reject(new Error(`WebSocket closed before the IPC ping completed (code ${event.code}).`));
      }, { once: true });
    });
  } finally {
    if (onAbort)
      signal.removeEventListener("abort", onAbort);
    socket.close();
    transport.close();
  }
}

/** Verify both browser transports before any model-test hooks run. @internal */
export async function verifyChromeBackend(backendUrl: string, backendId: string): Promise<void> {
  let url = `${backendUrl}/v3/swagger.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), chromeBackendStartupTimeout);
  try {
    if (!backendId)
      throw new Error("The root setup did not provide a backend identity.");
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (response.status !== 200)
      throw new Error(`HTTP ${response.status}.`);
    if (response.headers.get(chromeBackendIdentityHeader) !== backendId)
      throw new Error("Backend identity does not match this Vitest run.");
    const description = await response.json() as { info?: { title?: string, version?: string } } | null;
    if (description?.info?.title !== "full-stack-test" || description.info.version !== "v1.0")
      throw new Error("Unexpected backend Swagger description.");
    const socketUrl = new URL("/ipc", backendUrl);
    socketUrl.protocol = "ws:";
    url = socketUrl.toString();
    await pingBackend(url, controller.signal);
  } catch (error) {
    throw new Error(`Core Chrome backend preflight failed at ${url}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

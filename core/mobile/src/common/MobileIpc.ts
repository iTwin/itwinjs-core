/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import {
  IpcWebSocket, IpcWebSocketMessage, IpcWebSocketMessageType, IpcWebSocketTransport, RpcInterface, RpcManager, RpcMarshaling, RpcRequestFulfillment,
  SerializedRpcRequest, serializeIpcError,
} from "@itwin/core-common";
import { Logger } from "@itwin/core-bentley";
import { MobileEventLoop } from "./MobileEventLoop";
import { MobileRpcProtocol } from "./MobileRpcProtocol";
import { MobileRpcRequest } from "./MobileRpcRequest";

const IPC = "__ipc__";

class IpcInterface extends RpcInterface {
  public static interfaceName = IPC;
  public static interfaceVersion = "0.0.0";
  public async send() { }
}

/** @internal */
export class MobileIpcTransport extends IpcWebSocketTransport {
  private _protocol: MobileRpcProtocol;
  private _client: IpcInterface;
  /** Maps in-flight invoke request ids to their channels. Retains no arguments so large upload buffers are released once sent. */
  private _pendingInvocations = new Map<number, string>();

  public constructor(protocol: MobileRpcProtocol) {
    super();
    this._protocol = protocol;

    RpcManager.initializeInterface(IpcInterface);
    this._client = RpcManager.getClientForInterface(IpcInterface);
  }

  public send(message: IpcWebSocketMessage): void {
    if (message.type === IpcWebSocketMessageType.Send || message.type === IpcWebSocketMessageType.Invoke) {
      this.sendToBackend(message); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else if (message.type === IpcWebSocketMessageType.Push || message.type === IpcWebSocketMessageType.Response) {
      this.sendToFrontend(message);
    }
  }

  public consumeRequest(request: SerializedRpcRequest): boolean {
    if (request.operation.interfaceDefinition !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, request.parameters)[0] as IpcWebSocketMessage;
    this.broadcast({} as Event, message);
    return true;
  }

  public consumeResponse(response: RpcRequestFulfillment): boolean {
    if (response.interfaceName !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, response.result) as IpcWebSocketMessage;
    if (message.response !== undefined)
      this._pendingInvocations.delete(message.response);
    this.broadcast({} as Event, message);
    return true;
  }

  private async sendToBackend(message: IpcWebSocketMessage) {
    const invocation = (message.type === IpcWebSocketMessageType.Invoke && message.request !== undefined)
      ? { request: message.request, channel: message.channel }
      : undefined;
    if (invocation)
      this._pendingInvocations.set(invocation.request, invocation.channel);

    const socket = this._protocol.socket;
    try {
      using request = new MobileRpcRequest(this._client, "send", [message], this._protocol);
      const encoded = await MobileRpcProtocol.encodeRequest(request);
      if (socket !== this._protocol.socket)
        return;
      if (message.type === IpcWebSocketMessageType.Invoke && (invocation === undefined || !this._pendingInvocations.has(invocation.request)))
        return;

      this._protocol.sendToBackend(encoded);
    } catch (error) {
      if (invocation)
        this.failInvocation(invocation.channel, invocation.request, error);
      else
        Logger.logError("core-mobile.MobileIpc", "Mobile IPC send failed.", { error });
    }
  }

  public notifyConnectionError(error: Error): void {
    const pending = Array.from(this._pendingInvocations.entries());
    for (const [request, channel] of pending)
      this.failInvocation(channel, request, error);
  }

  private failInvocation(channel: string, request: number, error: unknown) {
    if (!this._pendingInvocations.delete(request))
      return;

    this.broadcast({} as Event, {
      type: IpcWebSocketMessageType.Response, channel, response: request, sequence: -1,
      data: serializeIpcError(error, false) as any,
    });
  }

  private sendToFrontend(message: IpcWebSocketMessage) {
    MobileEventLoop.addTask();
    const result = RpcMarshaling.serialize(this._protocol, message);
    MobileEventLoop.removeTask();

    const fulfillment: RpcRequestFulfillment = { result, rawResult: message, interfaceName: IPC, id: message.channel, status: 0 };
    const encoded = MobileRpcProtocol.encodeResponse(fulfillment);
    try {
      this._protocol.sendToFrontend(encoded);
    } catch (error) {
      // Backend-originated messages (IpcHost.send / IpcHost.invoke) must observe the transport failure so pending invokes reject.
      if (message.type !== IpcWebSocketMessageType.Response)
        throw error;

      // An undeliverable reply to a frontend invoke is safe to drop: the frontend settles its own pending invocations on disconnect.
      Logger.logError("core-mobile.MobileIpc", "Dropped IPC response: socket failed.", { error });
    }
  }

  private broadcast(evt: Event, message: IpcWebSocketMessage) {
    for (const listener of IpcWebSocket.receivers)
      listener(evt, message);
  }
}

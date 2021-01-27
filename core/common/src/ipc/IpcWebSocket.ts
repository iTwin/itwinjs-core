/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { BackendIpc } from "./BackendIpc";
import { FrontendIpc } from "./FrontendIpc";
import { IpcListener, IpcSocket, IpcSocketBackend, IpcSocketFrontend, RemoveFunction } from "./IpcSocket";

/** @internal */
export abstract class IpcWebSocketTransport {
  public abstract send(message: IpcWebSocketMessage): void;
}

/** @internal */
export enum IpcWebSocketMessageType {
  Send,
  Push,
  Invoke,
  Response
}

/** @internal */
export interface IpcWebSocketMessage {
  type: IpcWebSocketMessageType;
  request?: number;
  response?: number;
  channel: string;
  method?: string;
  data?: any[];
}

/** @internal */
export abstract class IpcWebSocket implements IpcSocket {
  public static transport: IpcWebSocketTransport;
  public static receivers: Set<(evt: Event, message: IpcWebSocketMessage) => void> = new Set();

  protected _channels = new Map<string, Set<IpcListener>>();

  public constructor() {
    IpcWebSocket.receivers.add(async (e, m) => this.broadcast(e, m));
  }

  public abstract send(channel: string, ...data: any[]): void;

  public addListener(channel: string, listener: IpcListener): RemoveFunction {
    let listeners = this._channels.get(channel);
    if (!listeners) {
      listeners = new Set();
      this._channels.set(channel, listeners);
    }

    if (!listeners.has(listener))
      listeners.add(listener);

    return () => listeners!.delete(listener);
  }

  public removeListener(channel: string, listener: IpcListener) {
    this._channels.get(channel)?.delete(listener);
  }

  private async broadcast(evt: Event, message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Send && message.type !== IpcWebSocketMessageType.Push)
      return;

    const handlers = this._channels.get(message.channel);
    if (!handlers)
      return;

    let arg = message.data;
    if (typeof (arg) === "undefined")
      arg = [];

    for (const handler of handlers)
      handler(evt, ...arg);
  }
}

/** @internal */
export class IpcWebSocketFrontend extends IpcWebSocket implements IpcSocketFrontend {
  private _nextRequest = 0;
  private _pendingRequests = new Map<number, (response: any) => void>();

  public constructor() {
    super();
    IpcWebSocket.receivers.add(async (e, m) => this.dispatch(e, m));
    FrontendIpc.initialize(this);
  }

  public send(channel: string, ...data: any[]): void {
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Send, channel, data });
  }

  public async invoke(channel: string, methodName: string, ...args: any[]): Promise<any> {
    const requestId = ++this._nextRequest;
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Invoke, channel, method: methodName, data: args, request: requestId });

    return new Promise((resolve) => {
      this._pendingRequests.set(requestId, resolve);
    });
  }

  private async dispatch(_evt: Event, message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Response || !message.response)
      return;

    const pendingHandler = this._pendingRequests.get(message.response);
    if (!pendingHandler)
      return;

    this._pendingRequests.delete(message.response);
    pendingHandler(message.data);
  }
}

/** @internal */
export class IpcWebSocketBackend extends IpcWebSocket implements IpcSocketBackend {
  private _handlers = new Map<string, (event: Event, methodName: string, ...args: any[]) => Promise<any>>();

  public constructor() {
    super();
    IpcWebSocket.receivers.add(async (e, m) => this.dispatch(e, m));
    BackendIpc.initialize(this);
  }

  public send(channel: string, ...data: any[]): void {
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Push, channel, data });
  }

  public handle(channel: string, handler: (event: Event, methodName: string, ...args: any[]) => Promise<any>): RemoveFunction {
    this._handlers.set(channel, handler);

    return () => {
      if (this._handlers.get(channel) === handler)
        this._handlers.delete(channel);
    };
  }

  private async dispatch(_evt: Event, message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Invoke || !message.method)
      return;

    const handler = this._handlers.get(message.channel);
    if (!handler)
      return;

    let args = message.data;
    if (typeof (args) === "undefined")
      args = [];

    const response = await handler({} as any, message.method, ...args);

    IpcWebSocket.transport.send({
      type: IpcWebSocketMessageType.Response,
      channel: message.channel,
      response: message.request,
      data: response,
    });
  }
}

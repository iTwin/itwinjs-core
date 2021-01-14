/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IpcListener, IpcSocket, IpcSocketBackend, IpcSocketFrontend, RemoveFunction } from "./IpcSocket";

/** @alpha */
export abstract class IpcWebSocketTransport {
  public abstract send(message: IpcWebSocketMessage): void;
  public abstract listen(handler: (message: IpcWebSocketMessage) => void): void;
}

/** @alpha */
export enum IpcWebSocketMessageType {
  Send,
  Push,
  Invoke,
  Response
}

/** @alpha */
export interface IpcWebSocketMessage {
  type: IpcWebSocketMessageType,
  request?: number,
  response?: number,
  channel: string,
  method?: string,
  data?: any[],
}

/** @alpha */
export abstract class IpcWebSocket implements IpcSocket {
  public static transport: IpcWebSocketTransport;

  protected _channels = new Map<string, Set<IpcListener>>();

  public constructor() {
    IpcWebSocket.transport.listen((m) => this.broadcast(m));
  }

  public abstract send(channel: string, ...data: any[]): void;

  public receive(channel: string, listener: IpcListener): RemoveFunction {
    let listeners = this._channels.get(channel);
    if (!listeners) {
      listeners = new Set();
      this._channels.set(channel, listeners);
    }

    if (!listeners.has(listener)) {
      listeners.add(listener);
    }

    return () => listeners!.delete(listener);
  }

  private async broadcast(message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Send && message.type !== IpcWebSocketMessageType.Push) {
      return;
    }

    const handlers = this._channels.get(message.channel);
    if (!handlers) {
      return;
    }

    let arg = message.data;
    if (typeof (arg) === "undefined") {
      arg = [];
    }

    for (const handler of handlers) {
      handler({}, ...arg);
    }
  }
}

/** @alpha */
export class IpcWebSocketFrontend extends IpcWebSocket implements IpcSocketFrontend {
  private _nextRequest = 0;
  private _pendingRequests = new Map<number, (response: any) => void>();

  public constructor() {
    super();
    IpcWebSocket.transport.listen((m) => this.dispatch(m));
  }

  public send(channel: string, ...data: any[]): void {
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Send, channel, data });
  }

  public invoke(channel: string, methodName: string, ...args: any[]): Promise<any> {
    const requestId = ++this._nextRequest;
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Invoke, channel, method: methodName, data: args, request: requestId });

    return new Promise((resolve) => {
      this._pendingRequests.set(requestId, resolve);
    });
  }

  private async dispatch(message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Response || !message.response) {
      return;
    }

    const pendingHandler = this._pendingRequests.get(message.response);
    if (!pendingHandler) {
      return;
    }

    this._pendingRequests.delete(message.response);
    pendingHandler(message.data);
  }
}

/** @alpha */
export class IpcWebSocketBackend extends IpcWebSocket implements IpcSocketBackend {
  private _handlers = new Map<string, (methodName: string, ...args: any[]) => Promise<any>>();

  public constructor() {
    super();
    IpcWebSocket.transport.listen((m) => this.dispatch(m));
  }

  public send(channel: string, ...data: any[]): void {
    IpcWebSocket.transport.send({ type: IpcWebSocketMessageType.Push, channel, data });
  }

  public handle(channel: string, handler: (methodName: string, ...args: any[]) => Promise<any>): RemoveFunction {
    this._handlers.set(channel, handler);

    return () => {
      if (this._handlers.get(channel) === handler) {
        this._handlers.delete(channel);
      };
    };
  }

  private async dispatch(message: IpcWebSocketMessage) {
    if (message.type !== IpcWebSocketMessageType.Invoke || !message.method) {
      return;
    }

    const handler = this._handlers.get(message.channel);
    if (!handler) {
      return;
    }

    let args = message.data;
    if (typeof (args) === "undefined") {
      args = [];
    }

    const response = await handler(message.method, ...args);

    IpcWebSocket.transport.send({
      type: IpcWebSocketMessageType.Response,
      channel: message.channel,
      response: message.request,
      data: response
    });
  }
}

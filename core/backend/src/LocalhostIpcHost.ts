/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as ws from "ws";
import {
  InterceptedRpcRequest, IpcWebSocket, IpcWebSocketBackend, IpcWebSocketMessage, IpcWebSocketTransport, rpcOverIpcStrings, RpcSessionInvocation,
} from "@itwin/core-common";
import { IModelHostOptions } from "./IModelHost";
import { IpcHandler, IpcHost } from "./IpcHost";

/** @internal */
export interface LocalhostIpcHostOpts {
  socketPort?: number;
  noServer?: boolean;
}

class LocalTransport extends IpcWebSocketTransport {
  private _server: ws.Server | undefined;
  private _connections: Map<ws, number> = new Map();

  public constructor(opts: LocalhostIpcHostOpts) {
    super();

    if (!opts.noServer) {
      this._server = new ws.Server({ port: opts.socketPort ?? 3002 });
      this._server.on("connection", (connection) => LocalhostIpcHost.connect(connection));
    }
  }

  public send(message: IpcWebSocketMessage): void {
    this._connections.forEach((last, connection) => {
      message.sequence = last + 1;
      this._connections.set(connection, message.sequence);
      const parts = this.serialize(message);
      parts.forEach((part) => connection.send(part));
    });
  }

  public connect(connection: ws) {
    this._connections.set(connection, -1);

    connection.on("message", async (data) => {
      const message = await this.notifyIncoming(data, connection);
      if (IpcWebSocketMessage.skip(message)) {
        return;
      }

      for (const listener of IpcWebSocket.receivers) {
        listener({} as Event, message);
      }
    });

    connection.on("close", () => {
      this._connections.delete(connection);
      this.notifyClose(connection);
    });
  }
}

class RpcHandler extends IpcHandler {
  public channelName = rpcOverIpcStrings.channelName;

  public async request(info: InterceptedRpcRequest) {
    const invocation = RpcSessionInvocation.create(info);
    const fulfillment = await invocation.fulfillment;
    return invocation.rejected ? Promise.reject(fulfillment.rawResult) : fulfillment.rawResult;
  }
}

/** @internal */
export class LocalhostIpcHost {
  private static _initialized = false;
  public static socket: IpcWebSocketBackend;

  public static connect(connection: ws) {
    (IpcWebSocket.transport as LocalTransport).connect(connection);
  }

  public static async startup(opts?: { localhostIpcHost?: LocalhostIpcHostOpts, iModelHost?: IModelHostOptions }) {
    let registerHandler = false;

    if (!this._initialized) {
      registerHandler = true;
      IpcWebSocket.transport = new LocalTransport(opts?.localhostIpcHost ?? {});
      this.socket = new IpcWebSocketBackend();
      this._initialized = true;
    }

    await IpcHost.startup({ ipcHost: { socket: this.socket }, iModelHost: opts?.iModelHost });

    if (registerHandler)
      RpcHandler.register();
  }
}

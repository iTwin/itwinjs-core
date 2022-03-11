/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as ws from "ws";
import { IpcWebSocket, IpcWebSocketBackend, IpcWebSocketMessage, IpcWebSocketTransport } from "@itwin/core-common";
import { IpcHost } from "./IpcHost";
import { IModelHostConfiguration } from "./IModelHost";

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

/** @internal */
export class LocalhostIpcHost {
  private static _initialized = false;
  private static _socket: IpcWebSocketBackend;

  public static connect(connection: ws) {
    (IpcWebSocket.transport as LocalTransport).connect(connection);
  }

  public static async startup(opts?: { localhostIpcHost?: LocalhostIpcHostOpts, iModelHost?: IModelHostConfiguration }) {
    if (!this._initialized) {
      IpcWebSocket.transport = new LocalTransport(opts?.localhostIpcHost ?? {});
      this._socket = new IpcWebSocketBackend();
      this._initialized = true;
    }

    await IpcHost.startup({ ipcHost: { socket: this._socket }, iModelHost: opts?.iModelHost });
  }
}

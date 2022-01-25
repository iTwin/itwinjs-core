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
  private _connections: Set<ws> = new Set();

  public constructor(opts: LocalhostIpcHostOpts) {
    super();

    if (!opts.noServer) {
      this._server = new ws.Server({ port: opts.socketPort ?? 3002 });
      this._server.on("connection", (connection) => LocalhostIpcHost.connect(connection));
    }
  }

  public send(message: IpcWebSocketMessage): void {
    this._connections.forEach((connection) => {
      const parts = this.serialize(message);
      parts.forEach((part) => connection.send(part));
    });
  }

  public connect(connection: ws) {
    this._connections.add(connection);

    connection.on("message", async (data) => {
      const message = await this.notifyIncoming(data);
      if (IpcWebSocketMessage.skip(message)) {
        return;
      }

      for (const listener of IpcWebSocket.receivers) {
        listener({} as Event, message);
      }
    });

    connection.on("close", () => {
      this._connections.delete(connection);
    });
  }
}

/** @internal */
export class LocalhostIpcHost {
  public static connect(connection: ws) {
    (IpcWebSocket.transport as LocalTransport).connect(connection);
  }

  public static async startup(opts?: { localhostIpcHost?: LocalhostIpcHostOpts, iModelHost?: IModelHostConfiguration }) {
    IpcWebSocket.transport = new LocalTransport(opts?.localhostIpcHost ?? {});
    const socket = new IpcWebSocketBackend();
    await IpcHost.startup({ ipcHost: { socket }, iModelHost: opts?.iModelHost });
  }
}

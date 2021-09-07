/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as ws from "ws";
import { IpcWebSocket, IpcWebSocketBackend, IpcWebSocketMessage, IpcWebSocketTransport } from "@bentley/imodeljs-common";
import { IpcHost } from "./IpcHost";
import { IModelHostConfiguration } from "./IModelHost";

/** @internal */
export interface LocalhostIpcHostOpts {
  socketPort?: number;
  noServer?: boolean;
}

class LocalTransport extends IpcWebSocketTransport {
  private _server: ws.Server | undefined;
  private _connection: ws | undefined;

  public constructor(opts: LocalhostIpcHostOpts) {
    super();

    if (!opts.noServer) {
      this._server = new ws.Server({ port: opts.socketPort ?? 3002 });
      this._server.on("connection", (connection) => LocalhostIpcHost.connect(connection));
    }
  }

  public send(message: IpcWebSocketMessage): void {
    this._connection!.send(JSON.stringify(message));
  }

  public connect(connection: ws) {
    this._connection = connection;

    this._connection.on("message", (data) => {
      for (const listener of IpcWebSocket.receivers) {
        listener({} as Event, JSON.parse(data as string));
      }
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

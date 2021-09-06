/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as ws from "ws";
import * as http from "http";
import { IpcWebSocket, IpcWebSocketBackend, IpcWebSocketMessage, IpcWebSocketTransport } from "@bentley/imodeljs-common";
import { IpcHost } from "./IpcHost";
import { IModelHostConfiguration } from "./IModelHost";

class LocalTransport extends IpcWebSocketTransport {
  private _server: ws.Server;
  private _connection: ws | undefined;
  private _ready: Promise<void>;

  public get ready() { return this._ready; }

  public constructor(port: number, server: http.Server) {
    super();

    this._server = new ws.Server({ port, server });

    this._server.on("connection", (connection) => {
      this._connection = connection;

      this._connection.on("message", (data) => {
        for (const listener of IpcWebSocket.receivers)
          listener({} as Event, JSON.parse(data as string));
      });
    });

    this._ready = new Promise((resolve, reject) => {
      try {
        server.listen(port, resolve);
      } catch (err) {
        reject(err);
      }
    });
  }

  public send(message: IpcWebSocketMessage): void {
    this._connection!.send(JSON.stringify(message));
  }
}

/** @internal */
export interface LocalhostIpcHostOpts {
  socketPort?: number;
  appRequestListener?: http.RequestListener;
}

/** @internal */
export class LocalhostIpcHost {
  public static async startup(opts?: { localhostIpcHost?: LocalhostIpcHostOpts, iModelHost?: IModelHostConfiguration }) {
    const server = http.createServer();
    if (opts?.localhostIpcHost?.appRequestListener) {
      server.on("request", opts.localhostIpcHost.appRequestListener);
    }

    const transport = new LocalTransport(opts?.localhostIpcHost?.socketPort ?? 3002, server);
    IpcWebSocket.transport;
    await transport.ready;

    const socket = new IpcWebSocketBackend();
    await IpcHost.startup({ ipcHost: { socket }, iModelHost: opts?.iModelHost });
  }
}

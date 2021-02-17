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

class LocalTransport extends IpcWebSocketTransport {
  private _server: ws.Server;
  private _connection: ws | undefined;

  public constructor(port: number) {
    super();

    this._server = new ws.Server({ port });

    this._server.on("connection", (connection) => {
      this._connection = connection;

      this._connection.on("message", (data) => {
        for (const listener of IpcWebSocket.receivers)
          listener({} as Event, JSON.parse(data as string));
      });
    });
  }

  public send(message: IpcWebSocketMessage): void {
    this._connection!.send(JSON.stringify(message));
  }
}

/** @alpha */
export class LocalWebViewerHost {
  public static async initializeIpc(port: number) {
    IpcWebSocket.transport = new LocalTransport(port);
    const socket = new IpcWebSocketBackend();
    await IpcHost.startup({ ipcHost: { socket } });
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

import { IpcWebSocket, IpcWebSocketFrontend, IpcWebSocketMessage, IpcWebSocketTransport } from "@bentley/imodeljs-common";
import { IpcApp } from "./IpcApp";

class LocalTransport extends IpcWebSocketTransport {
  private _client: WebSocket;

  public constructor(port: number) {
    super();

    this._client = new WebSocket(`ws://localhost:${port}/`);

    this._client.addEventListener("message", async (event) => {
      for (const listener of IpcWebSocket.receivers)
        listener({} as Event, JSON.parse(event.data as string));
    });
  }

  public send(message: IpcWebSocketMessage): void {
    this._client.send(JSON.stringify(message));
  }
}

/** @internal */
export class LocalhostIpcApp {
  public static async startup(port: number) {
    IpcWebSocket.transport = new LocalTransport(port);
    const ipc = new IpcWebSocketFrontend();
    await IpcApp.startup({ ipcApp: { ipc } });
  }
}

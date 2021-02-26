/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

import { IpcWebSocket, IpcWebSocketFrontend, IpcWebSocketMessage, IpcWebSocketTransport } from "@bentley/imodeljs-common";
import { IModelAppOptions } from "./IModelApp";
import { IpcApp } from "./IpcApp";
import { WebViewerApp, WebViewerAppOptions } from "./WebViewerApp";

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

/**
 * To be used only by test applications that want to test web-based editing using localhost.
 * This is both a `WebViewerApp` and an `IpcApp`, and it initializes both.
 *  @internal
 */
export class LocalhostIpcApp {
  public static async startup(opts: { localhostIpcApp?: { socketPort?: number }, webViewerApp: WebViewerAppOptions, iModelApp?: IModelAppOptions }) {
    IpcWebSocket.transport = new LocalTransport(opts?.localhostIpcApp?.socketPort ?? 3002);
    const ipc = new IpcWebSocketFrontend();
    await IpcApp.startup({ ipcApp: { ipc }, iModelApp: opts?.iModelApp });
    await WebViewerApp.startup(opts); // this also attempts to initialize IModelApp, that's ok.
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

import { IpcWebSocket, IpcWebSocketFrontend, IpcWebSocketMessage, IpcWebSocketTransport } from "@itwin/core-common";
import { IpcApp } from "./IpcApp";
import { IModelAppOptions } from "./IModelApp";

/** @internal */
export interface LocalHostIpcAppOpts {
  iModelApp?: IModelAppOptions;

  localhostIpcApp?: {
    socketPort?: number;
    socketUrl?: URL;
  };
}

class LocalTransport extends IpcWebSocketTransport {
  private _client: WebSocket;
  private _pending?: IpcWebSocketMessage[] = [];

  public constructor(opts: LocalHostIpcAppOpts) {
    super();

    let url: URL;
    if (opts?.localhostIpcApp?.socketUrl) {
      url = opts?.localhostIpcApp?.socketUrl;
    } else {
      const port = opts?.localhostIpcApp?.socketPort ?? 3002;
      url = new URL(`ws://localhost:${port}/`);
    }

    this._client = new WebSocket(url);

    this._client.addEventListener("open", () => {
      const pending = this._pending!;
      this._pending = undefined;
      pending.forEach((m) => this.send(m));
    });

    this._client.addEventListener("message", async (event) => {
      const message = await this.notifyIncoming(event.data);
      if (IpcWebSocketMessage.skip(message)) {
        return;
      }

      for (const listener of IpcWebSocket.receivers)
        listener({} as Event, message);
    });
  }

  public send(message: IpcWebSocketMessage): void {
    if (this._pending) {
      this._pending.push(message);
      return;
    }

    const parts = this.serialize(message);
    parts.forEach((part) => this._client.send(part));
  }
}

/**
 * To be used only by test applications that want to test web-based editing using localhost.
 *  @internal
 */
export class LocalhostIpcApp {
  public static buildUrlForSocket(base: URL, path = "ipc"): URL {
    const url = new URL(base);
    url.protocol = "ws";
    url.pathname = [...url.pathname.split("/"), path].filter((v) => v).join("/");
    return url;
  }

  public static async startup(opts: LocalHostIpcAppOpts) {
    IpcWebSocket.transport = new LocalTransport(opts);
    const ipc = new IpcWebSocketFrontend();
    await IpcApp.startup(ipc, opts);
  }
}

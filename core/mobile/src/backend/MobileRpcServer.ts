/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as ws from "ws";
import { BentleyStatus, IModelError } from "@itwin/core-common";
import { MobileRpcGateway, MobileRpcProtocol } from "../common/MobileRpcProtocol";
import { MobileRpcConfiguration } from "../common/MobileRpcManager";
import { MobileHost } from "./MobileHost";
import { ProcessDetector } from "@itwin/core-bentley";

/* eslint-disable deprecation/deprecation */

interface MobileAddon {
  notifyListening: (port: number) => void;
  registerDeviceImpl: () => void;
}

let addon: MobileAddon | undefined;

/** @internal */
export class MobileRpcServer {
  private static _nextId = -1;

  public static interop: MobileRpcGateway = {
    handler: (_payload: ArrayBuffer | string) => { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); },
    sendString: (_message: string, _connectionId: number) => { throw new IModelError(BentleyStatus.ERROR, "No connection."); },
    sendBinary: (_message: Uint8Array, _connectionId: number) => { throw new IModelError(BentleyStatus.ERROR, "No connection."); },
    port: 0,
    connectionId: 0,
  };

  private _server: ws.Server;
  private _connection: ws | undefined;
  private _port: number;
  private _connectionId: number;
  private _pingTimer: NodeJS.Timeout;
  public constructor(private _pendingMessages: Array<string | Uint8Array> | undefined = undefined) {
    /* _pingTime is a fix for ios/mobile case where when the app moves into foreground from
     * background backend restart ws.Server and then notify frontend to reconnect. But ws.Server
     * listening event is not fired as node yield to kevent and wait for some io event to happen.
     * This causes a delay in reconnection which may be as long a 40 secs. To solve the issue we
     * create _pingTimer which causes kevent to yield back to uv poll so timer event can be fired.
     * This allow listening event to go through quickly (max 5ms). Once the listening event occur we
     * clear the timer. Here we use setInterval() just to make sure otherwise setTimeout() could equally
     * be effective
     */
    this._pingTimer = setInterval(() => { }, 5);
    this._port = MobileRpcConfiguration.setup.obtainPort();
    this._server = new ws.Server({ port: this._port });
    this._connectionId = ++MobileRpcServer._nextId;
    MobileRpcServer.interop.connectionId = this._connectionId;
    this._onListening();
    this._onConnection();
  }

  private _onListening() {
    this._server.on("listening", () => {
      const address = this._server.address() as ws.AddressInfo;
      this._port = address.port;
      clearInterval(this._pingTimer);
      this._notifyListening();
    });
  }

  private _notifyListening() {
    MobileRpcServer.interop.port = this._port;

    if (addon) {
      addon.notifyListening(this._port);
    }

    if (this._connectionId !== 0) {
      MobileHost.reconnect(this._port);
    }
  }

  private _onConnection() {
    this._server.on("connection", (connection) => {
      this._connection = connection;
      this._connection.on("message", (data) => this._onConnectionMessage(data));
      this._createSender();
      this._sendPending();
      (global as any).__iTwinJsRpcReady = true;
    });
  }

  private _createSender() {
    const sender = (message: string | Uint8Array, connectionId: number) => {
      if (connectionId !== this._connectionId) {
        return;
      }

      this._connection!.send(message, (err) => {
        if (err) {
          throw err;
        }
      });
    };

    MobileRpcServer.interop.sendString = sender;
    MobileRpcServer.interop.sendBinary = sender;
  }

  private _sendPending() {
    if (this._pendingMessages === undefined)
      return;

    for (const message of this._pendingMessages) {
      this._connection!.send(message, (err) => {
        if (err) {
          throw err;
        }
      });
    }
    this._pendingMessages.length = 0;
  }

  private _onConnectionMessage(data: ws.Data) {
    let message = data;
    if (Array.isArray(message)) {
      throw new IModelError(BentleyStatus.ERROR, "Unsupported data type");
    }

    if (Buffer.isBuffer(message)) {
      if (message.byteOffset !== 0 || message.byteLength !== message.buffer.byteLength) {
        message = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
      } else {
        message = message.buffer;
      }
    }

    MobileRpcServer.interop.handler(message, this._connectionId);
  }

  public dispose() {
    clearInterval(this._pingTimer);
    if (this._connection) {
      MobileRpcServer.interop.sendString = () => { };
      MobileRpcServer.interop.sendBinary = () => { };
      this._connection.close();
    }

    this._server.close();
  }
}

let mobileReady = false;
let hasSuspended = false;

export function setupMobileRpc() {
  if (mobileReady) {
    return;
  }

  if (ProcessDetector.isMobileAppBackend) {
    addon = (process as any)._linkedBinding("iModelJsMobile");
    addon?.registerDeviceImpl();
  }

  let server: MobileRpcServer | null = new MobileRpcServer();

  /* The UV event loop (internal to node) is retained by handles,
     such as those created for setInterval/setTimeout and client/server connections.
     In a simple app, the RPC server may be the only handle retaining the UV loop.
     Thus, we install a temporary timer on suspend to prevent the loop from exiting prematurely.
  */
  let retainUvLoop: NodeJS.Timeout | undefined;
  const pendingMessages: Array<string | Uint8Array> = [];

  function usePendingSender() {
    const sender = (message: string | Uint8Array, _connectionId: number) => {
      pendingMessages.push(message);
    };
    MobileRpcServer.interop.sendString = sender;
    MobileRpcServer.interop.sendBinary = sender;
  }

  MobileHost.onEnterBackground.addListener(() => {
    hasSuspended = true;

    if (server === null) {
      return;
    }

    retainUvLoop = setInterval(() => { }, 1000);
    server.dispose();
    usePendingSender();
    server = null;
  });

  MobileHost.onEnterForeground.addListener(() => {
    if (!hasSuspended) {
      return;
    }

    server = new MobileRpcServer(pendingMessages);
    clearInterval(retainUvLoop);
    retainUvLoop = undefined;
  });

  MobileHost.onWillTerminate.addListener(() => {
    if (typeof (retainUvLoop) !== "undefined") {
      clearInterval(retainUvLoop);
      retainUvLoop = undefined;
    }

    if (server === null) {
      return;
    }

    server.dispose();
    server = null;
  });

  MobileRpcProtocol.obtainInterop = () => MobileRpcServer.interop;
  mobileReady = true;
}

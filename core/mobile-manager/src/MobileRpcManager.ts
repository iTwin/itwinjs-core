/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus, IModelError, RpcConfiguration, RpcEndpoint, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { MobileRpcGateway, MobileRpcProtocol } from "./MobileRpcProtocol";
import * as ws from "ws";

/** RPC supported mobile platforms.
 * @beta
 */
export enum RpcMobilePlatform {
  Unknown,
  Android,
  iOS,
}

/** Holds configuration for the RpcInterfaces used by the application.
 * @beta
 */
export abstract class MobileRpcConfiguration extends RpcConfiguration {
  /** @internal */
  public static setup = {
    obtainPort: () => 0,
    checkPlatform: () => typeof (process) !== "undefined" && (process.platform as any) === "ios",
  };

  public abstract protocol: MobileRpcProtocol;
  private static _args: any;
  private static getArgs(): any {
    if (typeof window !== "object" || typeof window.location !== "object" || typeof window.location.hash !== "string") {
      return Object.freeze({});
    }
    const queryArgs: any = {};
    try {
      const matches = window.location.hash.match(/([^#=&]+)(=([^&]*))?/g);
      if (matches) {
        for (const comp of matches) {
          const array = comp.split("=");
          if (array.length === 2) {
            const key = decodeURIComponent(array[0]);
            const val = decodeURIComponent(array[1]);
            queryArgs[key] = val;
          }
        }
      }
    } catch { }
    return Object.freeze(queryArgs);
  }
  private static getMobilePlatform(): RpcMobilePlatform {
    if (!MobileRpcConfiguration.args.platform)
      return RpcMobilePlatform.Unknown;

    const win: any = window;
    if (/android/i.test(MobileRpcConfiguration.args.platform)) {
      return RpcMobilePlatform.Android;
    }

    if (/iOS|iPadOS/i.test(MobileRpcConfiguration.args.platform) && !win.MSStream) {
      return RpcMobilePlatform.iOS;
    }

    return RpcMobilePlatform.Unknown;
  }
  /** Read the mobile rpc args */
  public static get args(): any {
    if (!this._args) {
      this._args = MobileRpcConfiguration.getArgs();
    }
    return this._args;
  }

  /** Return type of mobile platform using browser userAgent */
  public static get platform(): RpcMobilePlatform { return MobileRpcConfiguration.getMobilePlatform(); }

  /** Check if backend running on mobile */
  public static get isMobileBackend() { return typeof (process) !== "undefined" && (process.platform as any) === "ios"; }

  /** Check if frontend running on mobile */
  public static get isMobileFrontend() { return this.platform !== RpcMobilePlatform.Unknown; }

  /** Check if frontend running on wkwebview on ios */
  public static get isIOSFrontend() { return MobileRpcConfiguration.isMobileFrontend && (window as any).webkit && (window as any).webkit.messageHandlers; }
}

/** Coordinates usage of RPC interfaces for an Mobile-based application.
 * @beta
 */
export class MobileRpcManager {
  /** @internal */
  public static async ready() {
    return new Promise<void>(async (resolve) => {
      while (!(global as any).__imodeljsRpcReady) {
        await new Promise((r) => setTimeout(r));
      }

      resolve();
    });
  }

  private static performInitialization(interfaces: RpcInterfaceDefinition[], endPoint: RpcEndpoint): MobileRpcConfiguration {
    const config = class extends MobileRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: MobileRpcProtocol = new MobileRpcProtocol(this, endPoint);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    return instance;
  }

  /** Initializes MobileRpcManager for the frontend of an application. */
  public static initializeClient(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    return MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Frontend);
  }
  /** Initializes MobileRpcManager for the backend of an application. */
  public static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    return MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Backend);
  }
}

class MobileRpcServer {
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
  public constructor() {
    /* _pingTime is a fix for ios/mobile case where when app move into foreground from
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
      this._notifyConnected();
    });
  }

  private _notifyConnected() {
    MobileRpcServer.interop.port = this._port;
    (global as any).__imodeljsRpcPort = this._port;

    if (this._connectionId !== 0) {
      MobileDevice.currentDevice.reconnect(this._port);
    }
  }

  private _onConnection() {
    this._server.on("connection", (connection) => {
      this._connection = connection;
      this._connection.on("message", (data) => this._onConnectionMessage(data));
      this._createSender();
      (global as any).__imodeljsRpcReady = true;
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

  private _onConnectionMessage(data: ws.Data) {
    let message = data;
    if (Array.isArray(message)) {
      throw new IModelError(BentleyStatus.ERROR, "Unsupported data type");
    }

    if (Buffer.isBuffer(message)) {
      if (message.byteOffset !== 0 || message.byteLength !== message.buffer.byteLength) {
        throw new IModelError(BentleyStatus.ERROR, "Slices are not supported.");
      }

      message = message.buffer;
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

function setupMobileRpc() {
  let server: MobileRpcServer | null = new MobileRpcServer();

  MobileDevice.currentDevice.onEnterBackground.addListener(() => {
    if (server === null) {
      return;
    }

    server.dispose();
    server = null;
  });

  MobileDevice.currentDevice.onEnterForeground.addListener(() => {
    server = new MobileRpcServer();
  });

  MobileRpcProtocol.obtainInterop = () => MobileRpcServer.interop;
}

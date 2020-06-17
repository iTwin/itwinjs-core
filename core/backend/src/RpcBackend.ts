/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import * as multiparty from "multiparty";
import * as FormData from "form-data";
import { BentleyStatus, HttpServerRequest, IModelError, MobileRpcGateway, MobileRpcProtocol, RpcMultipart, RpcSerializedValue } from "@bentley/imodeljs-common";
import * as ws from "ws";
import { Device, DeviceRpc } from "./Device";

let initialized = false;

export function initializeRpcBackend() {
  if (initialized) {
    return;
  }

  initialized = true;

  RpcMultipart.createStream = (value: RpcSerializedValue) => {
    const form = new FormData();
    RpcMultipart.writeValueToForm(form, value);
    return form;
  };

  RpcMultipart.parseRequest = async (req: HttpServerRequest) => {
    return new Promise<RpcSerializedValue>((resolve, reject) => {
      const form = new multiparty.Form({ maxFieldsSize: Infinity });
      form.on("error", (err) => {
        reject(err);
      });

      const value = RpcSerializedValue.create();
      const data: { [index: string]: { size: number, chunks: Buffer[] } } = {};

      form.on("part", (part: multiparty.Part) => {
        part.on("data", (chunk: string | Buffer) => {
          if (part.name === "objects") {
            value.objects += chunk.toString();
          } else if (Buffer.isBuffer(chunk)) {
            if (!data[part.name]) {
              data[part.name] = { size: 0, chunks: [] };
            }

            data[part.name].size += chunk.byteLength;
            data[part.name].chunks.push(chunk);
          } else {
            throw new IModelError(BentleyStatus.ERROR, "Unknown input.");
          }
        });
      });

      form.on("close", () => {
        let i = 0;
        for (; ;) {
          const part = data[`data-${i}`];
          if (!part) {
            break;
          }

          value.data.push(Buffer.concat(part.chunks, part.size));
          ++i;
        }

        resolve(value);
      });

      form.parse(req);
    });
  };

  if (typeof (process) !== "undefined" && (process.platform as any) === "ios") {
    setupMobileRpc();
  }
}

class MobileRpcServer {
  private static _nextId = -1;

  public static interop: MobileRpcGateway = {
    handler: (_payload: ArrayBuffer | string) => { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); },
    sendString: (_message: string, _connectionId: number) => { throw new IModelError(BentleyStatus.ERROR, "No connection."); },
    sendBinary: (_message: Uint8Array, _connectionId: number) => { throw new IModelError(BentleyStatus.ERROR, "No connection."); },
    port: 0,
  };

  private _server: ws.Server;
  private _connection: ws | undefined;
  private _port: number;
  private _connectionId: number;

  public constructor() {
    this._port = 0;
    this._server = new ws.Server({ port: this._port });
    this._connectionId = ++MobileRpcServer._nextId;
    this._onListening();
    this._onConnection();
  }

  private _onListening() {
    this._server.on("listening", () => {
      const address = this._server.address() as ws.AddressInfo;
      this._port = address.port;
      this._notifyConnected();
    });
  }

  private _notifyConnected() {
    MobileRpcServer.interop.port = this._port;
    (global as any).__imodeljsRpcPort = this._port;

    if (this._connectionId !== 0) {
      (Device.currentDevice as DeviceRpc).reconnect!(this._port);
    }
  }

  private _onConnection() {
    this._server.on("connection", (connection) => {
      this._connection = connection;
      this._connection.on("message", (data) => this._onConnectionMessage(data));
      this._createSender();
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

  Device.currentDevice.onEnterBackground.addListener(() => {
    if (server === null) {
      return;
    }

    server.dispose();
    server = null;
  });

  Device.currentDevice.onEnterForground.addListener(() => {
    server = new MobileRpcServer();
  });

  MobileRpcProtocol.obtainInterop = () => MobileRpcServer.interop;
}

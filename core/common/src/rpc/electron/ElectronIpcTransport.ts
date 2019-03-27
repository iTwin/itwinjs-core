/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { SerializedRpcRequest, RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcRequest } from "./ElectronRpcRequest";
import { RpcSerializedValue } from "../core/RpcMarshaling";
import { ElectronRpcProtocol } from "./ElectronRpcProtocol";

const OBJECTS_CHANNEL = "@bentley/imodeljs-common/ElectronRpcProtocol/objects";
const DATA_CHANNEL = "@bentley/imodeljs-common/ElectronRpcProtocol/data";

/** @internal */
export const interop = (() => {
  let electron = null;
  if (typeof (global) !== "undefined" && global && global.process && (global.process as any).type) {
    // tslint:disable-next-line:no-eval
    electron = eval("require")("electron");
  }

  return electron;
})();

interface PartialPayload { id: string; index: number; data: Uint8Array; }

/** @internal */
export interface IpcTransportMessage { id: string; parameters?: RpcSerializedValue; result?: RpcSerializedValue; }

/** @internal */
export abstract class ElectronIpcTransport<TIn extends IpcTransportMessage = IpcTransportMessage, TOut extends IpcTransportMessage = IpcTransportMessage> {
  private _ipc: any;
  private _partials: Map<string, { message: TIn; received: number; } | PartialPayload[]>;

  public sendRequest(request: SerializedRpcRequest) {
    const value = this._extractValue(request);
    this._send(request, value);
  }

  public constructor(ipc: any) {
    this._ipc = ipc;
    this._partials = new Map();
    this._setupDataChannel();
    this._setupObjectsChannel();
  }

  private _setupDataChannel() {
    this._ipc.on(DATA_CHANNEL, async (evt: any, chunk: PartialPayload) => {
      let pending = this._partials.get(chunk.id);
      if (!pending) {
        pending = [];
        this._partials.set(chunk.id, pending);
      }

      if (Array.isArray(pending)) {
        pending.push(chunk);
      } else {
        ++pending.received;

        const value = this._extractValue(pending.message);
        value.data[chunk.index] = chunk.data;

        if (pending.received === (value.chunks || 0)) {
          this.handleComplete(pending.message.id, evt);
        }
      }
    });
  }

  private _setupObjectsChannel() {
    this._ipc.on(OBJECTS_CHANNEL, async (evt: any, message: TIn) => {
      const pending = this._partials.get(message.id);
      if (pending && !Array.isArray(pending)) {
        throw new IModelError(BentleyStatus.ERROR, `Message already received for id "${message.id}".`);
      }

      const partial = { message, received: 0 };
      this._partials.set(message.id, partial);
      const value = this._extractValue(partial.message);

      if (pending && Array.isArray(pending)) {
        for (const chunk of pending) {
          ++partial.received;
          value.data[chunk.index] = chunk.data;
        }
      }

      if (partial.received === (value.chunks || 0)) {
        this.handleComplete(message.id, evt);
      }
    });
  }

  private _extractValue(t: IpcTransportMessage): RpcSerializedValue {
    if (t.parameters) {
      return t.parameters;
    }

    if (t.result) {
      return t.result;
    }

    throw new IModelError(BentleyStatus.ERROR, "Unknown value type.");
  }

  private _send(message: IpcTransportMessage, value: RpcSerializedValue, evt?: any) {
    const chunks = value.data;
    if (chunks.length) {
      value.chunks = chunks.length;
      value.data = [];
    }

    (evt ? evt.sender : this._ipc).send(OBJECTS_CHANNEL, message);

    for (let index = 0; index !== chunks.length; ++index) {
      const chunk: PartialPayload = { id: message.id, index, data: chunks[index] };
      (evt ? evt.sender : this._ipc).send(DATA_CHANNEL, chunk);
    }
  }

  protected abstract handleComplete(id: string, evt: any): void;

  protected sendResponse(message: TOut, evt: any) {
    const value = this._extractValue(message);
    this._send(message, value, evt);
  }

  protected loadMessage(id: string) {
    const partial = this._partials.get(id);
    if (!partial || Array.isArray(partial)) {
      throw new IModelError(BentleyStatus.ERROR, `Incomplete transmission for id "${id}".`);
    }

    this._partials.delete(id);
    return partial.message;
  }
}

class FrontendIpcTransport extends ElectronIpcTransport<RpcRequestFulfillment> {
  protected async handleComplete(id: string) {
    const message = this.loadMessage(id);
    const protocol = ElectronRpcProtocol.instances.get(message.interfaceName) as ElectronRpcProtocol;
    const request = protocol.requests.get(message.id) as ElectronRpcRequest;
    protocol.requests.delete(message.id);
    request.notifyResponse(message);
  }
}

class BackendIpcTransport extends ElectronIpcTransport<SerializedRpcRequest, RpcRequestFulfillment> {
  protected async handleComplete(id: string, evt: any) {
    const message = this.loadMessage(id);

    let response: RpcRequestFulfillment;
    try {
      const protocol = ElectronRpcProtocol.obtainInstance(message);
      response = await protocol.fulfill(message);
    } catch (err) {
      response = await RpcRequestFulfillment.forUnknownError(message, err);
    }

    this.sendResponse(response, evt);
  }
}

let transport: ElectronIpcTransport | undefined;

if (interop) {
  if (interop.ipcMain) {
    transport = new BackendIpcTransport(interop.ipcMain);
  } else if (interop.ipcRenderer) {
    transport = new FrontendIpcTransport(interop.ipcRenderer);
  }
}

/** @internal */
export const ipcTransport = transport;

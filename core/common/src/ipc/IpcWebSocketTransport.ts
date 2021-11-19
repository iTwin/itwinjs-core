/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IpcWebSocketMessage } from "./IpcWebSocket";

let parts: any[] = [];

/** @internal */
export abstract class IpcWebSocketTransport {
  private _partial?: string;
  private _received: any[] = [];
  private _outstanding = 0;

  public abstract send(message: IpcWebSocketMessage): void;

  protected unwrap(data: any) {
    return (typeof (Blob) !== "undefined" && data instanceof Blob) ? data.arrayBuffer() : data;
  }

  protected async notifyIncoming(data: any): Promise<IpcWebSocketMessage> {
    if (this._partial) {
      this._received.push(await this.unwrap(data));
      --this._outstanding;

      if (this._outstanding === 0) {
        parts = this._received;
        const message: IpcWebSocketMessage = JSON.parse(this._partial, reviver);
        this._partial = undefined;
        parts.length = 0;
        return message;
      } else {
        return IpcWebSocketMessage.internal();
      }
    } else {
      const [serialized, followers] = JSON.parse(data);
      if (followers) {
        this._partial = serialized;
        this._outstanding = followers;
        return IpcWebSocketMessage.internal();
      } else {
        const message: IpcWebSocketMessage = JSON.parse(serialized, reviver);
        return message;
      }
    }
  }

  protected serialize(data: IpcWebSocketMessage): any[] {
    parts.length = 0;
    const objects = JSON.stringify(data, replacer);
    const value = [JSON.stringify([objects, parts.length]), ...parts];
    parts.length = 0;
    return value;
  }
}

interface Marker { ipc: "binary", type: number; index: number }
const types = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, DataView];
function identify(value: any) { return Buffer.isBuffer(value) ? 0 : types.indexOf((value as any).constructor); }
function lookup(value: Marker) { return types[value.type]; }

function replacer(this: any, _key: string, value: any) {
  const asBinary = replaceBinary(value);
  if (asBinary) {
    return asBinary;
  }

  return value;
}

function reviver(_key: string, value: any) {
  if (typeof (value) === "object" && value !== null && value.hasOwnProperty("ipc") && value.ipc === "binary") {
    return reviveBinary(value);
  }

  return value;
}

function replaceBinary(value: any): Marker | undefined {
  if (ArrayBuffer.isView(value) || Buffer.isBuffer(value)) {
    const index = parts.push(value) - 1;
    const type = identify(value);
    return { ipc: "binary", type, index };
  } else {
    return undefined;
  }
}

function reviveBinary(value: Marker): ArrayBufferView {
  const constructor = lookup(value);
  const part = parts[value.index];
  return new constructor(part);
}

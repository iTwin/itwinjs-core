/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { Buffer } from "buffer";
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

  protected async notifyIncoming(data: any, connection: any): Promise<IpcWebSocketMessage> {
    if (this._partial) {
      this._received.push(data);
      --this._outstanding;

      if (this._outstanding === 0) {
        const partial = this._partial;
        const received = this._received;
        this._partial = undefined;
        this._received = [];
        await Promise.all(received.map(async (v, i, a) => a[i] = await this.unwrap(v)));

        parts = received;
        const message: IpcWebSocketMessage = JSON.parse(partial, reviver);
        parts.length = 0;

        return InSentOrder.deliver(message, connection);
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
        return InSentOrder.deliver(message, connection);
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

  protected notifyClose(connection: any) {
    InSentOrder.close(connection);
  }
}

interface Marker { ipc: "binary", type: number, index: number }
const types = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, DataView];
function identify(value: any) { return Buffer.isBuffer(value) ? 0 : types.indexOf(value.constructor); }
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

function makePromise<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => { };
  let reject: (reason?: any) => void = () => { };
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/* Reconstructing the sequence in which messages were sent is necessary since
   the binary data for a message has to be awaited in IpcWebSocketTransport.unwrap. */
class InSentOrder {
  private static _connections: Map<any, { queue: InSentOrder[], last: number }> = new Map();

  public static async deliver(message: IpcWebSocketMessage, connection: any): Promise<IpcWebSocketMessage> {
    let context = this._connections.get(connection);
    if (!context) {
      context = { queue: [], last: -1 };
      this._connections.set(connection, context);
    }

    const entry = new InSentOrder(message);
    context.queue.push(entry);
    context.queue.sort((a, b) => a.sequence - b.sequence);

    while (context.queue.length !== 0) {
      const next = context.queue[0];
      const duplicate = next.sequence <= context.last;
      const match = next.sequence === (context.last + 1);

      if (duplicate) {
        next.duplicate = true;
      } else if (match) {
        ++context.last;
      }

      if (duplicate || match) {
        context.queue.shift();
        next.release();
      } else {
        break;
      }
    }

    return entry.message;
  }

  public static close(connection: any) {
    this._connections.delete(connection);
  }

  public release = () => { };
  public sequence: number;
  public duplicate = false;
  public message: Promise<IpcWebSocketMessage>;

  private constructor(message: IpcWebSocketMessage) {
    this.sequence = message.sequence;

    const { promise, resolve } = makePromise<IpcWebSocketMessage>();
    this.message = promise;

    this.release = () => {
      const value = this.duplicate ? IpcWebSocketMessage.duplicate() : message;
      resolve(value);
    };
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { Readable } from "stream";
import { BentleyStatus, IModelError } from "../../IModelError";
import type { RpcProtocol } from "./RpcProtocol";

// cspell:ignore unmarshal

let marshalingTarget: RpcSerializedValue;
let chunkThreshold = 0;

/** @internal */
export interface MarshalingBinaryMarker {
  isBinary: true;
  index: number;
  size: number;
  chunks: number;
}

/** @internal */
export namespace MarshalingBinaryMarker {
  export function createDefault(): MarshalingBinaryMarker {
    return { isBinary: true, index: 0, size: -1, chunks: 1 };
  }
}

/** @internal */
export interface RpcSerializedValue {
  objects: string;
  data: Uint8Array[];
  chunks?: number;
  stream?: Readable;
}

/** @internal */
export namespace RpcSerializedValue {
  export function create(objects = "", data: Uint8Array[] = []): RpcSerializedValue {
    return { objects, data };
  }
}

/** @internal */
export class RpcMarshaling {
  private constructor() { }

  /** Serializes a value. */
  public static async serialize(protocol: RpcProtocol | undefined, value: any): Promise<RpcSerializedValue> {
    const serialized = RpcSerializedValue.create();

    if (typeof (value) === "undefined") {
      return serialized;
    }

    marshalingTarget = serialized;
    chunkThreshold = protocol ? protocol.transferChunkThreshold : 0;
    serialized.objects = JSON.stringify(value, WireFormat.marshal);
    marshalingTarget = undefined as any;
    chunkThreshold = 0;

    return serialized;
  }

  /** Deserializes a value. */
  public static deserialize(protocol: RpcProtocol | undefined, value: RpcSerializedValue): any {
    if (value.objects === "") {
      return undefined;
    }

    marshalingTarget = value;
    chunkThreshold = protocol ? protocol.transferChunkThreshold : 0;
    let result;
    try {
      result = JSON.parse(value.objects, WireFormat.unmarshal);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new IModelError(BentleyStatus.ERROR, `Invalid JSON: "${value.objects}"`);
      throw error;
    }
    marshalingTarget = undefined as any;
    chunkThreshold = 0;

    return result;
  }
}

class WireFormat {
  /** JSON.stringify replacer callback. */
  public static marshal(this: any, _key: string, value: any) {
    const asBinary = WireFormat.marshalBinary(value);
    if (asBinary) {
      return asBinary;
    }

    const asError = WireFormat.marshalError(value);
    if (asError) {
      return asError;
    }

    return value;
  }

  /** JSON.parse reviver callback. */
  public static unmarshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value.hasOwnProperty("isBinary") && value.isBinary) {
      return WireFormat.unmarshalBinary(value);
    }

    return value;
  }

  private static marshalBinary(value: any): any {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      const marker: MarshalingBinaryMarker = { isBinary: true, index: -1, size: value.byteLength, chunks: 1 };

      if (chunkThreshold && value.byteLength > chunkThreshold) {
        marker.index = marshalingTarget.data.length;
        marker.chunks = 0;

        let cursor = value.byteOffset;
        const end = cursor + value.byteLength;
        let chunk = chunkThreshold;

        for (; ;) {
          if (cursor >= end) {
            break;
          }

          marshalingTarget.data.push(new Uint8Array(value.buffer, cursor, chunk));
          ++marker.chunks;
          cursor += chunk;

          const consumed = cursor - value.byteOffset;
          const remaining = value.byteLength - consumed;
          chunk = Math.min(chunkThreshold, remaining);
        }
      } else {
        marker.index = marshalingTarget.data.push(value) - 1;
      }

      return marker;
    } else {
      return undefined;
    }
  }

  private static unmarshalBinary(value: MarshalingBinaryMarker): any {
    if (value.index >= marshalingTarget.data.length) {
      throw new IModelError(BentleyStatus.ERROR, `Cannot unmarshal missing binary value.`);
    }

    if (value.chunks === 0) {
      return new Uint8Array();
    } else if (value.chunks === 1) {
      return new Uint8Array(marshalingTarget.data[value.index]);
    } else {
      const buffer = new ArrayBuffer(value.size);
      const view = new Uint8Array(buffer);

      let cursor = 0;
      for (let c = 0; c !== value.chunks; ++c) {
        const chunk = marshalingTarget.data[value.index + c];
        view.set(chunk, cursor);
        cursor += chunk.byteLength;
      }

      return view;
    }
  }

  private static marshalError(value: any) {
    if (value instanceof Error) {
      const props = Object.getOwnPropertyDescriptors(value);
      props.isError = { configurable: true, enumerable: true, writable: true, value: true };
      props.name = { configurable: true, enumerable: true, writable: true, value: value.name };
      props.message = { configurable: true, enumerable: true, writable: true, value: value.message };
      props.stack = { configurable: true, enumerable: true, writable: true, value: value.stack };
      return Object.create(Object.prototype, props);
    }

    return undefined;
  }
}

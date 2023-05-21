/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";

/** An array of 24-bit indices into a [[VertexTable]].
 * The order of the indices specifies the order in which vertices are drawn.
 * The underlying data type is a `Uint8Array` in which each three consecutive bytes identifies one 24-bit index;
 * therefore, the number of 24-bit indices is one-third the length of the `Uint8Array`.
 * To prevent mistakes, the `length` and `[Symbol.iterator]` properties are erased from the type at compile-time.
 * Use [[VertexIndices.length]] to obtain the number of 24-bit indices and [[VertexIndices.iterator]] to iterate over
 * the 24-bit indices.
 * Use [[VertexIndices.fromBytes]] and [[VertexIndices.toBytes]] to cast to and from a `Uint8Array`.
 * @internal
 */
export type VertexIndices = Omit<{
  [P in keyof Uint8Array]: P extends Symbol ? never : Uint8Array[P];
}, "length">;

/** @internal */
export namespace VertexIndices {
  export function fromBytes(bytes: Uint8Array): VertexIndices {
    assert(0 === bytes.byteLength % 3);
    return bytes as unknown as VertexIndices;
  }

  export function toBytes(indices: VertexIndices): Uint8Array {
    return indices as unknown as Uint8Array;
  }

  export function length(indices: VertexIndices): number {
    return indices.byteLength / 3;
  }

  export function *iterator(indices: VertexIndices): Iterator<number> {
    const len = length(indices);
    for (let i = 0; i < len; i++)
      yield decodeIndex(indices, i);
  }

  export function iterable(indices: VertexIndices): Iterable<number> {
    return {
      [Symbol.iterator]: () => iterator(indices),
    };
  }

  export function fromArray(indices: number[]): VertexIndices {
    const bytes = new Uint8Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++)
      encodeIndex(indices[i], bytes, i * 3);

    return fromBytes(bytes);
  }

  export function encodeIndex(index: number, bytes: Uint8Array, byteIndex: number): void {
    assert(byteIndex + 2 < bytes.length);
    bytes[byteIndex + 0] = index & 0x000000ff;
    bytes[byteIndex + 1] = (index & 0x0000ff00) >> 8;
    bytes[byteIndex + 2] = (index & 0x00ff0000) >> 16;
  }

  export function setNthIndex(indices: VertexIndices, n: number, value: number): void {
    encodeIndex(value, toBytes(indices), n * 3);
  }

  export function decodeIndex(indices: VertexIndices, index: number): number {
    assert(index < length(indices));
    const bytes = toBytes(indices);
    const byteIndex = index * 3;
    return bytes[byteIndex] | (bytes[byteIndex + 1] << 8) | (bytes[byteIndex + 2] << 16);
  }

  export function decodeIndices(vertexIndices: VertexIndices): number[] {
    const indices = [];
    const len = length(vertexIndices);
    for (let i = 0; i < len; i++)
      indices.push(decodeIndex(vertexIndices, i));

    return indices;
  }
}

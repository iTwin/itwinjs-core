/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";

/**
 * Holds an array of indices into a VertexTable. Each index is a 24-bit unsigned integer.
 * The order of the indices specifies the order in which vertices are drawn.
 * @internal
 */
export class VertexIndices implements Iterable<number> {
  public readonly data: Uint8Array;

  /**
   * Directly construct from an array of bytes in which each index occupies 3 contiguous bytes.
   * The length of the array must be a multiple of 3. This object takes ownership of the array.
   */
  public constructor(data: Uint8Array) {
    this.data = data;
    assert(0 === this.data.length % 3);
  }

  /** Get the number of 24-bit indices. */
  public get length(): number { return this.data.length / 3; }

  /** Convert an array of 24-bit unsigned integer values into a VertexIndices object. */
  public static fromArray(indices: number[]): VertexIndices {
    const bytes = new Uint8Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++)
      this.encodeIndex(indices[i], bytes, i * 3);

    return new VertexIndices(bytes);
  }

  public static encodeIndex(index: number, bytes: Uint8Array, byteIndex: number): void {
    assert(byteIndex + 2 < bytes.length);
    bytes[byteIndex + 0] = index & 0x000000ff;
    bytes[byteIndex + 1] = (index & 0x0000ff00) >> 8;
    bytes[byteIndex + 2] = (index & 0x00ff0000) >> 16;
  }

  public setNthIndex(n: number, value: number): void {
    VertexIndices.encodeIndex(value, this.data, n * 3);
  }

  public decodeIndex(index: number): number {
    assert(index < this.length);
    const byteIndex = index * 3;
    return this.data[byteIndex] | (this.data[byteIndex + 1] << 8) | (this.data[byteIndex + 2] << 16);
  }

  public decodeIndices(): number[] {
    const indices = [];
    for (let i = 0; i < this.length; i++)
      indices.push(this.decodeIndex(i));

    return indices;
  }

  public [Symbol.iterator]() {
    function * iterator(indices: VertexIndices) {
      for (let i = 0; i < indices.length; i++)
        yield indices.decodeIndex(i);
    }

    return iterator(this);
  }
}

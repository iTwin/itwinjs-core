/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Numbers } from "../runtime/Numbers";
import { ABuffer } from "./ABuffer";
import { LittleEndian } from "./LittleEndian";

/**
 * Define a signed 32-bit float typed buffer.
 */
/** @internal */
export class Float32Buffer {
  /** The number of bytes per element */
  public static readonly BYTES_PER_ELEMENT: int32 = 4;

  /** The underlying buffer */
  private _buffer: ABuffer;
  /** The byte offset of the first element */
  private _offset: int32;
  /** The number of elements */
  private _count: int32;

  /**
   * Create a new typed buffer.
   */
  public constructor(buffer: ABuffer, offset: int32, size: int32) {
    this._buffer = buffer;
    this._offset = offset;
    this._count = size;
  }

  /**
   * Wrap a raw buffer.
   */
  public static wrap(buffer: ABuffer): Float32Buffer {
    return new Float32Buffer(buffer, 0, Numbers.divInt(buffer.size(), 4));
  }

  /**
   * Get the underlying buffer.
   * @return the underlying buffer.
   */
  public getBuffer(): ABuffer {
    return this._buffer;
  }

  /**
   * Get the length.
   */
  public size(): int32 {
    return this._count;
  }

  /**
   * Get an element.
   */
  public get(index: int32): float32 {
    return LittleEndian.readBufferFloat(this._buffer, this._offset + 4 * index);
  }

  /**
   * Set an element.
   */
  public set(index: int32, value: float32): void {
    LittleEndian.writeBufferFloat(
      this._buffer,
      this._offset + 4 * index,
      value
    );
  }
}

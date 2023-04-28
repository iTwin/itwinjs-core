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

import { ABuffer } from "./ABuffer";
import { LittleEndian } from "./LittleEndian";

/**
 * Define an unsigned 8-bit integer typed buffer.
 */
/** @internal */
export class Uint8Buffer {
  /** The number of bytes per element */
  public static readonly BYTES_PER_ELEMENT: int32 = 1;

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
  public static wrap(buffer: ABuffer): Uint8Buffer {
    return new Uint8Buffer(buffer, 0, buffer.size());
  }

  /**
   * Return the content as a native buffer
   */
  public toNativeBuffer(): Uint8Array {
    return new Uint8Array(this._buffer.toNativeBuffer(), this._offset, this._count);
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
  public get(index: int32): int32 {
    return LittleEndian.readBufferByte(this._buffer, this._offset + index);
  }

  /**
   * Set an element.
   */
  public set(index: int32, value: int32): void {
    LittleEndian.writeBufferByte(this._buffer, this._offset + index, value);
  }
}

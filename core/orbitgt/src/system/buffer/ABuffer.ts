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

/**
 * Class ABuffer defines a raw byte buffer.
 */
/** @internal */
export class ABuffer {
  /** The content of the buffer */
  private _content: ArrayBuffer;
  /** The byte view of the content of the buffer */
  private _contentBytes: Uint8Array;

  /**
   * Create a new buffer.
   */
  public constructor(size: int32) {
    this._content = size < 0 ? null : new ArrayBuffer(size);
    this._contentBytes = size < 0 ? null : new Uint8Array(this._content);
  }

  /**
   * Wrap an existing buffer.
   */
  public static wrap(buffer: ArrayBuffer): ABuffer {
    let wrapper: ABuffer = new ABuffer(-1);
    wrapper._content = buffer;
    wrapper._contentBytes = new Uint8Array(wrapper._content);
    return wrapper;
  }

  /**
   * Wrap an existing buffer.
   */
  public static wrapRange(
    buffer: ArrayBuffer,
    offset: int32,
    size: int32
  ): ABuffer {
    /* The whole buffer? */
    if (offset == 0 && size == buffer.byteLength) return ABuffer.wrap(buffer);
    /* Copy the range */
    let original: ABuffer = ABuffer.wrap(buffer);
    let wrapper: ABuffer = new ABuffer(size);
    ABuffer.arrayCopy(original, offset, wrapper, 0, size);
    return wrapper;
  }

  /**
   * Return the content as a native buffer
   */
  public toNativeBuffer(): ArrayBuffer {
    return this._content;
  }

  /**
   * Get the size of the buffer.
   */
  public size(): int32 {
    return this._contentBytes.byteLength;
  }

  /**
   * Get a byte (0..255).
   */
  public get(index: int32): int32 {
    return this._contentBytes[index];
  }

  /**
   * Set a byte.
   */
  public set(index: int32, value: int32): void {
    this._contentBytes[index] = value;
  }

  /**
   * Slice a part of the buffer.
   */
  public slice(begin: int32, end: int32): ABuffer {
    if (begin < 0) begin += this._content.byteLength;
    if (end < 0) end += this._content.byteLength;
    let result: ABuffer = new ABuffer(end - begin);
    for (let i: number = 0; i < result._content.byteLength; i++)
      result.set(i, this.get(begin + i));
    return result;
  }

  /**
   * Copy data from a source to a target buffer.
   */
  public static arrayCopy(
    source: ABuffer,
    sourceIndex: int32,
    target: ABuffer,
    targetIndex: int32,
    count: int32
  ): void {
    for (let i: number = 0; i < count; i++)
      target.set(targetIndex++, source.get(sourceIndex++));
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { assert } from "./Assert";
import { Id64, Id64String } from "./Id";

/** Allows the contents of an [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
 * to be consumed sequentially using methods to extract
 * data of a particular type from the bytes beginning at the current read position.
 * Methods and properties beginning with 'next' consume data at the current read position and advance it
 * by the size of the data read. The read position can also be directly adjusted by the caller.
 * @public
 */
export class ByteStream {
  private readonly _view: DataView;
  private readonly _byteOffset: number;
  private _curPos: number = 0;

  /** Construct a new ByteStream with the read position set to the beginning.
   * @param buffer The underlying buffer from which data is to be extracted.
   * @param subView If defined, specifies the subset of the underlying buffer's data to use.
   */
  public constructor(buffer: ArrayBuffer | SharedArrayBuffer, subView?: { byteOffset: number, byteLength: number }) {
    if (undefined !== subView) {
      this._view = new DataView(buffer, subView.byteOffset, subView.byteLength);
      this._byteOffset = subView.byteOffset;
    } else {
      this._view = new DataView(buffer);
      this._byteOffset = 0;
    }
  }

  /** The number of bytes in this stream */
  public get length(): number { return this._view.byteLength; }
  /** Returns true if the current read position has been advanced past the end of the stream */
  public get isPastTheEnd(): boolean { return this.curPos > this.length; }

  /** The current read position as an index into the stream of bytes. */
  public get curPos(): number { return this._curPos; }
  public set curPos(pos: number) { this._curPos = pos; assert(!this.isPastTheEnd); }

  /** Adds the specified number of bytes to the current read position */
  public advance(numBytes: number): boolean { this.curPos = (this.curPos + numBytes); return !this.isPastTheEnd; }
  /** Subtracts the specified number of bytes from the current read position */
  public rewind(numBytes: number): boolean { if (this.curPos - numBytes < 0) return false; this.curPos = this.curPos - numBytes; return true; }
  /** Resets the current read position to the beginning of the stream */
  public reset(): void { this.curPos = 0; }

  /** Read a unsigned 8-bit integer from the current read position and advance by 1 byte. */
  public get nextUint8(): number { return this.read(1, (view) => view.getUint8(this.curPos)); }
  /** Read an unsigned 16-bit integer from the current read position and advance by 2 bytes. */
  public get nextUint16(): number { return this.read(2, (view) => view.getUint16(this.curPos, true)); }
  /** Read an unsigned 32-bit integer from the current read position and advance by 4 bytes. */
  public get nextUint32(): number { return this.read(4, (view) => view.getUint32(this.curPos, true)); }
  /** Read a signed 32-bit integer from the current read position and advance by 4 bytes. */
  public get nextInt32(): number { return this.read(4, (view) => view.getInt32(this.curPos, true)); }
  /** Read a 32-bit floating point number from the current read position and advance by 4 bytes. */
  public get nextFloat32(): number { return this.read(4, (view) => view.getFloat32(this.curPos, true)); }
  /** Read a 64-bit floating point number from the current read position and advance by 8 bytes. */
  public get nextFloat64(): number { return this.read(8, (view) => view.getFloat64(this.curPos, true)); }
  /** Read an unsigned 64-bit integer from the current read position, advance by 8 bytes, and return the 64-bit value as an Id64String. */
  public get nextId64(): Id64String { return Id64.fromUint32Pair(this.nextUint32, this.nextUint32); }

  /** Read the specified number of bytes beginning at the current read position into a Uint8Array and advance by the specified number of byte.
   * @param numBytes The number of bytes to read.
   */
  public nextBytes(numBytes: number): Uint8Array {
    const bytes = new Uint8Array(this.arrayBuffer, this.curPos + this._byteOffset, numBytes);
    this.advance(numBytes);
    return bytes;
  }

  /** Read the specified number of bytes at the specified offset without changing the read position. */
  public readBytes(readPos: number, numBytes: number): Uint8Array {
    return new Uint8Array(this.arrayBuffer, readPos + this._byteOffset, numBytes);
  }

  /** Read the specified number of unsigned 32-bit integers from the current read position and advance the read position. */
  public nextUint32s(numUint32s: number): Uint32Array {
    const numBytes = numUint32s * 4;
    const uint32s = new Uint32Array(this.arrayBuffer, this.curPos + this._byteOffset, numUint32s);
    this.advance(numBytes);
    return uint32s;
  }

  /** Returns the underlying array buffer */
  public get arrayBuffer(): ArrayBuffer | SharedArrayBuffer { return this._view.buffer; }

  private read(numBytes: number, read: (view: DataView) => number) {
    const result = read(this._view);
    this.advance(numBytes);
    return result;
  }
}

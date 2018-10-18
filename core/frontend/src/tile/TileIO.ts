/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { assert, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { MeshList } from "../render/primitives/mesh/MeshPrimitives";

/** Provides facilities for deserializing 3d tiles */
export namespace TileIO {
  /** Status codes for tile reading operations */
  export const enum ReadStatus {
    Success = 0,
    InvalidTileData,
    InvalidHeader,
    InvalidBatchTable,
    InvalidScene,
    InvalidFeatureTable,
    Canceled,
  }

  /** Type codes for various tile formats. Often these are embedded as 'magic numbers' in a binary stream to indicate the format. */
  export const enum Format {
    Unknown = 0,
    B3dm = 0x6d643362, // "b3dm"
    Gltf = 0x46546c67, // "glTF"
    Dgn = 0x546e6764, // "dgnT"
    Pnts = 0x73746e70,  // "pnts"
    IModel = 0x6c644d69, // "iMdl"
  }

  /** Given a magic number, return whether it identifies a known tile format. */
  function isValidFormat(format: number) {
    switch (format) {
      case Format.Unknown:
      case Format.B3dm:
      case Format.Gltf:
      case Format.IModel:
      case Format.Dgn:
      case Format.Pnts:
        return true;
      default:
        return false;
    }
  }

  /** Given a magic number, attempt to convert it to a known tile Format. */
  function formatFromNumber(formatNumber: number): Format {
    const format = formatNumber as Format;
    return isValidFormat(format) ? format : Format.Unknown;
  }

  /**
   * Wraps a binary stream along with a current read position. The position can be adjusted by the caller.
   * Methods and properties beginning with 'next' consume data at the current read position and advance it
   * by the size of the data read.
   */
  export class StreamBuffer {
    private readonly _view: DataView;
    private _curPos: number = 0;

    public constructor(buffer: ArrayBuffer | SharedArrayBuffer) {
      this._view = new DataView(buffer);
    }

    /** The number of bytes in this stream */
    public get length(): number { return this._view.byteLength; }
    /** Returns true if the current read position has been advanced past the end of the stream */
    public get isPastTheEnd(): boolean { return this.curPos > this.length; }

    /** Returns the current read position as an index into the stream of bytes */
    public get curPos(): number { return this._curPos; }
    /** Sets the current read position to the specified index into the stream of bytes */
    public set curPos(pos: number) { this._curPos = pos; assert(!this.isPastTheEnd); }

    /** Add the specified number of bytes to the current read position */
    public advance(numBytes: number): boolean { this.curPos = (this.curPos + numBytes); return !this.isPastTheEnd; }
    /** Subtracts the specified number of bytes from the current read position */
    public rewind(numBytes: number): boolean { if (this.curPos - numBytes < 0) return false; this.curPos = this.curPos - numBytes; return true; }
    /** Resets the current read position to the beginning of the stream */
    public reset(): void { this.curPos = 0; }

    /** Read a uint8 at the current read position and advance by 1 byte. */
    public get nextUint8(): number { return this.read(1, (view) => view.getUint8(this.curPos)); }
    /** Read a uint16 at the current read position and advance by 2 bytes. */
    public get nextUint16(): number { return this.read(2, (view) => view.getUint16(this.curPos, true)); }
    /** Read a uint32 at the current read position and advance by 4 bytes. */
    public get nextUint32(): number { return this.read(4, (view) => view.getUint32(this.curPos, true)); }
    /** Read a 32-bit floating point number at the current read position and advance by 4 bytes. */
    public get nextFloat32(): number { return this.read(4, (view) => view.getFloat32(this.curPos, true)); }
    /** Read a 64-bit floating point number at the current read position and advance by 8 bytes. */
    public get nextFloat64(): number { return this.read(8, (view) => view.getFloat64(this.curPos, true)); }
    /** Read 3 64-bit floating point numbers at the current read position, advance by 24 bytes, and return a Point3d constructed from the 3 numbers. */
    public get nextPoint3d64(): Point3d { return new Point3d(this.nextFloat64, this.nextFloat64, this.nextFloat64); }
    /** Read a uint64 at the current read position, advance by 8 bytes, and return the uint64 value as an Id64String. */
    public get nextId64(): Id64String { return Id64.fromUint32Pair(this.nextUint32, this.nextUint32); }

    /** Read the next numBytes bytes into a Uint8Array and advance by numBytes. */
    public nextBytes(numBytes: number): Uint8Array {
      const bytes = new Uint8Array(this.arrayBuffer, this.curPos, numBytes);
      this.advance(numBytes);
      return bytes;
    }

    public nextUint32s(numUint32s: number): Uint32Array {
      const numBytes = numUint32s * 4;
      const uint32s = new Uint32Array(this.arrayBuffer, this.curPos, numBytes);
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

  /**
   * The base header preceding tile data, identifying the tile format and version of that format.
   * Specific tile formats may define their own headers as sub-types of this Header, appending
   * additional format-specific data.
   */
  export abstract class Header {
    private _format: Format;
    public readonly version: number;

    /** Construct a Header from the binary data at the supplied stream's current read position */
    public constructor(stream: StreamBuffer) {
      this._format = formatFromNumber(stream.nextUint32);
      this.version = stream.nextUint32;
    }

    public get format(): Format { return this._format; }

    /** Returns whether the header represents valid data */
    public abstract get isValid(): boolean;

    /** Mark the header as representing invalid data */
    protected invalidate(): void { this._format = Format.Unknown; }
  }

  /** @hidden */
  export class GeometryCollection {
    public constructor(public readonly meshes: MeshList,
      public readonly isComplete: boolean,
      public readonly isCurved: boolean) { }

    public get isEmpty(): boolean { return 0 === this.meshes.length; }
  }
}

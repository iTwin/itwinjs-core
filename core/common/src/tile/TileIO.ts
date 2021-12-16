/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { BentleyError, ByteStream } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";

/** Type codes for various tile formats. Often these are embedded as 32-bit 'magic numbers' in a binary stream to indicate the format.
 * @internal
 */
export enum TileFormat {
  Unknown = 0,
  B3dm = 0x6d643362, // "b3dm"
  Gltf = 0x46546c67, // "glTF"
  Pnts = 0x73746e70,  // "pnts"
  IModel = 0x6c644d69, // "iMdl"
  Cmpt = 0x74706d63,  // cmpt
  I3dm = 0x6d643369,  // i3dm
  A3x = 0x583341, // A3X0 (numeric 0 not char '0')
}

/** Given a magic number, return whether it identifies a known tile format.
 * @internal
 */
export function isKnownTileFormat(format: number) {
  switch (format) {
    case TileFormat.Unknown:
    case TileFormat.B3dm:
    case TileFormat.Gltf:
    case TileFormat.IModel:
    case TileFormat.Pnts:
    case TileFormat.Cmpt:
    case TileFormat.I3dm:
    case TileFormat.A3x:
      return true;
    default:
      return false;
  }
}

/** Given a magic number, attempt to convert it to a known TileFormat.
 * @internal
 */
export function tileFormatFromNumber(formatNumber: number): TileFormat {
  const format = formatNumber as TileFormat;
  return isKnownTileFormat(format) ? format : TileFormat.Unknown;
}

/** Status codes for tile reading operations
 * @internal
 */
export enum TileReadStatus {
  Success = 0,
  InvalidTileData,
  InvalidHeader,
  InvalidBatchTable,
  InvalidScene,
  InvalidFeatureTable,
  NewerMajorVersion,
  Canceled,
}

const readStatusMessages = [
  "Success",
  "Invalid tile data",
  "Invalid tile header",
  "Invalid batch table",
  "Invalid scene",
  "Invalid feature table",
  "Major version too new",
  "Canceled",
];

/** Exception thrown by functions that deserialize tiles.
 * @internal
 */
export class TileReadError extends BentleyError {
  public constructor(status: TileReadStatus, message?: string) {
    if (undefined === message)
      message = readStatusMessages[status];

    super(status, message);
  }

  public get wasCanceled(): boolean { return TileReadStatus.Canceled === this.errorNumber; }
}

/** The base header preceding tile data of most formats, identifying the tile format and version of that format.
 * Specific tile formats may define their own headers as sub-types of this Header, appending
 * additional format-specific data.
 * @internal
 */
export abstract class TileHeader {
  private _format: TileFormat;
  public version: number;

  /** Construct a Header from the binary data at the supplied stream's current read position */
  public constructor(stream: ByteStream) {
    this._format = tileFormatFromNumber(stream.nextUint32);
    this.version = stream.nextUint32;
  }

  public get format(): TileFormat { return this._format; }

  /** Returns whether the header represents valid data */
  public abstract get isValid(): boolean;

  /** Mark the header as representing invalid data */
  protected invalidate(): void {
    this._format = TileFormat.Unknown;
  }
}

/** Read 3 64-bit floating point numbers at the byte stream's current read position, advance by 24 bytes, and return a Point3d constructed from the 3 numbers.
 * @internal
 */
export function nextPoint3d64FromByteStream(stream: ByteStream, result?: Point3d): Point3d {
  const x = stream.nextFloat64,
    y = stream.nextFloat64,
    z = stream.nextFloat64;

  if (undefined === result)
    return new Point3d(x, y, z);

  result.set(x, y, z);
  return result;
}

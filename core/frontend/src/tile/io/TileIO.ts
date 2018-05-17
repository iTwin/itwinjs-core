/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, Id64 } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { MeshList } from "../../render/primitives/Mesh";

export namespace TileIO {
  export const enum ReadStatus {
    Success = 0,
    InvalidTileData,
    InvalidHeader,
    InvalidBatchTable,
    InvalidScene,
    InvalidFeatureTable,
  }

  export const enum Format {
    Unknown = 0,
    B3dm = 0x6d643362, // "b3dm"
    Gltf = 0x46546c67, // "glTF"
    IModel = 0x546e6764, // "dgnT"
  }

  function isValidFormat(format: number) {
    switch (format) {
      case Format.Unknown:
      case Format.B3dm:
      case Format.Gltf:
      case Format.IModel:
        return true;
      default:
        return false;
    }
  }

  function formatFromNumber(formatNumber: number): Format {
    const format = formatNumber as Format;
    return isValidFormat(format) ? format : Format.Unknown;
  }

  export class StreamBuffer {
    private readonly _view: DataView;
    private _curPos: number = 0;

    public constructor(buffer: ArrayBuffer | SharedArrayBuffer) { this._view = new DataView(buffer); }

    public get length(): number { return this._view.byteLength; }
    public get isPastTheEnd(): boolean { return this.curPos > this.length; }

    public get curPos(): number { return this._curPos; }
    public set curPos(pos: number) { this._curPos = pos; assert(!this.isPastTheEnd); }

    public advance(numBytes: number): boolean { this.curPos = (this.curPos + numBytes); return !this.isPastTheEnd; }
    public rewind(numBytes: number): boolean { if (this.curPos - numBytes < 0) return false; this.curPos = this.curPos - numBytes; return true; }
    public reset(): void { this.curPos = 0; }

    public get nextUint8(): number { return this.read(1, (view) => view.getUint8(this.curPos)); }
    public get nextUint16(): number { return this.read(2, (view) => view.getUint16(this.curPos, true)); }
    public get nextUint32(): number { return this.read(4, (view) => view.getUint32(this.curPos, true)); }
    public get nextFloat32(): number { return this.read(4, (view) => view.getFloat32(this.curPos, true)); }
    public get nextFloat64(): number { return this.read(8, (view) => view.getFloat64(this.curPos, true)); }
    public get nextPoint3d64(): Point3d { return new Point3d(this.nextFloat64, this.nextFloat64, this.nextFloat64); }
    public get nextId64(): Id64 { return Id64.fromUint32Pair(this.nextUint32, this.nextUint32); }

    public nextBytes(numBytes: number): Uint8Array {
      const bytes = new Uint8Array(this.arrayBuffer, this.curPos, numBytes);
      this.advance(numBytes);
      return bytes;
    }

    public get arrayBuffer(): ArrayBuffer | SharedArrayBuffer { return this._view.buffer; }

    private read(numBytes: number, read: (view: DataView) => number) {
      const result = read(this._view);
      this.advance(numBytes);
      return result;
    }
  }

  export class Header {
    private _format: Format;
    public readonly version: number;

    public constructor(stream: StreamBuffer) {
      this._format = formatFromNumber(stream.nextUint32);
      this.version = stream.nextUint32;
    }

    public get format(): Format { return this._format; }
    public get isValid(): boolean { return Format.Unknown !== this.format; }

    protected invalidate(): void { this._format = Format.Unknown; }
  }

  export class GeometryCollection {
    public constructor(public readonly meshes: MeshList,
                       public readonly isComplete: boolean,
                       public readonly isCurved: boolean) { }

    public get isEmpty(): boolean { return 0 === this.meshes.length; }
  }
}

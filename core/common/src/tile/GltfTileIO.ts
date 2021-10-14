/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ByteStream } from "@itwin/core-bentley";
import { TileFormat, TileHeader } from "./TileIO";

/** Known version of the [glTF format](https://www.khronos.org/gltf/).
 * @internal
 */
export enum GltfVersions {
  Version1 = 1,
  Version2 = 2,
  CurrentVersion = Version1,
  Gltf1SceneFormat = 0,
}

/** @internal */
export enum GltfV2ChunkTypes {
  JSON = 0x4E4F534a,
  Binary = 0x004E4942,
}

/** @internal */
export enum GltfMeshMode {
  Points = 0,
  Lines = 1,
  LineStrip = 3,
  Triangles = 4,
}

/** @internal */
export enum GltfDataType {
  SignedByte = 0x1400,
  UnsignedByte = 0x1401,
  SignedShort = 5122,
  UnsignedShort = 5123,
  UInt32 = 5125,
  Float = 5126,
  Rgb = 6407,
  Rgba = 6408,
  IntVec2 = 0x8b53,
  IntVec3 = 0x8b54,
  FloatVec2 = 35664,
  FloatVec3 = 35665,
  FloatVec4 = 35666,
  FloatMat3 = 35675,
  FloatMat4 = 35676,
  Sampler2d = 35678,
}

/** @internal */
export enum GltfConstants {
  CullFace = 2884,
  DepthTest = 2929,
  Nearest = 0x2600,
  Linear = 9729,
  LinearMipmapLinear = 9987,
  ClampToEdge = 33071,
  ArrayBuffer = 34962,
  ElementArrayBuffer = 34963,
  FragmentShader = 35632,
  VertexShader = 35633,
}

/** @internal */
export type GltfDataBuffer = Uint8Array | Uint16Array | Uint32Array | Float32Array;

/**
 * A chunk of binary data exposed as a typed array.
 * The count member indicates how many elements exist. This may be less than this.buffer.length due to padding added to the
 * binary stream to ensure correct alignment.
 * @internal
 */
export class GltfBufferData {
  public readonly buffer: GltfDataBuffer;
  public readonly count: number;

  public constructor(buffer: GltfDataBuffer, count: number) {
    this.buffer = buffer;
    this.count = count;
  }

  /**
   * Create a GltfBufferData of the desired type. The actual type may differ from the desired type - for example, small 32-bit integers
   * may be represented as 8-bit or 16-bit integers instead.
   * If the actual data type is not convertible to the desired type, this function returns undefined.
   */
  public static create(bytes: Uint8Array, actualType: GltfDataType, expectedType: GltfDataType, count: number): GltfBufferData | undefined {
    if (expectedType !== actualType) {
      // Some data is stored in smaller data types to save space if no values exceed the maximum of the smaller type.
      switch (expectedType) {
        case GltfDataType.Float:
        case GltfDataType.UnsignedByte:
          return undefined;
        case GltfDataType.UnsignedShort:
          if (GltfDataType.UnsignedByte !== actualType)
            return undefined;
          break;
        case GltfDataType.UInt32:
          if (GltfDataType.UnsignedByte !== actualType && GltfDataType.UnsignedShort !== actualType)
            return undefined;
          break;
      }
    }

    const data = this.createDataBuffer(bytes, actualType);
    return undefined !== data ? new GltfBufferData(data, count) : undefined;
  }

  private static createDataBuffer(bytes: Uint8Array, actualType: GltfDataType): GltfDataBuffer | undefined {
    // NB: Endianness of typed array data is determined by the 'platform byte order'. Actual data is always little-endian.
    // We are assuming little-endian platform. If we find a big-endian platform, we'll need to use a DataView instead.
    switch (actualType) {
      case GltfDataType.UnsignedByte:
        return bytes;
      case GltfDataType.UnsignedShort:
        return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      case GltfDataType.UInt32:
        return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      case GltfDataType.Float:
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      default:
        return undefined;
    }
  }
}

/**
 * A view of a chunk of glTF binary data containing an array of elements of a specific data type.
 * The count member indicates how many elements exist; this may be smaller than this.data.length.
 * The count member may also indicate the number of elements of a type containing more than one value of the
 * underlying type. For example, a buffer of 4 32-bit floating point 'vec2' elements will have a count of 4,
 * but its data member will contain 8 32-bit floating point values (2 per vec2).
 * The accessor member may contain additional JSON data specific to a particular buffer.
 * @internal
 */
export class GltfBufferView {
  public readonly data: Uint8Array;
  public readonly count: number;
  public readonly type: GltfDataType;
  public readonly accessor: any;
  public readonly stride: number;

  public get byteLength(): number { return this.data.length; }

  public constructor(data: Uint8Array, count: number, type: GltfDataType, accessor: any, stride: number) {
    this.data = data;
    this.count = count;
    this.type = type;
    this.accessor = accessor;
    this.stride = stride;
  }

  public toBufferData(desiredType: GltfDataType): GltfBufferData | undefined {
    return GltfBufferData.create(this.data, this.type, desiredType, this.count);
  }
}

/** Header preceding glTF data.
 * @internal
 */
export class GltfHeader extends TileHeader {
  public readonly gltfLength: number;
  public readonly scenePosition: number = 0;
  public readonly sceneStrLength: number = 0;
  public readonly binaryPosition: number = 0;
  public get isValid(): boolean { return TileFormat.Gltf === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.gltfLength = stream.nextUint32;
    this.sceneStrLength = stream.nextUint32;
    const value5 = stream.nextUint32;

    // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
    // validating the chunk type.
    if (this.version === GltfVersions.Version2 && value5 === GltfVersions.Gltf1SceneFormat)
      this.version = GltfVersions.Version1;

    if (this.version === GltfVersions.Version1) {
      const gltfSceneFormat = value5;
      if (GltfVersions.Gltf1SceneFormat !== gltfSceneFormat) {
        this.invalidate();
        return;
      }

      this.scenePosition = stream.curPos;
      this.binaryPosition = stream.curPos + this.sceneStrLength;
    } else if (this.version === GltfVersions.Version2) {
      const sceneChunkType = value5;
      this.scenePosition = stream.curPos;
      stream.curPos = stream.curPos + this.sceneStrLength;
      const binaryLength = stream.nextUint32;
      const binaryChunkType = stream.nextUint32;
      if (GltfV2ChunkTypes.JSON !== sceneChunkType || GltfV2ChunkTypes.Binary !== binaryChunkType || 0 === binaryLength) {
        this.invalidate();
        return;
      }

      this.binaryPosition = stream.curPos;
    } else {
      this.invalidate();
    }
  }
}

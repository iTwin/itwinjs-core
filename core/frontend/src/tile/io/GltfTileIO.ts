/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TileIO } from "./TileIO";
import { ModelState } from "../../ModelState";
import { RenderSystem } from "../../render/System";
import { DisplayParams } from "../../render/primitives/DisplayParams";
import { ColorMap } from "../../render/primitives/ColorMap";
import { assert, JsonUtils, StringUtils } from "@bentley/bentleyjs-core";

export namespace GltfTileIO {
  export const enum Versions {
    Version1 = 1,
    Version2 = 2,
    CurrentVersion = Version1,
    SceneFormat = 0,
  }

  export class Header extends TileIO.Header {
    public readonly gltfLength: number;
    public readonly sceneStrLength: number;
    public readonly gltfSceneFormat: number;

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.gltfLength = stream.nextUint32;
      this.sceneStrLength = stream.nextUint32;
      this.gltfSceneFormat = stream.nextUint32;

      if ((Versions.Version1 !== this.version && Versions.Version2 !== this.version) || Versions.SceneFormat !== this.gltfSceneFormat)
        this.invalidate();
    }
  }

  export const enum PrimitiveType {
    Lines = 1,
    LineStrip = 3,
    Triangles = 4,
  }

  export const enum DataType {
    // SignedByte = 0x1400,
    UnsignedByte = 0x1401,
    // SignedShort = 5122,
    UnsignedShort = 5123,
    UInt32 = 5125,
    Float = 5126,
    // Rgb = 6407,
    // Rgba = 6408,
    // IntVec2 = 0x8b53,
    // IntVec3 = 0x8b54,
    // FloatVec2 = 35664,
    // FloatVec3 = 35665,
    // FloatVec4 = 35666,
    // FloatMat3 = 35675,
    // FloatMat4 = 35676,
    // Sampler2d = 35678,
  }

  function getDataTypeSize(type: DataType) {
    switch (type) {
      case DataType.UnsignedByte:
        return 1;
      case DataType.UnsignedShort:
        return 2;
      case DataType.UInt32:
      case DataType.Float:
        return 4;
      default:
        assert(false, "DataType not yet supported");
        return 0;
    }
  }

  export const enum Constants {
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

  export type BufferData = Uint8Array | Uint16Array | Uint32Array | Float32Array;

  function createBufferData(bytes: Uint8Array, actualType: DataType, expectedType: DataType): BufferData | undefined {
    if (expectedType !== actualType) {
      // Some data is stored in smaller data types to save space if no values exceed the maximum of the smaller type.
      switch (expectedType) {
        case DataType.Float:
        case DataType.UnsignedByte:
          return undefined;
        case DataType.UnsignedShort:
          if (DataType.UnsignedByte !== actualType)
            return undefined;
          break;
        case DataType.UInt32:
          if (DataType.UnsignedByte !== actualType && DataType.UnsignedShort !== actualType)
            return undefined;
          break;
      }
    }

    // NB: Endianness of typed array data is determined by the 'platform byte order'. Actual data is always little-endian.
    // We are assuming little-endian platform. If we find a big-endian platform, we'll need to use a DataView instead.
    switch (actualType) {
      case DataType.UnsignedByte:
        return bytes;
      case DataType.UnsignedShort:
        return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      case DataType.UInt32:
        return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      case DataType.Float:
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      default:
        return undefined;
    }
  }

  export class BufferView {
    public readonly data: Uint8Array;
    public readonly count: number;
    public readonly type: DataType;
    public readonly accessor: any;

    public get byteLength(): number { return this.data.length; }

    public constructor(data: Uint8Array, count: number, type: DataType, accessor: any) {
      this.data = data;
      this.count = count;
      this.type = type;
      this.accessor = accessor;

      assert(this.byteLength === this.count * getDataTypeSize(this.type));
    }

    public toBufferData(desiredType: DataType): BufferData | undefined {
      return createBufferData(this.data, this.type, desiredType);
    }
  }

  export class ReaderProps {
    private constructor(public readonly buffer: TileIO.StreamBuffer,
                        public readonly binaryData: Uint8Array,
                        public readonly accessors: any,
                        public readonly bufferViews: any,
                        public readonly scene: any,
                        public readonly meshes: any,
                        public readonly materials: any) { }

    public static create(buffer: TileIO.StreamBuffer): ReaderProps | undefined {
      const header = new Header(buffer);
      if (!header.isValid)
        return undefined;

      const binaryData = new Uint8Array(buffer.arrayBuffer, buffer.curPos + header.sceneStrLength);

      const sceneStrData = buffer.nextBytes(header.sceneStrLength);
      const sceneStr = StringUtils.utf8ToString(sceneStrData);
      if (undefined === sceneStr)
        return undefined;

      try {
        const sceneValue = JSON.parse(sceneStr);
        const meshes = sceneValue.meshes;
        const materialValues = sceneValue.materials;
        const accessors = sceneValue.accessors;
        const bufferViews = sceneValue.bufferViews;

        if ("object" !== typeof materialValues || "object" !== typeof meshes || "object" !== typeof accessors || "object" !== typeof bufferViews)
          return undefined;

        return new ReaderProps(buffer, binaryData, accessors, bufferViews, sceneValue, meshes, materialValues);
      } catch (e) {
        return undefined;
      }
    }
  }

  export class Reader {
    protected readonly buffer: TileIO.StreamBuffer;
    protected readonly accessors: any;
    protected readonly bufferViews: any;
    protected readonly meshes: any;
    protected readonly batchData: any;
    protected readonly materialValues: any;
    protected readonly textures: any;
    protected readonly namedTextures: any;
    protected readonly images: any;
    protected readonly binaryData: Uint8Array;
    protected readonly model: ModelState;
    protected readonly system: RenderSystem;

    public static createGltfReader(buffer: TileIO.StreamBuffer, model: ModelState, system: RenderSystem): Reader | undefined {
      const props = ReaderProps.create(buffer);
      return undefined !== props ? new Reader(props, model, system) : undefined;
    }

    public getBufferView(json: any, accessorName: string): BufferView | undefined {
      try {
        const accessorValue = JsonUtils.asString(json[accessorName]);
        const accessor = 0 < accessorValue.length ? this.accessors[accessorValue] : undefined;
        const bufferViewAccessorValue = undefined !== accessor ? JsonUtils.asString(accessor.bufferView) : "";
        const bufferView = 0 < bufferViewAccessorValue.length ? this.bufferViews[bufferViewAccessorValue] : undefined;

        if (typeof bufferView !== "object" || typeof accessor !== "object")
          return undefined;

        const type = accessor.componentType as DataType;
        switch (type) {
          case DataType.UnsignedByte:
          case DataType.UnsignedShort:
          case DataType.UInt32:
          case DataType.Float:
            break;
          default:
            return undefined;
        }

        const bytes = this.binaryData.subarray(bufferView.byteOffset + accessor.byteOffset, bufferView.byteLength);
        return new BufferView(bytes, accessor.count as number, type, accessor);
      } catch (e) {
        return undefined;
      }
    }

    public readBufferData32(json: any, accessorName: string): BufferData | undefined {
      return this.readBufferData(json, accessorName, DataType.UInt32);
    }
    public readBufferData16(json: any, accessorName: string): BufferData | undefined {
      return this.readBufferData(json, accessorName, DataType.UnsignedShort);
    }

    protected constructor(props: ReaderProps, model: ModelState, system: RenderSystem) {
      this.buffer = props.buffer;
      this.binaryData = props.binaryData;
      this.accessors = props.accessors;
      this.bufferViews = props.bufferViews;
      this.meshes = props.meshes;
      this.materialValues = props.materials;

      this.textures = props.scene.textures;
      this.images = props.scene.images;
      this.namedTextures = props.scene.namedTextures;

      this.model = model;
      this.system = system;
    }

    protected readBufferData(json: any, accessorName: string, type: DataType): BufferData | undefined {
      const view = this.getBufferView(json, accessorName);
      return undefined !== view ? view.toBufferData(type) : undefined;
    }

    protected readFeatures(_json: any): Uint32Array | undefined { return undefined; }
    protected readColorTable(_json: any): ColorMap | undefined { return undefined; }
    protected createDisplayParams(_json: any): DisplayParams | undefined { return undefined; }

    protected readGltf(_geometry: TileIO.GeometryCollection): TileIO.ReadStatus {
      this.buffer.curPos = this.binaryData.byteOffset;
      return TileIO.ReadStatus.InvalidTileData; // ###TODO
    }
  }
}

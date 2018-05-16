/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TileIO } from "./TileIO";
import { ModelState } from "../../ModelState";
import { RenderSystem } from "../../render/System";
import { DisplayParams } from "../../render/primitives/DisplayParams";
import { Mesh } from "../../render/primitives/Mesh";
import { ColorMap } from "../../render/primitives/ColorMap";
import { FeatureTable, QPoint3d, QPoint3dList, QParams3d } from "@bentley/imodeljs-common";
import { Id64, assert, JsonUtils, StringUtils } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";

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

  export type DataBuffer = Uint8Array | Uint16Array | Uint32Array | Float32Array;

  export class BufferData {
    public readonly buffer: DataBuffer;
    public readonly count: number;

    public constructor(buffer: DataBuffer, count: number) {
      this.buffer = buffer;
      this.count = count;
    }

    public static create(bytes: Uint8Array, actualType: DataType, expectedType: DataType, count: number): BufferData | undefined {
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

      const data = this.createDataBuffer(bytes, actualType);
      return undefined !== data ? new BufferData(data, count) : undefined;
    }

    private static createDataBuffer(bytes: Uint8Array, actualType: DataType): DataBuffer | undefined {
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
    }

    public toBufferData(desiredType: DataType): BufferData | undefined {
      return BufferData.create(this.data, this.type, desiredType, this.count);
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
        const meshes = JsonUtils.asObject(sceneValue.meshes);
        const materialValues = JsonUtils.asObject(sceneValue.materials);
        const accessors = JsonUtils.asObject(sceneValue.accessors);
        const bufferViews = JsonUtils.asObject(sceneValue.bufferViews);

        if (undefined === materialValues || undefined === meshes || undefined === accessors || undefined === bufferViews)
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

    public get modelId(): Id64 { return /* this.model.id */ Id64.invalidId; } // ###TODO ModelState...

    public static createGltfReader(buffer: TileIO.StreamBuffer, model: ModelState, system: RenderSystem): Reader | undefined {
      const props = ReaderProps.create(buffer);
      return undefined !== props ? new Reader(props, model, system) : undefined;
    }

    public getBufferView(json: any, accessorName: string): BufferView | undefined {
      try {
        const accessorValue = JsonUtils.asString(json[accessorName]);
        const accessor = 0 < accessorValue.length ? JsonUtils.asObject(this.accessors[accessorValue]) : undefined;
        const bufferViewAccessorValue = undefined !== accessor ? JsonUtils.asString(accessor.bufferView) : "";
        const bufferView = 0 < bufferViewAccessorValue.length ? JsonUtils.asObject(this.bufferViews[bufferViewAccessorValue]) : undefined;

        if (undefined === bufferView || undefined === accessor)
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

    protected readFeatureIndices(_json: any): number[] | undefined { return undefined; }
    protected readColorTable(_colorTable: ColorMap, _json: any): boolean | undefined { return false; }
    protected createDisplayParams(_json: any): DisplayParams | undefined { return undefined; }

    protected readGltf(geometry: TileIO.GeometryCollection): TileIO.ReadStatus {
      for (const meshKey of Object.keys(this.meshes)) {
        const meshValue = this.meshes[meshKey];
        const primitives = JsonUtils.asArray(meshValue.primitives);
        if (undefined === primitives)
          continue;

        for (const primitive of primitives) {
          const mesh = this.readMeshPrimitive(primitive, geometry.meshes.features);
          assert(undefined !== mesh);
          if (undefined !== mesh)
            geometry.meshes.push(mesh);
        }
      }

      return TileIO.ReadStatus.Success;
    }

    protected readMeshPrimitive(primitive: any, featureTable?: FeatureTable): Mesh | undefined {
      const materialName = JsonUtils.asString(primitive.material);
      const materialValue = 0 < materialName.length ? JsonUtils.asObject(this.materialValues[materialName]) : undefined;
      const displayParams = undefined !== materialValue ? this.createDisplayParams(materialValue) : undefined;
      if (undefined === displayParams)
        return undefined;

      const primitiveType = JsonUtils.asInt(primitive.type, Mesh.PrimitiveType.Mesh);
      const isPlanar = JsonUtils.asBool(primitive.isPlanar);
      const mesh = Mesh.create({
          displayParams,
          features: undefined !== featureTable ? new Mesh.Features(featureTable) : undefined,
          type: primitiveType,
          range: Range3d.createNull(),
          is2d: false, // ###TODO...
          isPlanar,
        });

      if (!this.readVertices(mesh.points, primitive))
        return undefined;

      // read color table and color indices
      if (undefined !== mesh.features && !this.readFeatures(mesh.features, primitive))
        return undefined;

      return mesh; // ###TODO etc...
    }

    protected readVertices(positions: QPoint3dList, primitive: any): boolean {
      const view = this.getBufferView(primitive.attributes, "POSITION");
      if (undefined === view || DataType.UnsignedShort !== view.type)
        return false;

      const extensions = JsonUtils.asObject(view.accessor.extensions);
      const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
      if (undefined === quantized)
        return false;

      const rangeMin = JsonUtils.asArray(quantized.decodedMin);
      const rangeMax = JsonUtils.asArray(quantized.decodedMax);
      if (undefined === rangeMin || undefined === rangeMax)
        return false;

      const buffer = view.toBufferData(DataType.UnsignedShort);
      if (undefined === buffer)
        return false;

      const qpt = QPoint3d.fromScalars(0, 0, 0);
      positions.reset(QParams3d.fromRange(Range3d.create(rangeMin[0], rangeMin[1], rangeMin[2], rangeMax[0], rangeMax[1], rangeMax[2])));
      for (let i = 0; i < view.count; i++) {
        const index = i * 3; // 3 uint16 per QPoint3d...
        qpt.setFromScalars(buffer.buffer[index], buffer.buffer[index + 1], buffer.buffer[index + 2]);
        positions.push(qpt);
      }

      return true;
    }

    protected readIndices(json: any, accessorName: string): number[] | undefined {
      const data = this.readBufferData32(json, accessorName);
      if (undefined === data)
        return undefined;

      const indices = [];
      for (let i = 0; i < data.count; i++)
        indices.push(data.buffer[i]);

      return indices;
    }

    protected readFeatures(features: Mesh.Features, json: any): boolean {
      const indices = this.readFeatureIndices(json);
      if (undefined === indices)
        return false;

      features.setIndices(indices);
      return true;
    }
  }
}

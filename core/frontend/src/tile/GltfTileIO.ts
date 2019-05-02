/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { Tile } from "./TileTree";
import { TileIO } from "./TileIO";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Triangle } from "../render/primitives/Primitives";
import { Mesh, MeshList, MeshGraphicArgs } from "../render/primitives/mesh/MeshPrimitives";
import {
  FeatureTable,
  QPoint3d,
  QPoint3dList,
  QParams3d,
  OctEncodedNormal,
  MeshPolyline,
  MeshPolylineList,
  ElementAlignedBox3d,
  TextureMapping,
  ImageSource,
  ImageSourceFormat,
  RenderTexture,
  BatchType,
  ColorDef,
  LinePixels,
  FillFlags,
} from "@bentley/imodeljs-common";
import { Id64String, assert, JsonUtils, utf8ToString } from "@bentley/bentleyjs-core";
import { Range3d, Point2d, Point3d, Vector3d, Transform, Matrix3d, Angle } from "@bentley/geometry-core";
import { InstancedGraphicParams, RenderSystem, RenderGraphic, GraphicBranch, PackedFeatureTable } from "../render/System";
import { imageElementFromImageSource, getImageSourceFormatForMimeType } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";

// tslint:disable:no-const-enum

/* -----------------------------------
 * To restore the use of web workers to decode jpeg, locate and uncomment the three sections by searching for "webworker".
  import { WorkerOperation, WebWorkerManager } from "../WebWorkerManager";
  ------------------------------------ */

// Defer Draco for now.   import { DracoDecoder } from "./DracoDecoder";

/** Provides facilities for deserializing tiles in the [glTF tile format](https://www.khronos.org/gltf/).
 * @internal
 */
export namespace GltfTileIO {
  /** Known version of the [glTF format](https://www.khronos.org/gltf/).
   * @internal
   */
  export const enum Versions {
    Version1 = 1,
    Version2 = 2,
    CurrentVersion = Version1,
    Gltf1SceneFormat = 0,
  }

  /** @internal */
  export const enum V2ChunkTypes {
    JSON = 0x4E4F534a,
    Binary = 0x004E4942,
  }

  /** The result of [[GltfTileIO.Reader.read]].
   * @internal
   */
  export interface ReaderResult extends Tile.Content {
    readStatus: TileIO.ReadStatus;
  }

  /** Header preceding glTF tile data.
   * @internal
   */
  export class Header extends TileIO.Header {
    public readonly gltfLength: number;
    public readonly scenePosition: number = 0;
    public readonly sceneStrLength: number = 0;
    public readonly binaryPosition: number = 0;
    public get isValid(): boolean { return TileIO.Format.Gltf === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.gltfLength = stream.nextUint32;
      this.sceneStrLength = stream.nextUint32;
      const value5 = stream.nextUint32;

      // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
      // validating the chunk type.
      if (this.version === Versions.Version2 && value5 === Versions.Gltf1SceneFormat)
        this.version = Versions.Version1;

      if (this.version === Versions.Version1) {
        const gltfSceneFormat = value5;
        if (Versions.Gltf1SceneFormat !== gltfSceneFormat) {
          this.invalidate();
          return;
        }
        this.scenePosition = stream.curPos;
        this.binaryPosition = stream.curPos + this.sceneStrLength;
      } else if (this.version === Versions.Version2) {
        const sceneChunkType = value5;
        this.scenePosition = stream.curPos;
        stream.curPos = stream.curPos + this.sceneStrLength;
        const binaryLength = stream.nextUint32;
        const binaryChunkType = stream.nextUint32;
        if (V2ChunkTypes.JSON !== sceneChunkType || V2ChunkTypes.Binary !== binaryChunkType || 0 === binaryLength) {
          this.invalidate();
          return;
        }
        this.binaryPosition = stream.curPos;
      } else {
        this.invalidate();
      }
    }
  }

  /** @internal */
  export const enum MeshMode {
    Lines = 1,
    LineStrip = 3,
    Triangles = 4,
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  export type DataBuffer = Uint8Array | Uint16Array | Uint32Array | Float32Array;

  /**
   * A chunk of binary data exposed as a typed array.
   * The count member indicates how many elements exist. This may be less than this.buffer.length due to padding added to the
   * binary stream to ensure correct alignment.
   * @internal
   */
  export class BufferData {
    public readonly buffer: DataBuffer;
    public readonly count: number;

    public constructor(buffer: DataBuffer, count: number) {
      this.buffer = buffer;
      this.count = count;
    }

    /**
     * Create a BufferData of the desired type. The actual type may differ from the desired type - for example, small 32-bit integers
     * may be represented as 8-bit or 16-bit integers instead.
     * If the actual data type is not convertible to the desired type, this function returns undefined.
     */
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

  /**
   * A view of a chunk of a tile's binary data containing an array of elements of a specific data type.
   * The count member indicates how many elements exist; this may be smaller than this.data.length.
   * The count member may also indicate the number of elements of a type containing more than one value of the
   * underlying type. For example, a buffer of 4 32-bit floating point 'vec2' elements will have a count of 4,
   * but its data member will contain 8 32-bit floating point values (2 per vec2).
   * The accessor member may contain additional JSON data specific to a particular buffer.
   * @internal
   */
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

  /** Data required for creating a Reader capable of deserializing [glTF tile data](https://www.khronos.org/gltf/).
   * @internal
   */
  export class ReaderProps {
    private constructor(public readonly buffer: TileIO.StreamBuffer,
      public readonly binaryData: Uint8Array,
      public readonly accessors: any,
      public readonly bufferViews: any,
      public readonly scene: any,
      public readonly nodes: any,
      public readonly meshes: any,
      public readonly materials: any,
      public readonly extensions: any,
      public readonly samplers: any,
      public readonly techniques: any,
      public readonly yAxisUp: boolean) { }

    /** Attempt to construct a new ReaderProps from the binary data beginning at the supplied stream's current read position. */
    public static create(buffer: TileIO.StreamBuffer, yAxisUp: boolean = false): ReaderProps | undefined {
      const header = new Header(buffer);
      if (!header.isValid)
        return undefined;

      const binaryData = new Uint8Array(buffer.arrayBuffer, header.binaryPosition);
      buffer.curPos = header.scenePosition;
      const sceneStrData = buffer.nextBytes(header.sceneStrLength);
      const sceneStr = utf8ToString(sceneStrData);
      if (undefined === sceneStr)
        return undefined;

      try {
        const sceneValue = JSON.parse(sceneStr);
        const nodes = JsonUtils.asObject(sceneValue.nodes);
        const meshes = JsonUtils.asObject(sceneValue.meshes);
        const materialValues = JsonUtils.asObject(sceneValue.materials);
        const accessors = JsonUtils.asObject(sceneValue.accessors);
        const bufferViews = JsonUtils.asObject(sceneValue.bufferViews);
        const extensions = JsonUtils.asObject(sceneValue.extensions);
        const samplers = JsonUtils.asObject(sceneValue.samplers);
        const techniques = JsonUtils.asObject(sceneValue.techniques);

        if (undefined === meshes)
          return undefined;

        return new ReaderProps(buffer, binaryData, accessors, bufferViews, sceneValue, nodes, meshes, materialValues, extensions, samplers, techniques, yAxisUp);
      } catch (e) {
        return undefined;
      }
    }
  }

  /** A function that returns true if Reader.read() should abort because the tile data is no longer needed.
   * @internal
   */
  export type IsCanceled = (reader: Reader) => boolean;

  /* -----------------------------------
     This is part of the webworker option.

    // input is Uint8Array, the result is an ImageBitMap.
    class ImageDecodeWorkerOperation extends WorkerOperation {
      constructor(imageBytes: ArrayBuffer, imageMimeType: string) {
        super("imageBytesToImageBitmap", [imageBytes, imageMimeType], [imageBytes]);
      }
    }

    declare var BUILD_SEMVER: string;
  -------------------------------------- */

  /** Deserializes [(glTF tile data](https://www.khronos.org/gltf/).
   * @internal
   */
  export abstract class Reader {
    protected readonly _buffer: TileIO.StreamBuffer;
    protected readonly _scene: any;
    protected readonly _accessors: any;
    protected readonly _bufferViews: any;
    protected readonly _meshes: any;
    protected readonly _nodes: any;
    protected readonly _batchData: any;
    protected readonly _materialValues: any;
    protected readonly _textures: any;
    protected readonly _renderMaterials: any;  // Materials that may be deserialized and created directly
    protected readonly _namedTextures: any;    // Textures that may be deserialized and created directly
    protected readonly _images: any;
    protected readonly _samplers: any;
    protected readonly _techniques: any;
    protected readonly _binaryData: Uint8Array;
    protected readonly _iModel: IModelConnection;
    protected readonly _is3d: boolean;
    protected readonly _modelId: Id64String;
    protected readonly _system: RenderSystem;
    protected readonly _returnToCenter: number[] | undefined;
    protected readonly _yAxisUp: boolean;
    protected readonly _type: BatchType;
    private readonly _canceled?: IsCanceled;

    /* -----------------------------------
    private static _webWorkerManager: WebWorkerManager;

    private static get webWorkerManager() {
      if (!Reader._webWorkerManager) {
        Reader._webWorkerManager = new WebWorkerManager("v" + BUILD_SEMVER + "/frontend-webworker.js", 4);
      }
      return Reader._webWorkerManager;
    }
    ------------------------------------- */

    /** Asynchronously deserialize the tile data and return the result. */
    public async abstract read(): Promise<ReaderResult>;

    protected get _isCanceled(): boolean { return undefined !== this._canceled && this._canceled(this); }
    protected get _isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this._type; }

    protected readGltfAndCreateGraphics(isLeaf: boolean, featureTable: FeatureTable, contentRange: ElementAlignedBox3d, transformToRoot?: Transform, sizeMultiplier?: number, instances?: InstancedGraphicParams): GltfTileIO.ReaderResult {
      if (this._isCanceled)
        return { readStatus: TileIO.ReadStatus.Canceled, isLeaf, sizeMultiplier };

      const childNodes = new Set<string>();
      for (const key of Object.keys(this._nodes)) {
        const node = this._nodes[key];
        if (node.children)
          for (const child of node.children)
            childNodes.add(child.toString());
      }

      const renderGraphicList: RenderGraphic[] = [];
      let readStatus: TileIO.ReadStatus = TileIO.ReadStatus.InvalidTileData;
      for (const nodeKey of Object.keys(this._nodes))
        if (!childNodes.has(nodeKey))
          if (TileIO.ReadStatus.Success !== (readStatus = this.readNodeAndCreateGraphics(renderGraphicList, this._nodes[nodeKey], featureTable, undefined, instances)))
            return { readStatus, isLeaf };

      if (0 === renderGraphicList.length)
        return { readStatus: TileIO.ReadStatus.InvalidTileData, isLeaf };

      let renderGraphic: RenderGraphic | undefined;
      if (1 === renderGraphicList.length)
        renderGraphic = renderGraphicList[0];
      else
        renderGraphic = this._system.createGraphicList(renderGraphicList);

      renderGraphic = this._system.createBatch(renderGraphic, PackedFeatureTable.pack(featureTable), contentRange);
      if (undefined !== this._returnToCenter || this._yAxisUp || undefined !== transformToRoot) {
        const branch = new GraphicBranch();
        branch.add(renderGraphic);
        let transform = (undefined === this._returnToCenter) ? Transform.createIdentity() : Transform.createTranslationXYZ(this._returnToCenter[0], this._returnToCenter[1], this._returnToCenter[2]);
        if (this._yAxisUp) transform = transform.multiplyTransformMatrix3d(Matrix3d.createRotationAroundVector(Vector3d.create(1.0, 0.0, 0.0), Angle.createRadians(Angle.piOver2Radians)) as Matrix3d);
        if (undefined !== transformToRoot) transform = transformToRoot.multiplyTransformTransform(transform);
        renderGraphic = this._system.createBranch(branch, transform);
      }

      return {
        readStatus,
        isLeaf,
        sizeMultiplier,
        contentRange,
        graphic: renderGraphic,
      };
    }

    private readNodeAndCreateGraphics(renderGraphicList: RenderGraphic[], node: any, featureTable: FeatureTable, parentTransform: Transform | undefined, instances?: InstancedGraphicParams): TileIO.ReadStatus {
      if (undefined === node)
        return TileIO.ReadStatus.InvalidTileData;

      let thisTransform = parentTransform;
      if (Array.isArray(node.matrix)) {
        const jTrans = node.matrix;
        const nodeTransform = Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), Matrix3d.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
        thisTransform = thisTransform ? thisTransform.multiplyTransformTransform(nodeTransform) : nodeTransform;
      }
      const meshKey = node.meshes ? node.meshes : node.mesh;
      if (undefined !== meshKey) {
        const nodeMesh = this._meshes[meshKey];
        if (nodeMesh) {
          const meshGraphicArgs = new MeshGraphicArgs();
          const geometryCollection = new TileIO.GeometryCollection(new MeshList(featureTable), true, false);
          for (const primitive of nodeMesh.primitives) {
            const geometry = this.readMeshPrimitive(primitive, featureTable);
            if (undefined !== geometry)
              geometryCollection.meshes.push(geometry);
          }

          let renderGraphic: RenderGraphic | undefined;
          if (!geometryCollection.isEmpty) {
            if (1 === geometryCollection.meshes.length) {
              renderGraphic = geometryCollection.meshes[0].getGraphics(meshGraphicArgs, this._system, instances);
            } else {
              const thisList: RenderGraphic[] = [];
              for (const mesh of geometryCollection.meshes) {
                renderGraphic = mesh.getGraphics(meshGraphicArgs, this._system, instances);
                if (undefined !== renderGraphic)
                  thisList.push(renderGraphic!);
              }
              if (0 !== thisList.length)
                renderGraphic = this._system.createGraphicList(thisList);
            }
            if (renderGraphic) {
              if (thisTransform && !thisTransform.isIdentity) {
                const branch = new GraphicBranch();
                branch.add(renderGraphic);
                renderGraphic = this._system.createBranch(branch, thisTransform);
              }
              renderGraphicList.push(renderGraphic);
            }
          }
        }
      }
      if (node.children) {
        for (const child of node.children)
          this.readNodeAndCreateGraphics(renderGraphicList, this._nodes[child], featureTable, thisTransform, instances);
      }
      return TileIO.ReadStatus.Success;
    }

    public getBufferView(json: any, accessorName: string): BufferView | undefined {
      try {
        const accessorValue = JsonUtils.asString(json[accessorName]);
        const accessor = 0 < accessorValue.length ? JsonUtils.asObject(this._accessors[accessorValue]) : undefined;
        const bufferViewAccessorValue = undefined !== accessor ? JsonUtils.asString(accessor.bufferView) : "";
        const bufferView = 0 < bufferViewAccessorValue.length ? JsonUtils.asObject(this._bufferViews[bufferViewAccessorValue]) : undefined;

        if (undefined === accessor)
          return undefined;

        const type = accessor.componentType as DataType;
        let dataSize = 0;
        switch (type) {
          case DataType.UnsignedByte:
            dataSize = 1;
            break;
          case DataType.UnsignedShort:
            dataSize = 2;
            break;
          case DataType.UInt32:
          case DataType.Float:
            dataSize = 4;
            break;
          default:
            return undefined;
        }
        let componentCount = 1;
        switch (accessor.type) {
          case "VEC3":
            componentCount = 3;
            break;
          case "VEC2":
            componentCount = 2;
            break;
        }

        const offset = ((bufferView && bufferView.byteOffset) ? bufferView.byteOffset : 0) + (accessor.byteOffset ? accessor.byteOffset : 0);
        const length = componentCount * dataSize * accessor.count;
        // If the data is misaligned (Scalable mesh tile publisher) use slice to copy -- else use subarray.
        // assert(0 === offset % dataSize);
        const bytes = (0 === (this._binaryData.byteOffset + offset) % dataSize) ? this._binaryData.subarray(offset, offset + length) : this._binaryData.slice(offset, offset + length);
        return new BufferView(bytes, accessor.count as number, type, accessor);
      } catch (e) {
        return undefined;
      }
    }

    public readBufferData32(json: any, accessorName: string): BufferData | undefined { return this.readBufferData(json, accessorName, DataType.UInt32); }
    public readBufferData16(json: any, accessorName: string): BufferData | undefined { return this.readBufferData(json, accessorName, DataType.UnsignedShort); }
    public readBufferData8(json: any, accessorName: string): BufferData | undefined { return this.readBufferData(json, accessorName, DataType.UnsignedByte); }
    public readBufferDataFloat(json: any, accessorName: string): BufferData | undefined { return this.readBufferData(json, accessorName, DataType.Float); }

    protected constructor(props: ReaderProps, iModel: IModelConnection, modelId: Id64String, is3d: boolean, system: RenderSystem, type: BatchType = BatchType.Primary, isCanceled?: IsCanceled) {
      this._buffer = props.buffer;
      this._scene = props.scene;
      this._binaryData = props.binaryData;
      this._accessors = props.accessors;
      this._bufferViews = props.bufferViews;
      this._meshes = props.meshes;
      this._nodes = props.nodes;
      this._materialValues = props.materials;
      this._samplers = props.samplers;
      this._techniques = props.techniques;
      this._yAxisUp = props.yAxisUp;
      this._returnToCenter = this.extractReturnToCenter(props.extensions);
      this._textures = props.scene.textures;
      this._images = props.scene.images;

      this._renderMaterials = props.scene.renderMaterials;
      this._namedTextures = props.scene.namedTextures;

      this._iModel = iModel;
      this._modelId = modelId;
      this._is3d = is3d;
      this._system = system;
      this._type = type;
      this._canceled = isCanceled;
    }

    protected readBufferData(json: any, accessorName: string, type: DataType): BufferData | undefined {
      const view = this.getBufferView(json, accessorName);
      return undefined !== view ? view.toBufferData(type) : undefined;
    }

    protected readFeatureIndices(_json: any): number[] | undefined { return undefined; }

    private colorFromJson(values: number[]): ColorDef { return ColorDef.from(values[0] * 255, values[1] * 255, values[2] * 255, (1.0 - values[3]) * 255); }

    private colorFromMaterial(materialJson: any): ColorDef {
      if (materialJson) {
        if (materialJson.values && Array.isArray(materialJson.values.color))
          return this.colorFromJson(materialJson.values.color);
        else if (materialJson.pbrMetallicRoughness && Array.isArray(materialJson.pbrMetallicRoughness.baseColorFactor))
          return this.colorFromJson(materialJson.pbrMetallicRoughness.baseColorFactor);
        else if (materialJson.extensions && materialJson.extensions.KHR_techniques_webgl && materialJson.extensions.KHR_techniques_webgl.values && materialJson.extensions.KHR_techniques_webgl.values.u_color)
          return this.colorFromJson(materialJson.extensions.KHR_techniques_webgl.values.u_color);
      }
      return ColorDef.white.clone();
    }

    protected createDisplayParams(materialJson: any, hasBakedLighting: boolean): DisplayParams | undefined {
      let textureMapping: TextureMapping | undefined;

      if (undefined !== materialJson) {
        if (materialJson.values && materialJson.values.tex)
          textureMapping = this.findTextureMapping(materialJson.values.tex);    // Bimiums shader value.
        else if (materialJson.extensions && materialJson.extensions.KHR_techniques_webgl && materialJson.extensions.KHR_techniques_webgl.values && materialJson.extensions.KHR_techniques_webgl.values.u_tex)
          textureMapping = this.findTextureMapping(materialJson.extensions.KHR_techniques_webgl.values.u_tex.index);    // Bimiums colorIndex.
        else if (materialJson.diffuseTexture)
          textureMapping = this.findTextureMapping(materialJson.diffuseTexture.index);        // TBD -- real map support with PBR
        else if (materialJson.emissiveTexture)
          textureMapping = this.findTextureMapping(materialJson.emissiveTexture.index);      // TBD -- real map support with PBR
      }

      const color = this.colorFromMaterial(materialJson);
      return new DisplayParams(DisplayParams.Type.Mesh, color, color, 1, LinePixels.Solid, FillFlags.Always, undefined, undefined, hasBakedLighting, textureMapping);
    }
    protected extractReturnToCenter(extensions: any): number[] | undefined {
      if (extensions === undefined) { return undefined; }
      const cesiumRtc = JsonUtils.asObject(extensions.CESIUM_RTC);
      if (cesiumRtc === undefined) return undefined;
      const rtc = JsonUtils.asArray(cesiumRtc.center);
      return (rtc[0] === 0.0 && rtc[1] === 0.0 && rtc[2] === 0.0) ? undefined : rtc;
    }

    protected readMeshPrimitive(primitive: any, featureTable?: FeatureTable): Mesh | undefined {
      const materialName = JsonUtils.asString(primitive.material);
      const hasBakedLighting = undefined === primitive.attributes.NORMAL;
      const materialValue = 0 < materialName.length ? JsonUtils.asObject(this._materialValues[materialName]) : undefined;
      const displayParams = undefined !== materialValue ? this.createDisplayParams(materialValue, hasBakedLighting) : undefined;
      if (undefined === displayParams)
        return undefined;

      let primitiveType: number = -1;
      const meshMode = JsonUtils.asInt(primitive.mode, GltfTileIO.MeshMode.Triangles);
      switch (meshMode) {
        case GltfTileIO.MeshMode.Lines:
          primitiveType = Mesh.PrimitiveType.Polyline;
          return undefined; // Needs work...
          break;
        case GltfTileIO.MeshMode.Triangles:
          primitiveType = Mesh.PrimitiveType.Mesh;
          break;
        default:
          assert(false);
          return undefined;
      }
      const isPlanar = JsonUtils.asBool(primitive.isPlanar);

      const isVolumeClassifier = this._isVolumeClassifier;
      const mesh = Mesh.create({
        displayParams,
        features: undefined !== featureTable ? new Mesh.Features(featureTable) : undefined,
        type: primitiveType,
        range: Range3d.createNull(),
        is2d: !this._is3d,
        isPlanar,
        hasBakedLighting,
        isVolumeClassifier,
      });
      // We don't have real colormap - just load material color.  This will be used if non-Bentley
      // tile or fit the color table is uniform. For a non-Bentley, non-Uniform, we'll set the
      // uv parameters to pick the colors out of the color map texture.
      mesh.colorMap.insert(displayParams.fillColor.tbgr);   // White...

      const colorIndices = this.readBufferData16(primitive.attributes, "_COLORINDEX");
      if (undefined !== colorIndices) {
        let texStep;
        if (materialValue.values !== undefined && Array.isArray(materialValue.values.texStep))
          texStep = materialValue.values.texStep;
        else if (materialValue.extensions && materialValue.extensions.KHR_techniques_webgl && materialValue.extensions.KHR_techniques_webgl.values && Array.isArray(materialValue.extensions.KHR_techniques_webgl.values.u_texStep))
          texStep = materialValue.extensions.KHR_techniques_webgl.values.u_texStep;

        if (texStep)
          for (let i = 0; i < colorIndices.count; i++)
            mesh.uvParams.push(new Point2d(texStep[1] + texStep[0] * colorIndices.buffer[i], .5));
      }

      if (undefined !== mesh.features && !this.readFeatures(mesh.features, primitive))
        return undefined;
      if (primitive.extensions && primitive.extensions.KHR_draco_mesh_compression) {
        return undefined;     // Defer Draco support until moved to web worker.
        /*
        const dracoExtension = primitive.extensions.KHR_draco_mesh_compression;
        const bufferView = this._bufferViews[dracoExtension.bufferView];
        if (undefined === bufferView) return undefined;
        const bufferData = this._binaryData.subarray(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);

        return  DracoDecoder.readDracoMesh(mesh, primitive, bufferData); */
      }
      if (!this.readVertices(mesh.points, primitive))
        return undefined;

      switch (primitiveType) {
        case Mesh.PrimitiveType.Mesh: {
          if (!this.readMeshIndices(mesh, primitive))
            return undefined;

          if (!displayParams.ignoreLighting && !this.readNormals(mesh.normals, primitive.attributes, "NORMAL"))
            return undefined;

          if (0 === mesh.uvParams.length)
            this.readUVParams(mesh.uvParams, primitive.attributes, "TEXCOORD_0");
          break;
        }

        case Mesh.PrimitiveType.Polyline:
        case Mesh.PrimitiveType.Point: {
          if (undefined !== mesh.polylines && !this.readPolylines(mesh.polylines, primitive, "indices", Mesh.PrimitiveType.Point === primitiveType))
            return undefined;
          break;
        }
        default: {
          assert(false, "unhandled primitive type");
          return undefined;
        }
      }
      if (displayParams.textureMapping && 0 === mesh.uvParams.length)
        return undefined;

      return mesh;
    }

    protected readVertices(positions: QPoint3dList, primitive: any): boolean {
      const view = this.getBufferView(primitive.attributes, "POSITION");
      if (undefined === view)
        return false;

      if (DataType.Float === view.type) {
        const buffer = view.toBufferData(DataType.Float);
        if (undefined === buffer)
          return false;
        const range = Range3d.createNull();
        for (let i = 0; i < buffer.buffer.length;)
          range.extendXYZ(buffer.buffer[i++], buffer.buffer[i++], buffer.buffer[i++]);

        positions.reset(QParams3d.fromRange(range));
        const scratchPoint = new Point3d();
        for (let i = 0, j = 0; i < buffer.count; i++) {
          scratchPoint.set(buffer.buffer[j++], buffer.buffer[j++], buffer.buffer[j++]);
          positions.add(scratchPoint);
        }
      } else {
        if (DataType.UnsignedShort !== view.type)
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
        positions.reset(QParams3d.fromRange(Range3d.create(Point3d.create(rangeMin[0], rangeMin[1], rangeMin[2]), Point3d.create(rangeMax[0], rangeMax[1], rangeMax[2]))));
        for (let i = 0; i < view.count; i++) {
          const index = i * 3; // 3 uint16 per QPoint3d...
          qpt.setFromScalars(buffer.buffer[index], buffer.buffer[index + 1], buffer.buffer[index + 2]);
          positions.push(qpt);
        }
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

    protected readMeshIndices(mesh: Mesh, json: any): boolean {
      const data = this.readBufferData32(json, "indices");
      if (undefined === data)
        return false;

      assert(0 === data.count % 3);

      const triangle = new Triangle(false);

      for (let i = 0; i < data.count; i += 3) {
        triangle.setIndices(data.buffer[i], data.buffer[i + 1], data.buffer[i + 2]);
        mesh.addTriangle(triangle);
      }

      return true;
    }

    protected readNormals(normals: OctEncodedNormal[], json: any, accessorName: string): boolean {
      const view = this.getBufferView(json, accessorName);
      if (undefined === view)
        return false;

      switch (view.type) {
        case DataType.Float: {
          const data = view.toBufferData(DataType.Float);
          if (undefined === data)
            return false;

          const scratchNormal = new Vector3d();
          for (let i = 0, j = 0; i < data.count; i++) {
            scratchNormal.set(data.buffer[j++], data.buffer[j++], data.buffer[j++]);
            normals.push(OctEncodedNormal.fromVector(scratchNormal));
          }
          return true;
        }

        case DataType.UnsignedByte: {
          const data = view.toBufferData(DataType.UnsignedByte);
          if (undefined === data)
            return false;

          // ###TODO: we shouldn't have to allocate OctEncodedNormal objects...just use uint16s / numbers...
          for (let i = 0; i < data.count; i++) {
            // ###TODO? not clear why ray writes these as pairs of uint8...
            const index = i * 2;
            const normal = data.buffer[index] | (data.buffer[index + 1] << 8);
            normals.push(new OctEncodedNormal(normal));
          }
          return true;
        }
        default:
          return false;
      }
    }

    protected readUVParams(params: Point2d[], json: any, accessorName: string): boolean {
      const view = this.getBufferView(json, accessorName);
      let data: any;

      if (view === undefined) { return false; }
      switch (view.type) {
        case DataType.Float: {
          data = this.readBufferDataFloat(json, accessorName);

          for (let i = 0; i < data.count; i++) {
            const index = 2 * i; // 2 float per param...
            params.push(new Point2d(data.buffer[index], data.buffer[index + 1]));
          }
          break;
        }

        case DataType.UnsignedShort: {
          // TBD.   Support quantized UVParams in shaders rather than expanding here.
          const extensions = JsonUtils.asObject(view.accessor.extensions);
          const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
          if (undefined === quantized)
            return false;

          const decodeMatrix = JsonUtils.asArray(quantized.decodeMatrix);
          if (undefined === decodeMatrix) { return false; }

          const qData = view.toBufferData(DataType.UnsignedShort);
          if (undefined === qData) { return false; }

          for (let i = 0; i < view.count; i++) {
            const index = 2 * i; // 3 uint16 per QPoint3d...
            params.push(new Point2d(qData.buffer[index] * decodeMatrix[0] + decodeMatrix[6], qData.buffer[index + 1] * decodeMatrix[4] + decodeMatrix[7]));
          }
          break;
        }
      }

      return true;
    }

    protected readPolylines(polylines: MeshPolylineList, json: any, accessorName: string, disjoint: boolean): boolean {
      const view = this.getBufferView(json, accessorName);
      if (undefined === view)
        return false;

      const numIndices = new Uint32Array(1);
      const niBytes = new Uint8Array(numIndices.buffer);
      const index16 = new Uint16Array(1);
      const i16Bytes = new Uint8Array(index16.buffer);
      const index32 = new Uint32Array(1);
      const i32Bytes = new Uint8Array(index32.buffer);

      let ndx = 0;
      for (let p = 0; p < view.count; ++p) {
        for (let b = 0; b < 4; ++b)
          niBytes[b] = view.data[ndx++];

        if (!disjoint && numIndices[0] < 2)
          continue;

        const indices: number[] = new Array(numIndices[0]);

        if (DataType.UnsignedShort === view.type) {
          for (let i = 0; i < numIndices[0]; ++i) {
            for (let b = 0; b < 2; ++b)
              i16Bytes[b] = view.data[ndx++];
            indices[i] = index16[0];
          }
          // Need to skip padding if we had an odd number of 16-bit indices.
          if (0 !== numIndices[0] % 2)
            ndx += 2;
        } else if (DataType.UInt32 === view.type) {
          for (let i = 0; i < numIndices[0]; ++i) {
            for (let b = 0; b < 4; ++b)
              i32Bytes[b] = view.data[ndx++];
            indices[i] = index32[0];
          }
        }

        polylines.push(new MeshPolyline(indices));
      }

      return true;
    }

    protected async loadTextures(): Promise<void> {
      if (undefined === this._textures)
        return Promise.resolve();

      const transparentTextures: Set<string> = new Set<string>();
      for (const name of Object.keys(this._materialValues)) {
        const materialValue = this._materialValues[name];
        let technique;
        if (undefined !== materialValue.values &&
          undefined !== materialValue.values.tex &&
          undefined !== materialValue.technique &&
          undefined !== (technique = this._techniques[materialValue.technique]) &&
          undefined !== technique.states &&
          Array.isArray(technique.states.enable)) {
          for (const enable of technique.states.enable)
            if (enable === 3042)
              transparentTextures.add(materialValue.values.tex);
        }
      }

      const promises = new Array<Promise<void>>();
      for (const name of Object.keys(this._textures))
        promises.push(this.loadTexture(name, transparentTextures.has(name)));

      return promises.length > 0 ? Promise.all(promises).then((_) => undefined) : Promise.resolve();
    }

    protected async loadTextureImage(imageJson: any, samplerJson: any, isTransparent: boolean): Promise<RenderTexture | undefined> {
      try {
        const binaryImageJson = (imageJson.extensions && imageJson.extensions.KHR_binary_glTF) ? JsonUtils.asObject(imageJson.extensions.KHR_binary_glTF) : imageJson;
        const bufferView = this._bufferViews[binaryImageJson.bufferView];
        const mimeType = JsonUtils.asString(binaryImageJson.mimeType);
        const format = getImageSourceFormatForMimeType(mimeType);
        if (undefined === format)
          return undefined;

        let textureType = RenderTexture.Type.Normal;
        if (undefined !== samplerJson &&
          (undefined !== samplerJson.wrapS || undefined !== samplerJson.wrapS))
          textureType = RenderTexture.Type.TileSection;
        const textureParams = new RenderTexture.Params(undefined, textureType);
        const offset = bufferView.byteOffset;

        /* -----------------------------------
            const jpegArray = this._binaryData.slice(offset, offset + bufferView.byteLength);
            const jpegArrayBuffer = jpegArray.buffer;
            const workerOp = new ImageDecodeWorkerOperation(jpegArrayBuffer, mimeType);
            return Reader.webWorkerManager.queueOperation(workerOp)
              .then((imageBitmap) => this._isCanceled ? undefined : this._system.createTextureFromImage(imageBitmap, isTransparent && ImageSourceFormat.Png === format, this._iModel, textureParams))
              .catch((_) => undefined);
          ------------------------------------- */

        const bytes = this._binaryData.subarray(offset, offset + bufferView.byteLength);
        const imageSource = new ImageSource(bytes, format);
        return imageElementFromImageSource(imageSource)
          .then((image) => this._isCanceled ? undefined : this._system.createTextureFromImage(image, isTransparent && ImageSourceFormat.Png === format, this._iModel, textureParams))
          .catch((_) => undefined);
      } catch (e) {
        return undefined;
      }
    }

    protected async loadTexture(textureId: string, isTransparent: boolean): Promise<void> {
      const textureJson = JsonUtils.asObject(this._textures[textureId]);
      if (undefined === textureJson)
        return Promise.resolve();

      return this.loadTextureImage(this._images[textureJson.source], undefined === this._samplers ? undefined : this._samplers[textureJson.sampler], isTransparent).then((texture) => {
        textureJson.renderTexture = texture;
      });
    }

    protected findTextureMapping(textureId: string): TextureMapping | undefined {
      const textureJson = JsonUtils.asObject(this._textures[textureId]);
      const texture = undefined !== textureJson ? textureJson.renderTexture as RenderTexture : undefined;
      return undefined !== texture ? new TextureMapping(texture, new TextureMapping.Params()) : undefined;
    }
  }
}

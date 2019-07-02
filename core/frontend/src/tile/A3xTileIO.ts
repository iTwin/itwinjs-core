/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { assert, utf8ToString } from "@bentley/bentleyjs-core";
import { Matrix4d, Point4dProps, Range3d, Transform } from "@bentley/geometry-core";
import { AxisAlignedBox3d, ColorDef } from "@bentley/imodeljs-common";
import { TileIO } from "./TileIO";

/** Types used for deserializing A3X (Agency9 / CityPlanner) binary tile format.
 * @internal
 */
export namespace A3xTileIO {
  /** Spec asserts it will always be little-endian. */
  export enum ByteOrder {
    LittleEndian = 1,
    BigEndian = 2,
  }

  /** Only Z-up is supported by CityPlanner and therefore by us. */
  export enum UpAxis {
    Z = 3,
  }

  export enum OptionType {
    Boolean = 1,
    Int = 2,
    String = 3,
    Custom = 4,
  }

  export interface Option {
    readonly name: string;
    readonly type: OptionType; // unsigned varint
    readonly valueLength: number; // int, in bytes
    // value: object
  }

  export enum ChunkType {
    ContentList = 1,
    Model = 2,
  }

  export enum ContentType {
    Instance = 1,
    Node = 2,
    Buffer = 7,
    Mesh = 8,
    Texture = 9,
    Material = 10,
    String = 11,
  }

  export enum AttributeType {
    Object = 1,
    String = 2,
    Int = 3,
    Long = 4,
    Double = 5,
    Boolean = 6,
    Array = 7,
  }

  export interface StringAttributeValue {
    type: AttributeType.String;
    value: number; // the ID of the string in Reader.strings
  }

  export interface NumericAttributeValue {
    type: AttributeType.Int | AttributeType.Long | AttributeType.Double;
    value: number;
  }

  export interface BooleanAttributeValue {
    type: AttributeType.Boolean;
    value: boolean;
  }

  export interface ArrayAttributeValue {
    type: AttributeType.Array;
    value: AttributeValue[];
  }

  export interface ObjectAttributeValue {
    type: AttributeType.Object;
    value: Attributes;
  }

  export type AttributeValue = StringAttributeValue | NumericAttributeValue | BooleanAttributeValue | ArrayAttributeValue | ObjectAttributeValue;

  export interface Attribute {
    keyId: number;
    value: AttributeValue;
  }

  export type Attributes = Attribute[];

  export enum NodeDataType {
    AABB = 1,
    Transforms = 2,
  }

  export enum MeshDataType {
    Position = 1,
    Normal = 2,
    AttributeKeys = 4,
  }

  export enum MaterialType {
    Diffuse = 1,
    Ambient = 2,
    Emission = 3,
    Specular = 4,
    Shininess = 5,
    Transparent = 6,
  }

  type MaterialAspectName = "diffuse" | "ambient" | "emission" | "specular" | "shininess" | "transparent";
  function materialTypeToName(type: MaterialType): MaterialAspectName | undefined {
    switch (type) {
      case MaterialType.Diffuse: return "diffuse";
      case MaterialType.Ambient: return "ambient";
      case MaterialType.Emission: return "emission";
      case MaterialType.Specular: return "specular";
      case MaterialType.Shininess: return "shininess";
      case MaterialType.Transparent: return "transparent";
      default: return undefined;
    }
  }

  export enum MaterialDataType {
    Color = 1,
    Texture = 2,
    TextureCoordinateBufferSet = 3,
    ColorBufferSet = 4,
    WrapS = 5,
    WrapT = 6,
    MinFilter = 7,
    MagFilter = 8,
    MipFilter = 9,
    Value = 10,
  }

  export enum WrapMode {
    Repeat = 1,
    MirroredRepeat = 2,
    ClampToEdge = 3,
    ClampToBorder = 4,
  }

  export enum FilterType {
    Nearest = 1,
    Linear = 2,
  }

  /** A bitmask indicating presence of any opaque, translucent, and/or transparent pixels within a texture. */
  export enum AlphaInfo {
    Opaque = 1,
    Transluent = 2,
    Transparent = 4,
  }

  export enum TextureType {
    Jpeg = 1,
    Png = 2,
    Dxt1 = 6, // ###TODO other compressed formats must be in newer spec.
  }

  export enum PrimitiveType {
    Point = 1,
    Line = 2,
    Triangle = 5,
  }

  export enum BufferDataType {
    Undefined = 0, // can be used for textures
    Byte = 1,
    Short = 2,
    Int = 3,
    Long = 4,
    Float = 5,
    Double = 6,
  }

  export enum TransformType {
    Matrix = 1, // double[16] (column order)
    Translate = 2, // double[3] x, y, z
    Rotate = 3, // double[4] x, y, z, angle in degrees
    Scale = 4, // double[3] x, y, z
  }

  export enum ModelDataType {
    SceneGraph = 1,
    Instances = 2,
  }

  export enum InstanceGroupType {
    Node = 1,
    Batch = 2,
  }

  export interface NodeInstanceGroup {
    type: InstanceGroupType.Node;
    nodeId: number;
    instanceIds: number[];
  }

  export interface BatchInstanceGroup {
    type: InstanceGroupType.Batch;
    transform: Transform;
    aabb: AxisAlignedBox3d;
    instanceIds: number[];
  }

  export type InstanceGroup = NodeInstanceGroup | BatchInstanceGroup;

  /** Precedes each "Content" in a ContentList's array. */
  export interface ContentHeader {
    uid: number;
    length: number;
    numContentData: number;
  }

  export interface Model {
    attributes: Attributes;
    sceneGraph: number[]; // IDs of nodes. Expect 1 always?
    instances: InstanceGroup[];
  }

  export interface BufferPointer {
    bufferId: number;
    dataType: BufferDataType;
    offset: number; // in bytes
  }

  export interface BufferPointerRange extends BufferPointer {
    length: number; // in bytes
  }

  export interface Texture {
    width: number;
    height: number;
    alphaInfo: AlphaInfo;
    type: TextureType;
    bufferRange: BufferPointerRange;
  }

  export interface MaterialAspect {
    color?: ColorDef;
    textureId?: number;
    setId?: number; // texture coordinate set or color buffer set
    wrapS?: WrapMode;
    wrapT?: WrapMode;
    minFilter?: FilterType;
    magFilter?: FilterType;
    mipFilter?: FilterType;
    value?: number; // ###TODO no idea what this is supposed to be...
  }

  export interface Material {
    diffuse?: MaterialAspect;
    ambient?: MaterialAspect;
    emission?: MaterialAspect;
    specular?: MaterialAspect;
    shininess?: MaterialAspect;
    transparent?: MaterialAspect;
  }

  export interface Instance {
    materialId: number;
    meshIds: number[];
  }

  export interface Chunk {
    // chunk header
    readonly type: ChunkType; // unsigned varint
    readonly length: number; // int
    // start of chunk data within file following chunk header
    readonly offset: number;
  }

  export interface Node {
    readonly transform?: Transform;
    readonly aabb?: AxisAlignedBox3d;
    childNodeIds: number[];
    attributeKey: number;
    attributeName: string;
    attributes: Attributes;
  }

  export enum IndexBufferType {
    Default = 1,
    Quadrant0 = 2,
    Quadrant1 = 3,
    Quadrant2 = 4,
    Quadrant3 = 5,
  }

  export interface IndexBuffer {
    type: IndexBufferType;
    primitiveType: PrimitiveType;
    buffer: BufferPointer;
    offset: number;
    count: number;
  }

  export interface MeshData {
    setIdOrMeshType: number | MeshDataType;
    buffer: BufferPointer;
    offset: number;
    stride: number;
    numCoordinates: number;
  }

  export interface Mesh {
    indexBuffers: IndexBuffer[];
    textureCoordinateBuffers: MeshData[];
    colorBuffers: MeshData[];
    otherBuffers: MeshData[];
  }

  export class StreamReader extends TileIO.StreamBuffer {
    public constructor(bytes: Uint8Array) {
      super(bytes.buffer, { byteOffset: bytes.byteOffset, byteLength: bytes.byteLength });
    }

    // *unsigned*. Assumes we will not exceed 32 bits. Have seen no usage of signed varints in spec - except in 'attributes'.
    public get nextVarInt(): number {
      let value = 0;
      let shift = 0;
      do {
        const nextByte = this.nextUint8;
        if (0 === (nextByte & 0x80)) {
          value = (value | (nextByte << shift)) >>> 0;
          break;
        } else {
          value = (value | ((nextByte & 0x7f) << shift)) >>> 0;
          shift += 7;
        }
      } while (true);

      return value;
    }

    // string = { unsigned varint length; byte[length] utf8; }
    public get nextString(): string {
      const byteLen = this.nextVarInt;
      const utf8 = this.nextBytes(byteLen);
      const str = utf8ToString(utf8);
      return undefined !== str ? str : "";
    }

    public get nextOption(): Option {
      const name = this.nextString;
      const type = this.nextVarInt;
      const valueLength = this.nextInt32;
      this.advance(valueLength); // skip the object value
      return { name, type, valueLength };
    }

    public get nextBufferPointer(): BufferPointer {
      return {
        bufferId: this.nextVarInt,
        dataType: this.nextVarInt,
        offset: this.nextVarInt,
      };
    }

    public get nextBufferPointerRange(): BufferPointerRange {
      const ptr = this.nextBufferPointer;
      const length = this.nextVarInt;
      return { ...ptr, length };
    }

    public get nextAxisAlignedBox3d(): AxisAlignedBox3d {
      const center = this.nextPoint3d64;
      const halfLengths = this.nextPoint3d64;
      const range = new Range3d();
      center.minus(halfLengths, range.low);
      center.plus(halfLengths, range.high);
      return range;
    }

    public get nextMatrix4d(): Matrix4d {
      const coffs: Point4dProps[] = [];
      for (let i = 0; i < 4; i++) {
        const column: Point4dProps = [];
        for (let j = 0; j < 4; j++)
          column.push(this.nextFloat64);

        coffs.push(column);
      }

      // A3X stores as column-major. Earlin uses row-major.
      const matrix = Matrix4d.fromJSON(coffs);
      return matrix.cloneTransposed(matrix);
    }

    public get nextContentHeader(): ContentHeader {
      return {
        uid: this.nextVarInt,
        length: this.nextInt32,
        numContentData: this.nextVarInt,
      };
    }

    public get nextTexture(): Texture {
      const unused0 = this.nextUint8;
      const unused1 = this.nextUint8;
      assert(1 === unused0 && 0 === unused1); // per spec...
      const width = this.nextVarInt, height = this.nextVarInt;
      const alphaInfo = this.nextUint8;
      const type = this.nextVarInt;
      const bufferRange = this.nextBufferPointerRange;
      return { width, height, alphaInfo, type, bufferRange };
    }

    public get nextBuffer(): Uint8Array {
      const length = this.nextVarInt;
      return this.nextBytes(length);
    }

    public get nextMaterial(): Material {
      const numAspects = this.nextVarInt;
      const material: Material = { };
      for (let i = 0; i < numAspects; i++) {
        const type: MaterialType = this.nextVarInt;
        const aspect = this._nextMaterialAspect;
        const aspectName = materialTypeToName(type);
        if (undefined !== aspectName)
          material[aspectName] = aspect;
      }

      return material;
    }

    private get _nextMaterialAspect(): MaterialAspect {
      const aspect: MaterialAspect = { };
      const numData = this.nextVarInt;
      for (let i = 0; i < numData; i++) {
        const type = this.nextVarInt;
        const len = this.nextInt32;
        switch (type) {
          case MaterialDataType.Color:
            aspect.color = ColorDef.from(
              this.nextFloat64 * 255,
              this.nextFloat64 * 255,
              this.nextFloat64 * 255,
              (1.0 - this.nextFloat64) * 255,
            );
            break;
          case MaterialDataType.Texture:
            aspect.textureId = this.nextVarInt;
            break;
          case MaterialDataType.TextureCoordinateBufferSet:
            aspect.setId = this.nextVarInt;
            break;
          case MaterialDataType.WrapS:
            aspect.wrapS = this.nextVarInt;
            break;
          case MaterialDataType.WrapT:
            aspect.wrapT = this.nextVarInt;
            break;
          case MaterialDataType.MinFilter:
            aspect.minFilter = this.nextVarInt;
            break;
          case MaterialDataType.MagFilter:
            aspect.magFilter = this.nextVarInt;
            break;
          case MaterialDataType.MipFilter:
            aspect.mipFilter = this.nextVarInt;
            break;
          case MaterialDataType.Value:
            aspect.value = this.nextFloat64;
            break;
          default:
            this.advance(len);
            break;
        }
      }

      return aspect;
    }

    public get nextInstance(): Instance {
      const materialId = this.nextVarInt;
      const numMeshes = this.nextVarInt;
      const meshIds = [];
      for (let i = 0; i < numMeshes; i++)
        meshIds.push(this.nextVarInt);

      return { materialId, meshIds };
    }

    public get nextMesh(): Mesh {
      const indexBuffers: IndexBuffer[] = [];
      const textureCoordinateBuffers: MeshData[] = [];
      const colorBuffers: MeshData[] = [];
      const otherBuffers: MeshData[] = [];

      const numIndexBuffers = this.nextVarInt;
      for (let i = 0; i < numIndexBuffers; i++)
        indexBuffers.push(this._nextIndexBuffer);

      this.readMeshData(textureCoordinateBuffers);
      this.readMeshData(colorBuffers);
      this.readMeshData(otherBuffers);

      return { indexBuffers, textureCoordinateBuffers, colorBuffers, otherBuffers };
    }

    private get _nextIndexBuffer(): IndexBuffer {
      const type = this.nextVarInt;
      const buffer = this.nextBufferPointer;
      const primitiveType = this.nextVarInt;
      const offset = this.nextVarInt;
      const count = this.nextVarInt;
      return { type, buffer, primitiveType, offset, count };
    }

    private readMeshData(data: MeshData[]): void {
      const numData = this.nextVarInt;
      for (let i = 0; i < numData; i++) {
        const setIdOrMeshType = this.nextVarInt;
        const buffer = this.nextBufferPointer;
        const offset = this.nextVarInt;
        const stride = this.nextVarInt;
        const numCoordinates = this.nextVarInt;
        data.push({setIdOrMeshType, buffer, offset, stride, numCoordinates });
      }
    }

    public get nextAttributes(): Attributes {
      const attribs: Attribute[] = [];
      const count = this.nextVarInt;
      for (let i = 0; i < count; i++)
        attribs.push(this.nextAttribute);

      return attribs;
    }

    public get nextAttribute(): Attribute {
      const keyId = this.nextVarInt;
      const value = this.nextAttributeValue;
      return { keyId, value };
    }

    public get nextAttributeValue(): AttributeValue {
      const type = this.nextVarInt;
      switch (type) {
        case AttributeType.String: return { type, value: this.nextVarInt };
        case AttributeType.Int: return { type, value: this.nextVarInt };
        case AttributeType.Long: return { type, value: this.nextVarInt };
        case AttributeType.Double: return { type, value: this.nextFloat64 };
        case AttributeType.Boolean: return { type, value: this.nextUint8 !== 0 };
        case AttributeType.Array: {
          const value: AttributeValue[] = [];
          const count = this.nextVarInt;
          for (let i = 0; i < count; i++)
            value.push(this.nextAttributeValue);

          return { type, value };
        }
        case AttributeType.Object: {
          const value = this.nextAttributes;
          return { type, value };
        }
        default:
          assert(false, "Unrecognized attribute type - stream corrupted.");
          return { type: AttributeType.Boolean, value: false };
      }
    }

    public readModel(model: Model): void {
      this.advance(4); // int size, duplicated from chunk header
      const numData = this.nextVarInt;
      for (let i = 0; i < numData; i++) {
        const dataType = this.nextVarInt;
        const dataSize = this.nextInt32;
        const nextPos = this.curPos + dataSize;

        switch (dataType) {
          case ModelDataType.SceneGraph:
            const numNodes = this.nextVarInt;
            for (let j = 0; j < numNodes; j++)
              model.sceneGraph.push(this.nextVarInt);

            break;
          case ModelDataType.Instances:
            // NB: I do not expect to find more than one array of instance groups, but spec is quite terse+ambiguous
            this.readInstanceGroups(model.instances);
            break;
        }

        // Move to next content data entry (or end of array).
        this.curPos = nextPos;
      }

      model.attributes = this.nextAttributes;
    }

    private readInstanceGroups(groups: InstanceGroup[]): void {
      const numGroups = this.nextVarInt;
      for (let i = 0; i < numGroups; i++) {
        const type = this.nextVarInt;
        this.nextVarInt; // type is duplicated in instance group header.
        const numInstances = this.nextVarInt;
        const instances: number[] = [];
        for (let j = 0; j < numInstances; j++)
          instances.push(this.nextVarInt);

        switch (type) {
          case InstanceGroupType.Node:
            groups.push({
              type,
              instanceIds: instances,
              nodeId: this.nextVarInt,
            });
            break;
          case InstanceGroupType.Batch: {
            const matrix = this.nextMatrix4d;
            const aabb = this.nextAxisAlignedBox3d;
            const transform = matrix.asTransform;
            if (undefined !== transform)
              groups.push({
                type,
                instanceIds: instances,
                transform,
                aabb,
              });

            break;
          }
        }
      }
    }

    public readNode(numContentData: number): Node {
      let transform: Transform | undefined;
      let aabb: AxisAlignedBox3d | undefined;
      for (let i = 0; i < numContentData; i++) {
        const type = this.nextVarInt;
        const len = this.nextInt32;
        switch (type) {
          case NodeDataType.AABB:
            aabb = this.nextAxisAlignedBox3d;
            break;
          case NodeDataType.Transforms:
            const matrix = this.nextMatrix4d;
            transform = matrix.asTransform;
            break;
          default:
            this.advance(len);
            break;
        }
      }

      const childNodeIds: number[] = [];
      const numNodes = this.nextVarInt;
      for (let i = 0; i < numNodes; i++)
        childNodeIds.push(this.nextVarInt);

      const attributeKey = this.nextVarInt;
      const attributeName = this.nextString;
      const attributes = this.nextAttributes;

      return { transform, aabb, childNodeIds, attributeKey, attributeName, attributes };
    }
  }

  export class Header extends TileIO.Header {
    public readonly byteOrder: ByteOrder; // byte
    public readonly options: Option[] = [];
    public readonly upAxis: UpAxis; // byte
    public readonly contributors: string[] = [];
    public readonly chunks: Chunk[] = [];

    public get isValid(): boolean {
      // ###TODO Check number of chunks?
      return TileIO.Format.A3x === this.format && ByteOrder.LittleEndian === this.byteOrder && UpAxis.Z === this.upAxis;
    }

    public constructor(stream: StreamReader) {
      super(stream);
      stream.rewind(4); // ###TODO base class expect 4-byte version following magic number.

      this.byteOrder = stream.nextUint8;

      const majorVersion = stream.nextUint8;
      const minorVersion = stream.nextUint8;
      this.version = (majorVersion << 0x10) | minorVersion;

      const numOptions = stream.nextVarInt;
      for (let i = 0; i < numOptions; i++)
        this.options.push(stream.nextOption);

      stream.advance(16); // created/modified - skip because 64-BIT INTEGERS OH NO!

      this.upAxis = stream.nextUint8;

      const numContributors = stream.nextVarInt;
      for (let i = 0; i < numContributors; i++)
        this.contributors.push(stream.nextString);

      const numChunks = stream.nextVarInt;
      for (let i = 0; i < numChunks; i++) {
        const type = stream.nextVarInt;
        const length = stream.nextInt32;
        const offset = stream.curPos;
        stream.advance(length);
        this.chunks.push({ type, length, offset });
      }
    }
  }

  export class Reader {
    private readonly _stream: StreamReader;
    public readonly header: Header;
    public readonly model: Model = { sceneGraph: [], instances: [], attributes: [] };
    public readonly textures = new Map<number, Texture>();
    public readonly buffers = new Map<number, Uint8Array>();
    public readonly strings = new Map<number, string>();
    public readonly materials = new Map<number, Material>();
    public readonly instances = new Map<number, Instance>();
    public readonly nodes = new Map<number, Node>();
    public readonly meshes = new Map<number, Mesh>();

    private constructor(header: Header, stream: StreamReader) {
      this._stream = stream;
      this.header = header;
      for (const chunk of this.header.chunks) {
        const reader = new StreamReader(this._stream.readBytes(chunk.offset, chunk.length));
        switch (chunk.type) {
          case ChunkType.Model:
            reader.readModel(this.model);
            break;
          case ChunkType.ContentList: {
            this.readContentList(reader);
            break;
          }
        }
      }
    }

    public static create(bytes: Uint8Array): Reader | undefined {
      const stream = new StreamReader(bytes);
      const header = new Header(stream);
      return header.isValid ? new Reader(header, stream) : undefined;
    }

    private readContentList(reader: StreamReader): void {
      const contentType = reader.nextVarInt;
      switch (contentType) {
        case ContentType.Texture:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.textures.set(uid, stream.nextTexture));
          break;
        case ContentType.Buffer:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.buffers.set(uid, stream.nextBuffer));
          break;
        case ContentType.String:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.strings.set(uid, stream.nextString));
          break;
        case ContentType.Material:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.materials.set(uid, stream.nextMaterial));
          break;
        case ContentType.Instance:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.instances.set(uid, stream.nextInstance));
          break;
        case ContentType.Node:
          Reader.readContentList(reader, (header, stream) => this.nodes.set(header.uid, stream.readNode(header.numContentData)));
          break;
        case ContentType.Mesh:
          Reader.readContentListWithNoContentData(reader, (uid, stream) => this.meshes.set(uid, stream.nextMesh));
          break;
      }
    }

    private static readContentListWithNoContentData(stream: StreamReader, func: (uid: number, stream: StreamReader) => void): void {
      const count = stream.nextVarInt;
      for (let i = 0; i < count; i++) {
        const header = stream.nextContentHeader;
        this.skipContentData(header, stream);
        func(header.uid, stream);
      }
    }

    private static skipContentData(header: ContentHeader, stream: StreamReader): void {
      for (let i = 0; i < header.numContentData; i++) {
        stream.nextVarInt; // type
        const len = stream.nextInt32;
        stream.advance(len);
      }
    }

    private static readContentList(stream: StreamReader, func: (header: ContentHeader, stream: StreamReader) => void): void {
      const count = stream.nextVarInt;
      for (let i = 0; i < count; i++)
        func(stream.nextContentHeader, stream);
    }
  }
}

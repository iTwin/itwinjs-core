/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  assert, ByteStream, compareBooleans, compareNumbers, compareStrings, Dictionary, JsonUtils, Logger, utf8ToString,
} from "@itwin/core-bentley";
import {
  Angle, IndexedPolyface, Matrix3d, Point2d, Point3d, Point4d, Polyface, Range2d, Range3d, Transform, Vector3d,
} from "@itwin/core-geometry";
import {
  AxisAlignedBox3d, BatchType, ColorDef, ElementAlignedBox3d, Feature, FeatureIndex, FeatureIndexType, FeatureTable, FillFlags, GlbHeader, ImageSource, LinePixels, MeshEdge,
  MeshEdges, MeshPolyline, MeshPolylineList, OctEncodedNormal, PackedFeatureTable, QParams2d, QParams3d, QPoint2dList,
  QPoint3dList, Quantization, RenderMaterial, RenderMode, RenderTexture, TextureMapping, TextureTransparency, TileFormat, TileReadStatus, ViewFlagOverrides,
} from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { PickableGraphicOptions } from "../render/GraphicBuilder";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { RealityMeshParams } from "../render/RealityMeshParams";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { Triangle } from "../render/primitives/Primitives";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { RealityTileGeometry, TileContent } from "./internal";
import type { DracoLoader, DracoMesh } from "@loaders.gl/draco";
import { CreateRenderMaterialArgs } from "../render/CreateRenderMaterialArgs";
import { DisplayParams } from "../common/render/primitives/DisplayParams";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import { getImageSourceFormatForMimeType, imageBitmapFromImageSource, imageElementFromImageSource, tryImageElementFromUrl } from "../common/ImageUtil";
import { MeshPrimitiveType } from "../common/render/primitives/MeshPrimitive";
import { PointCloudArgs } from "../render/primitives/PointCloudPrimitive";
import { TextureImageSource } from "../common/render/TextureParams";
import {
  DracoMeshCompression, getGltfNodeMeshIds, Gltf2Node, GltfAccessor, GltfBuffer, GltfBufferViewProps, GltfDataType, GltfDictionary, gltfDictionaryIterator, GltfDocument, GltfId,
  GltfImage, GltfMaterial, GltfMesh, GltfMeshMode, GltfMeshPrimitive, GltfNode, GltfSampler, GltfScene, GltfTechniqueState, GltfTexture, GltfWrapMode, isGltf1Material, traverseGltfNodes,
} from "../common/gltf/GltfSchema";

/* eslint-disable no-restricted-syntax */

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
class GltfBufferView {
  public readonly data: Uint8Array;
  public readonly count: number;
  public readonly type: GltfDataType;
  public readonly accessor: GltfAccessor;
  public readonly stride: number;

  public get byteLength(): number { return this.data.length; }

  public constructor(data: Uint8Array, count: number, type: GltfDataType, accessor: GltfAccessor, stride: number) {
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

/** The result of [[GltfReader.read]].
 * @internal
 */
export interface GltfReaderResult extends TileContent {
  readStatus: TileReadStatus;
  range?: AxisAlignedBox3d;
}

/** Data required for creating a [[GltfReader]] capable of deserializing [glTF](https://www.khronos.org/gltf/).
 * @internal
 */
export class GltfReaderProps {
  public readonly version: number;
  public readonly glTF: GltfDocument;
  public readonly yAxisUp: boolean;
  public readonly binaryData?: Uint8Array;
  public readonly baseUrl?: URL;

  private constructor(glTF: GltfDocument, version: number, yAxisUp: boolean, binaryData: Uint8Array | undefined, baseUrl?: URL | undefined) {
    this.version = version;
    this.glTF = glTF;
    this.binaryData = binaryData;
    this.yAxisUp = yAxisUp;
    this.baseUrl = baseUrl;
  }

  /** Attempt to construct a new GltfReaderProps from the binary data beginning at the supplied stream's current read position. */
  public static create(source: Uint8Array | GltfDocument, yAxisUp: boolean = false, baseUrl?: URL): GltfReaderProps | undefined {
    let version: number;
    let json: GltfDocument;
    let binaryData: Uint8Array | undefined;

    if (source instanceof Uint8Array) {
      // It may be JSON - check for magic indicating glb.
      const buffer = ByteStream.fromUint8Array(source);
      if (TileFormat.Gltf !== buffer.readUint32()) {
        try {
          const utf8Json = utf8ToString(source);
          if (!utf8Json)
            return undefined;

          json = JSON.parse(utf8Json);
          version = 2;
        } catch (_) {
          return undefined;
        }
      } else {
        buffer.reset();
        const header = new GlbHeader(buffer);
        if (!header.isValid)
          return undefined;

        version = header.version;
        if (header.binaryChunk)
          binaryData = new Uint8Array(source.buffer, source.byteOffset + header.binaryChunk.offset, header.binaryChunk.length);

        try {
          const jsonBytes = new Uint8Array(source.buffer, source.byteOffset + header.jsonChunk.offset, header.jsonChunk.length);
          const jsonStr = utf8ToString(jsonBytes);
          if (undefined === jsonStr)
            return undefined;

          json = JSON.parse(jsonStr);
        } catch (_) {
          return undefined;
        }
      }
    } else {
      version = 2; // ###TODO verify against source.asset?.version
      json = source;
    }

    // asset is required in glTF 2, optional in glTF 1
    const asset = JsonUtils.asObject(json.asset);
    if (version === 2 && !asset)
      return undefined;

    const glTF: GltfDocument = {
      asset,
      scene: JsonUtils.asString(json.scene),
      extensions: JsonUtils.asObject(json.extensions),
      extensionsUsed: JsonUtils.asArray(json.extensionsUsed),
      extensionsRequired: JsonUtils.asArray(json.extensionsRequired),
      accessors: JsonUtils.asObject(json.accessors),
      buffers: JsonUtils.asObject(json.buffers),
      bufferViews: JsonUtils.asObject(json.bufferViews),
      images: JsonUtils.asObject(json.images),
      materials: JsonUtils.asObject(json.materials),
      meshes: JsonUtils.asObject(json.meshes),
      nodes: JsonUtils.asObject(json.nodes),
      samplers: JsonUtils.asObject(json.samplers),
      scenes: JsonUtils.asObject(json.scenes),
      textures: JsonUtils.asObject(json.textures),
      techniques: JsonUtils.asObject(json.techniques),
    };

    return glTF.meshes ? new GltfReaderProps(glTF, version, yAxisUp, binaryData, baseUrl) : undefined;
  }
}

/** The GltfMeshData contains the raw GLTF mesh data. If the data is suitable to create a [[RealityMesh]] directly, basically in the quantized format produced by
  * ContextCapture, then a RealityMesh is created directly from this data. Otherwise, the mesh primitive is populated from the raw data and a MeshPrimitive
  * is generated. The MeshPrimitve path is much less efficient but should be rarely used.
  *
  * @internal
  */
export class GltfMeshData {
  public primitive: Mesh;       // Populated with vertex and indices only if the mesh cannot be represented as [[RealityMesh]]
  public pointQParams?: QParams3d;
  public points?: Uint16Array;
  public pointRange?: Range3d;
  public normals?: Uint16Array;
  public uvQParams?: QParams2d;
  public uvs?: Uint16Array;
  public uvRange?: Range2d;
  public indices?: Uint8Array | Uint16Array | Uint32Array;
  public readonly type = "mesh" as const;

  public constructor(props: Mesh) {
    this.primitive = props;
  }
}

interface GltfPointCloud extends PointCloudArgs {
  readonly type: "pointcloud";
  pointRange: Range3d;
}

type GltfPrimitiveData = GltfMeshData | GltfPointCloud;

/** A function that returns true if deserialization of the data supplied by the reader should abort.
 * @internal
 */
export type ShouldAbortReadGltf = (reader: GltfReader) => boolean;

const emptyDict = { };

function colorFromJson(values: number[]): ColorDef {
  return ColorDef.from(values[0] * 255, values[1] * 255, values[2] * 255, (1.0 - values[3]) * 255);
}

function colorFromMaterial(material: GltfMaterial, isTransparent: boolean): ColorDef {
  let color = ColorDef.white;
  if (isGltf1Material(material)) {
    if (material.values?.color && Array.isArray(material.values.color))
      color = colorFromJson(material.values.color);
  } else if (material.extensions?.KHR_techniques_webgl?.values?.u_color) {
    color = colorFromJson(material.extensions.KHR_techniques_webgl.values.u_color);
  } else if (material.pbrMetallicRoughness?.baseColorFactor) {
    color = colorFromJson(material.pbrMetallicRoughness.baseColorFactor);
  }

  // SPEC: Opaque materials ignore any alpha channel.
  if (!isTransparent)
    color = color.withTransparency(0);

  return color;
}

function trsMatrix(translation: [number, number, number] | undefined, rotation: [number, number, number, number] | undefined, scale: [number, number, number] | undefined, result?: Transform): Transform {
  // SPEC: To compose the local transformation matrix, TRS properties MUST be converted to matrices and postmultiplied in the T * R * S order;
  // first the scale is applied to the vertices, then the rotation, and then the translation.
  const scaleTf = Transform.createRefs(undefined, scale ? Matrix3d.createScale(scale[0], scale[1], scale[2]) : Matrix3d.identity);
  const rotTf = Transform.createRefs(undefined, rotation ? Matrix3d.createFromQuaternion(Point4d.create(rotation[0], rotation[1], rotation[2], rotation[3])) : Matrix3d.identity);
  rotTf.matrix.transposeInPlace(); // See comment on Matrix3d.createFromQuaternion
  const transTf = Transform.createTranslation(translation ? new Point3d(translation[0], translation[1], translation[2]) : Point3d.createZero());
  const tf = scaleTf.multiplyTransformTransform(rotTf, result);
  transTf.multiplyTransformTransform(tf, tf);
  return tf;
}

class TransformStack {
  private readonly _stack: Array<Transform | undefined> = [];

  public constructor(transform?: Transform) {
    if (transform)
      this._stack.push(transform);
  }

  public get transform(): Transform | undefined {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : undefined;
  }

  public get isEmpty(): boolean {
    return 0 === this._stack.length;
  }

  public push(node: GltfNode): void {
    let nodeTransform;
    if (node.matrix) {
      const origin = Point3d.create(node.matrix[12], node.matrix[13], node.matrix[14]);
      const matrix = Matrix3d.createRowValues(
        node.matrix[0], node.matrix[4], node.matrix[8],
        node.matrix[1], node.matrix[5], node.matrix[9],
        node.matrix[2], node.matrix[6], node.matrix[10],
      );

      nodeTransform = Transform.createOriginAndMatrix(origin, matrix);
    } else if (node.rotation || node.scale || node.translation) {
      nodeTransform = trsMatrix(node.translation, node.rotation, node.scale);
    }

    const top = this.transform;
    if (!top)
      this._stack.push(nodeTransform);
    else
      this._stack.push(nodeTransform ? top.multiplyTransformTransform(nodeTransform) : top);
  }

  public pop(): void {
    assert(this._stack.length > 0);
    this._stack.pop();
  }
}

/** Arguments to [[GltfReader]] constructor.
 * @internal
 */
export interface GltfReaderArgs {
  /** Properties of the glTF source. */
  props: GltfReaderProps;
  /** The iModel with which the graphics are to be associated. */
  iModel: IModelConnection;
  /** If true, create 2d graphics. */
  is2d?: boolean;
  /** The render system that will produce the graphics. Defaults to [[IModelApp.renderSystem]]. */
  system?: RenderSystem;
  /** The type of batch to create. Defaults to [BatchType.Primary]($common).
   * @see [[RenderSystem.createBatch]].
   */
  type?: BatchType;
  /** An optional function that, if supplied, is invoked periodically to determine if the process of producing graphics from the glTF should terminate early. */
  shouldAbort?: ShouldAbortReadGltf;
  /** If true, each vertex in the graphics should belong to exactly one triangle. This is less efficient than sharing vertices between adjoining triangles, but
   * sometimes required - for example, for [ViewFlags.wiremesh]($common).
   */
  deduplicateVertices?: boolean;
  /** If true, the graphics produced will always use a [[VertexTable]]; otherwise, where possible a [[RealityMeshParams]] will be used instead.
   * Reality meshes are simpler but do not support some features like lighting.
   */
  vertexTableRequired?: boolean;
}

interface TextureKey {
  readonly id: GltfId;
  readonly isTransparent: boolean;
}

function compareTextureKeys(lhs: TextureKey, rhs: TextureKey): number {
  const cmp = compareBooleans(lhs.isTransparent, rhs.isTransparent);
  if (0 !== cmp)
    return cmp;

  assert(typeof lhs.id === typeof rhs.id);
  if ("string" === typeof lhs.id) {
    assert("string" === typeof rhs.id);
    return compareStrings(lhs.id, rhs.id);
  }

  assert("number" === typeof lhs.id && "number" === typeof rhs.id);
  return compareNumbers(lhs.id, rhs.id);
}

/** Deserializes [glTF](https://www.khronos.org/gltf/).
 * @internal
 */
export abstract class GltfReader {
  protected readonly _glTF: GltfDocument;
  protected readonly _version: number;
  protected readonly _iModel: IModelConnection;
  protected readonly _is3d: boolean;
  protected readonly _system: RenderSystem;
  protected readonly _returnToCenter?: Point3d;
  protected readonly _yAxisUp: boolean;
  protected readonly _baseUrl?: URL;
  protected readonly _type: BatchType;
  protected readonly _deduplicateVertices: boolean;
  protected readonly _vertexTableRequired: boolean;
  private readonly _canceled?: ShouldAbortReadGltf;
  protected readonly _sceneNodes: GltfId[];
  protected _computedContentRange?: ElementAlignedBox3d;
  private readonly _resolvedTextures = new Dictionary<TextureKey, RenderTexture | false>((lhs, rhs) => compareTextureKeys(lhs, rhs));
  private readonly _dracoMeshes = new Map<DracoMeshCompression, DracoMesh>();
  private _containsPointCloud = false;

  protected get _nodes(): GltfDictionary<GltfNode> { return this._glTF.nodes ?? emptyDict; }
  protected get _meshes(): GltfDictionary<GltfMesh> { return this._glTF.meshes ?? emptyDict; }
  protected get _accessors(): GltfDictionary<GltfAccessor> { return this._glTF.accessors ?? emptyDict; }
  protected get _bufferViews(): GltfDictionary<GltfBufferViewProps> { return this._glTF.bufferViews ?? emptyDict; }
  protected get _materials(): GltfDictionary<GltfMaterial> { return this._glTF.materials ?? emptyDict; }
  protected get _samplers(): GltfDictionary<GltfSampler> { return this._glTF.samplers ?? emptyDict; }
  protected get _textures(): GltfDictionary<GltfTexture> { return this._glTF.textures ?? emptyDict; }

  protected get _images(): GltfDictionary<GltfImage & { resolvedImage?: TextureImageSource }> { return this._glTF.images ?? emptyDict; }
  protected get _buffers(): GltfDictionary<GltfBuffer & { resolvedBuffer?: Uint8Array }> { return this._glTF.buffers ?? emptyDict; }

  /** Asynchronously deserialize the tile data and return the result. */
  public abstract read(): Promise<GltfReaderResult>;

  protected get _isCanceled(): boolean { return undefined !== this._canceled && this._canceled(this); }
  protected get _isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this._type; }

  /** Traverse the nodes specified by their Ids, recursing into their child nodes.
   * @param nodeIds The Ids of the nodes to traverse.
   * @throws Error if a node appears more than once during traversal
   */
  public traverseNodes(nodeIds: Iterable<GltfId>): Iterable<GltfNode> {
    return traverseGltfNodes(nodeIds, this._nodes, new Set<GltfId>());
  }

  /** Traverse the nodes specified by their scene, recursing into their child nodes.
   * @throws Error if a node appears more than once during traversal
   */
  public traverseScene(): Iterable<GltfNode> {
    return this.traverseNodes(this._sceneNodes);
  }

  protected get viewFlagOverrides(): ViewFlagOverrides | undefined {
    return undefined;
  }

  private getTileTransform(transformToRoot?: Transform, pseudoRtcBias?: Vector3d): Transform | undefined {
    let transform;

    if (this._returnToCenter || pseudoRtcBias || this._yAxisUp || transformToRoot) {
      if (this._returnToCenter)
        transform = Transform.createTranslation(this._returnToCenter.clone());
      else if (pseudoRtcBias)
        transform = Transform.createTranslationXYZ(pseudoRtcBias.x, pseudoRtcBias.y, pseudoRtcBias.z);
      else
        transform = Transform.createIdentity();

      if (this._yAxisUp)
        transform = transform.multiplyTransformMatrix3d(Matrix3d.createRotationAroundVector(Vector3d.create(1.0, 0.0, 0.0), Angle.createRadians(Angle.piOver2Radians)) as Matrix3d);

      if (transformToRoot)
        transform = transformToRoot.multiplyTransformTransform(transform);
    }

    return transform;
  }

  protected readGltfAndCreateGraphics(isLeaf: boolean, featureTable: FeatureTable | undefined, contentRange: ElementAlignedBox3d | undefined, transformToRoot?: Transform, pseudoRtcBias?: Vector3d, instances?: InstancedGraphicParams): GltfReaderResult {
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf };

    // If contentRange was not supplied, we will compute it as we read the meshes.
    if (!contentRange)
      this._computedContentRange = contentRange = Range3d.createNull();
    else
      this._computedContentRange = undefined;

    // ###TODO this looks like a hack? Why does it assume the first node's transform is special, or that the transform will be specified as a matrix instead of translation+rot+scale?
    if (this._returnToCenter || this._nodes[0]?.matrix || (pseudoRtcBias && pseudoRtcBias.magnitude() < 1.0E5))
      pseudoRtcBias = undefined;

    const transformStack = new TransformStack();
    const renderGraphicList: RenderGraphic[] = [];
    let readStatus: TileReadStatus = TileReadStatus.InvalidTileData;
    for (const nodeKey of this._sceneNodes) {
      assert(transformStack.isEmpty);
      const node = this._nodes[nodeKey];
      if (node && TileReadStatus.Success !== (readStatus = this.readNodeAndCreateGraphics(renderGraphicList, node, featureTable, transformStack, instances, pseudoRtcBias)))
        return { readStatus, isLeaf };
    }

    if (0 === renderGraphicList.length)
      return { readStatus: TileReadStatus.InvalidTileData, isLeaf };

    let renderGraphic: RenderGraphic | undefined;
    if (1 === renderGraphicList.length)
      renderGraphic = renderGraphicList[0];
    else
      renderGraphic = this._system.createGraphicList(renderGraphicList);

    const transform = this.getTileTransform(transformToRoot, pseudoRtcBias);

    // Compute range in tileset/world space.
    let range = contentRange;
    const invTransform = transform?.inverse();
    if (invTransform)
      range = invTransform.multiplyRange(contentRange);

    // The batch range needs to be in tile coordinate space.
    // If we computed the content range ourselves, it's already in tile space.
    // If the content range was supplied by the caller, it's in tileset space and needs to be transformed to tile space.
    if (featureTable)
      renderGraphic = this._system.createBatch(renderGraphic, PackedFeatureTable.pack(featureTable), this._computedContentRange ? contentRange : range);

    const viewFlagOverrides = this.viewFlagOverrides;
    if (transform || viewFlagOverrides) {
      const branch = new GraphicBranch(true);
      if (viewFlagOverrides)
        branch.setViewFlagOverrides(viewFlagOverrides);

      branch.add(renderGraphic);
      renderGraphic = this._system.createBranch(branch, transform ?? Transform.createIdentity());
    }

    return {
      readStatus,
      isLeaf,
      contentRange,
      range,
      graphic: renderGraphic,
      containsPointCloud: this._containsPointCloud,
    };
  }

  public readGltfAndCreateGeometry(transformToRoot?: Transform, needNormals = false, needParams = false): RealityTileGeometry {
    const transformStack = new TransformStack(this.getTileTransform(transformToRoot));
    const polyfaces: Polyface[] = [];
    for (const nodeKey of this._sceneNodes) {
      const node = this._nodes[nodeKey];
      if (node)
        this.readNodeAndCreatePolyfaces(polyfaces, node, transformStack, needNormals, needParams);
    }

    return { polyfaces };
  }

  private graphicFromMeshData(gltfMesh: GltfPrimitiveData, instances?: InstancedGraphicParams): RenderGraphic | undefined {
    if ("pointcloud" === gltfMesh.type)
      return this._system.createPointCloud(gltfMesh, this._iModel);

    if (!gltfMesh.points || !gltfMesh.pointRange)
      return gltfMesh.primitive.getGraphics(this._system, instances);

    const realityMeshPrimitive = (this._vertexTableRequired || instances) ? undefined : RealityMeshParams.fromGltfMesh(gltfMesh);
    if (realityMeshPrimitive) {
      const realityMesh = this._system.createRealityMesh(realityMeshPrimitive);
      if (realityMesh)
        return realityMesh;
    }

    const mesh = gltfMesh.primitive;
    const pointCount = gltfMesh.points.length / 3;
    assert(mesh.points instanceof QPoint3dList);
    mesh.points.fromTypedArray(gltfMesh.pointRange, gltfMesh.points);
    if (mesh.triangles && gltfMesh.indices)
      mesh.triangles.addFromTypedArray(gltfMesh.indices);

    if (gltfMesh.uvs && gltfMesh.uvRange && gltfMesh.uvQParams) {
      /** This is ugly and inefficient... unnecessary if Mesh stored uvs as QPoint2dList */
      for (let i = 0, j = 0; i < pointCount; i++)
        mesh.uvParams.push(gltfMesh.uvQParams.unquantize(gltfMesh.uvs[j++], gltfMesh.uvs[j++]));
    }

    if (gltfMesh.normals)
      for (const normal of gltfMesh.normals)
        mesh.normals.push(new OctEncodedNormal(normal));

    return mesh.getGraphics(this._system, instances);
  }

  private readInstanceAttributes(node: Gltf2Node, featureTable: FeatureTable | undefined): InstancedGraphicParams | undefined {
    const ext = node.extensions?.EXT_mesh_gpu_instancing;
    if (!ext || !ext.attributes) {
      return undefined;
    }

    const translationsView = this.getBufferView(ext.attributes, "TRANSLATION");
    const translations = translationsView?.toBufferData(GltfDataType.Float);
    const rotations = this.getBufferView(ext.attributes, "ROTATION")?.toBufferData(GltfDataType.Float);
    const scales = this.getBufferView(ext.attributes, "SCALE")?.toBufferData(GltfDataType.Float);

    // All attributes must specify the same count, count must be greater than zero, and at least one attribute must be specified.
    const count = translations?.count ?? rotations?.count ?? scales?.count;
    if (!count || (rotations && rotations.count !== count) || (scales && scales.count !== count)) {
      return undefined;
    }

    const transformCenter = new Point3d();
    const trMin = translationsView?.accessor.min;
    const trMax = translationsView?.accessor.max;
    if (trMin && trMax) {
      const half = (idx: number): number => trMin[idx] + (trMax[idx] - trMin[idx]) / 2;
      transformCenter.set(half(0), half(1), half(2));
    }

    const getTranslation = (index: number): [number, number, number] | undefined => {
      if (!translations) {
        return undefined;
      }

      index *= 3;
      return [
        translations.buffer[index + 0] - transformCenter.x,
        translations.buffer[index + 1] - transformCenter.y,
        translations.buffer[index + 2] - transformCenter.z,
      ];
    };

    const getRotation = (index: number): [number, number, number, number] | undefined => {
      index *= 4;
      return rotations ? [rotations.buffer[index], rotations.buffer[index + 1], rotations.buffer[index + 2], rotations.buffer[index + 3]] : undefined;
    };

    const getScale = (index: number): [number, number, number] | undefined => {
      index *= 3;
      return scales ? [scales.buffer[index], scales.buffer[index + 1], scales.buffer[index + 2]] : undefined;
    };

    const transforms = new Float32Array(3 * 4 * count);
    const transform = Transform.createIdentity();
    for (let i = 0; i < count; i++) {
      const tf = trsMatrix(getTranslation(i), getRotation(i), getScale(i), transform);
      const idx = i * 3 * 4;
      transforms[idx + 0] = tf.matrix.coffs[0];
      transforms[idx + 1] = tf.matrix.coffs[1];
      transforms[idx + 2] = tf.matrix.coffs[2];
      transforms[idx + 3] = tf.origin.x;
      transforms[idx + 4] = tf.matrix.coffs[3];
      transforms[idx + 5] = tf.matrix.coffs[4];
      transforms[idx + 6] = tf.matrix.coffs[5];
      transforms[idx + 7] = tf.origin.y;
      transforms[idx + 8] = tf.matrix.coffs[6];
      transforms[idx + 9] = tf.matrix.coffs[7];
      transforms[idx + 10] = tf.matrix.coffs[8];
      transforms[idx + 11] = tf.origin.z;
    }

    // ###TODO? The extension currently provides no way of specifying per-instance feature Ids.
    // For now, assume that if the feature table contains exactly one feature, all the instances belong to that feature.
    const featureIds = featureTable && featureTable.isUniform ? new Uint8Array(3 * count) : undefined;
    return { count, transforms, transformCenter, featureIds };
  }

  private readNodeAndCreateGraphics(renderGraphicList: RenderGraphic[], node: GltfNode, featureTable: FeatureTable | undefined, transformStack: TransformStack, batchInstances?: InstancedGraphicParams, pseudoRtcBias?: Vector3d): TileReadStatus {
    if (undefined === node)
      return TileReadStatus.InvalidTileData;

    // IMPORTANT: Do not return without popping this node from the stack.
    transformStack.push(node);
    const thisTransform = transformStack.transform;

    const nodeInstances = !batchInstances && undefined !== node.mesh ? this.readInstanceAttributes(node, featureTable) : undefined;

    /**
     * This is a workaround for tiles generated by
     * context capture which have a large offset from the tileset origin that exceeds the
     * capacity of 32 bit integers. It is essentially an ad hoc RTC applied at read time only if the tile is far from the
     * origin and there is no RTC supplied either with the B3DM of the GLTF.
     * as the vertices are supplied in a quantized format, applying the RTC bias to
     * quantization origin will make these tiles work correctly.
     */
    let thisBias;
    if (undefined !== pseudoRtcBias)
      thisBias = (undefined === thisTransform) ? pseudoRtcBias : thisTransform.matrix.multiplyInverse(pseudoRtcBias);

    for (const meshKey of getGltfNodeMeshIds(node)) {
      const nodeMesh = this._meshes[meshKey];
      if (nodeMesh?.primitives) {
        const meshes = this.readMeshPrimitives(node, featureTable, thisTransform, thisBias, nodeInstances);

        let renderGraphic: RenderGraphic | undefined;
        if (0 !== meshes.length) {
          if (1 === meshes.length) {
            renderGraphic = this.graphicFromMeshData(meshes[0], batchInstances ?? nodeInstances);
          } else {
            const thisList: RenderGraphic[] = [];
            for (const mesh of meshes) {
              renderGraphic = this.graphicFromMeshData(mesh, batchInstances ?? nodeInstances);
              if (undefined !== renderGraphic)
                thisList.push(renderGraphic);
            }

            if (0 !== thisList.length)
              renderGraphic = this._system.createGraphicList(thisList);
          }

          if (renderGraphic) {
            if (thisTransform && !thisTransform.isIdentity) {
              const branch = new GraphicBranch(true);
              branch.add(renderGraphic);
              renderGraphic = this._system.createBranch(branch, thisTransform);
            }

            renderGraphicList.push(renderGraphic);
          }
        }
      }
    }

    if (node.children) {
      for (const childId of node.children) {
        const child = this._nodes[childId];
        if (child)
          this.readNodeAndCreateGraphics(renderGraphicList, child, featureTable, transformStack, batchInstances ?? nodeInstances);
      }
    }

    transformStack.pop();
    return TileReadStatus.Success;
  }

  private readNodeAndCreatePolyfaces(polyfaces: Polyface[], node: GltfNode, transformStack: TransformStack, needNormals: boolean, needParams: boolean): void {
    // IMPORTANT: Do not return without popping this node from the stack.
    transformStack.push(node);
    const meshes = this.readMeshPrimitives(node);

    for (const mesh of meshes) {
      if (mesh.type === "mesh") {
        const polyface = this.polyfaceFromGltfMesh(mesh, transformStack.transform, needNormals, needParams);
        if (polyface)
          polyfaces.push(polyface);
      }
    }

    if (node.children) {
      for (const childId of node.children) {
        const child = this._nodes[childId];
        if (child)
          this.readNodeAndCreatePolyfaces(polyfaces, child, transformStack, needNormals, needParams);
      }
    }
  }

  private polyfaceFromGltfMesh(mesh: GltfMeshData, transform: Transform | undefined , needNormals: boolean, needParams: boolean): Polyface | undefined {
    if (!mesh.pointQParams || !mesh.points || !mesh.indices)
      return undefined;

    const { points, pointQParams, normals, uvs, uvQParams, indices } = mesh;

    const includeNormals = needNormals && undefined !== normals;
    const includeParams = needParams && undefined !== uvQParams && undefined !== uvs;

    const polyface = IndexedPolyface.create(includeNormals, includeParams);
    for (let i = 0; i < points.length; ) {
      const point = pointQParams.unquantize(points[i++], points[i++], points[i++]);
      if (transform)
        transform.multiplyPoint3d(point, point);

      polyface.addPoint(point);
    }

    if (includeNormals && normals)
      for (let i = 0; i < normals.length; )
        polyface.addNormal(OctEncodedNormal.decodeValue(normals[i++]));

    if (includeParams && uvs && uvQParams)
      for (let i = 0; i < uvs.length; )
        polyface.addParam(uvQParams.unquantize(uvs[i++], uvs[i++]));

    let j = 0;
    for (const index of indices) {
      polyface.addPointIndex(index);
      if (includeNormals)
        polyface.addNormalIndex(index);

      if (includeParams)
        polyface.addParamIndex(index);

      if (0 === (++j % 3))
        polyface.terminateFacet();
    }

    return polyface;
  }

  // ###TODO what is the actual type of `json`?
  public getBufferView(json: { [k: string]: any }, accessorName: string): GltfBufferView | undefined {
    try {
      const accessorValue = JsonUtils.asString(json[accessorName]);
      const accessor = accessorValue ? this._accessors[accessorValue] : undefined;
      if (!accessor)
        return undefined;

      const bufferViewAccessorValue = accessor.bufferView;
      const bufferView = undefined !== bufferViewAccessorValue ? this._bufferViews[bufferViewAccessorValue] : undefined;
      if (!bufferView || undefined === bufferView.buffer)
        return undefined;

      const buffer = this._buffers[bufferView.buffer];
      const bufferData = buffer?.resolvedBuffer;
      if (!bufferData)
        return undefined;

      const type = accessor.componentType as GltfDataType;
      let dataSize = 0;
      switch (type) {
        case GltfDataType.UnsignedByte:
          dataSize = 1;
          break;
        case GltfDataType.UnsignedShort:
          dataSize = 2;
          break;
        case GltfDataType.UInt32:
        case GltfDataType.Float:
          dataSize = 4;
          break;
        default:
          return undefined;
      }
      let componentCount = 1;
      switch (accessor.type) {
        case "VEC4":
          componentCount = 4;
          break;
        case "VEC3":
          componentCount = 3;
          break;
        case "VEC2":
          componentCount = 2;
          break;
      }

      const byteStride = bufferView.byteStride ? bufferView.byteStride : componentCount * dataSize;
      const offset = ((bufferView && bufferView.byteOffset) ? bufferView.byteOffset : 0) + (accessor.byteOffset ? accessor.byteOffset : 0);
      const length = byteStride * accessor.count;

      // If the data is misaligned (Scalable mesh tile publisher) use slice to copy -- else use subarray.
      const aligned = 0 === (bufferData.byteOffset + offset) % dataSize;
      const bytes = aligned ? bufferData.subarray(offset, offset + length) : bufferData.slice(offset, offset + length);
      return new GltfBufferView(bytes, accessor.count, type, accessor, byteStride / dataSize);
    } catch (e) {
      return undefined;
    }
  }

  public readBufferData32(json: { [k: string]: any }, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UInt32); }
  public readBufferData16(json: { [k: string]: any }, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UnsignedShort); }
  public readBufferData8(json: { [k: string]: any }, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.UnsignedByte); }
  public readBufferDataFloat(json: { [k: string]: any }, accessorName: string): GltfBufferData | undefined { return this.readBufferData(json, accessorName, GltfDataType.Float); }

  protected constructor(args: GltfReaderArgs) {
    this._glTF = args.props.glTF;
    this._version = args.props.version;
    this._yAxisUp = args.props.yAxisUp;
    this._baseUrl = args.props.baseUrl;

    const rtcCenter = args.props.glTF.extensions?.CESIUM_RTC?.center;
    if (rtcCenter && 3 === rtcCenter.length)
      if (0 !== rtcCenter[0] || 0 !== rtcCenter[1] || 0 !== rtcCenter[2])
        this._returnToCenter = Point3d.fromJSON(rtcCenter);

    this._iModel = args.iModel;
    this._is3d = true !== args.is2d;
    this._system = args.system ?? IModelApp.renderSystem;
    this._type = args.type ?? BatchType.Primary;
    this._canceled = args.shouldAbort;
    this._deduplicateVertices = args.deduplicateVertices ?? false;
    this._vertexTableRequired = args.vertexTableRequired ?? false;

    const binaryData = args.props.binaryData;
    if (binaryData) {
      const buffer = this._buffers[this._version === 2 ? 0 : "binary_glTF"];
      if (buffer && undefined === buffer.uri)
        buffer.resolvedBuffer = binaryData;
    }

    // The original implementation of GltfReader would process and produce graphics for every node in glTF.nodes.
    // What it's *supposed* to do is process the nodes in glTF.scenes[glTF.scene].nodes
    // Some nodes may not be referenced by the configured scene, or only indirectly via GltfNode.children.
    // Perhaps some faulty tiles existed that didn't define their scenes properly?
    let sceneNodes;
    if (this._glTF.scenes && undefined !== this._glTF.scene)
      sceneNodes = this._glTF.scenes[this._glTF.scene]?.nodes;

    if (!sceneNodes)
      sceneNodes = Object.keys(this._nodes);

    this._sceneNodes = sceneNodes;
  }

  protected readBufferData(json: { [k: string]: any }, accessorName: string, type: GltfDataType): GltfBufferData | undefined {
    const view = this.getBufferView(json, accessorName);
    return undefined !== view ? view.toBufferData(type) : undefined;
  }

  protected readFeatureIndices(_json: any): number[] | undefined { return undefined; }

  private extractId(value: any): string | undefined {
    switch (typeof value) {
      case "string":
        return value;
      case "number":
        return value.toString();
      default:
        return undefined;
    }
  }

  private extractTextureId(material: GltfMaterial): string | undefined {
    if (typeof material !== "object")
      return undefined;

    // Bimium's shader value...almost certainly obsolete at this point.
    if (isGltf1Material(material))
      return material.diffuse ?? this.extractId(material.values?.tex);

    // KHR_techniques_webgl extension
    const techniques = this._glTF.extensions?.KHR_techniques_webgl?.techniques;
    const ext = Array.isArray(techniques) ? material.extensions?.KHR_techniques_webgl : undefined;
    if (techniques && undefined !== ext && typeof(ext.values) === "object") {
      const uniforms = typeof ext.technique === "number" ? techniques[ext.technique].uniforms : undefined;
      if (typeof uniforms === "object") {
        for (const uniformName of Object.keys(uniforms)) {
          const uniform = uniforms[uniformName];
          if (typeof uniform === "object" && uniform.type === GltfDataType.Sampler2d)
            return this.extractId((ext.values[uniformName] as any)?.index);
        }
      }
    }

    const id = this.extractId(material.pbrMetallicRoughness?.baseColorTexture?.index);
    return id ?? this.extractId(material.emissiveTexture?.index);
  }

  private extractNormalMapId(material: GltfMaterial): string | undefined {
    if (typeof material !== "object")
      return undefined;

    if (isGltf1Material(material))
      return undefined;

    return this.extractId(material.normalTexture?.index);
  }

  private isMaterialTransparent(material: GltfMaterial): boolean {
    if (isGltf1Material(material)) {
      if (this._glTF.techniques && undefined !== material.technique) {
        const technique = this._glTF.techniques[material.technique];
        if (technique?.states?.enable?.some((state: GltfTechniqueState) => state === GltfTechniqueState.Blend))
          return true;
      }

      return false;
    } else {
      // Default: OPAQUE.
      // ###TODO support MASK. For now treat as opaque.
      return "BLEND" === material.alphaMode;
    }
  }

  protected createDisplayParams(material: GltfMaterial, hasBakedLighting: boolean): DisplayParams | undefined {
    const isTransparent = this.isMaterialTransparent(material);
    const textureId = this.extractTextureId(material);
    const normalMapId = this.extractNormalMapId(material);
    let textureMapping = (undefined !== textureId || undefined !== normalMapId) ? this.findTextureMapping(textureId, isTransparent, normalMapId) : undefined;
    const color = colorFromMaterial(material, isTransparent);
    let renderMaterial: RenderMaterial | undefined;
    if (undefined !== textureMapping && undefined !== textureMapping.normalMapParams) {
      const args: CreateRenderMaterialArgs = { diffuse: { color }, specular: { color: ColorDef.white }, textureMapping };
      renderMaterial = IModelApp.renderSystem.createRenderMaterial(args);

      // DisplayParams doesn't want a separate texture mapping if the material already has one.
      textureMapping = undefined;

    }

    return new DisplayParams(DisplayParams.Type.Mesh, color, color, 1, LinePixels.Solid, FillFlags.None, renderMaterial, undefined, hasBakedLighting, textureMapping);
  }

  private readMeshPrimitives(node: GltfNode, featureTable?: FeatureTable, thisTransform?: Transform, thisBias?: Vector3d, instances?: InstancedGraphicParams): GltfPrimitiveData[] {
    const meshes: GltfPrimitiveData[] = [];
    for (const meshKey of getGltfNodeMeshIds(node)) {
      const nodeMesh = this._meshes[meshKey];
      if (nodeMesh?.primitives) {
        for (const primitive of nodeMesh.primitives) {
          const mesh = this.readMeshPrimitive(primitive, featureTable, thisBias);
          if (mesh) {
            meshes.push(mesh);
            if (this._computedContentRange && mesh.pointRange) {
              const meshRange = thisTransform ? thisTransform .multiplyRange(mesh.pointRange) : mesh.pointRange;
              if (!instances) {
                this._computedContentRange.extendRange(meshRange);
              } else {
                const tfs = instances.transforms;
                const nodeRange = new Range3d();
                const extendTransformedRange = (i: number, x: number, y: number, z: number) => {
                  nodeRange.extendXYZ(tfs[i + 3] + tfs[i + 0] * x + tfs[i + 1] * y + tfs[i + 2] * z,
                    tfs[i + 7] + tfs[i + 4] * x + tfs[i + 5] * y + tfs[i + 6] * z,
                    tfs[i + 11] + tfs[i + 8] * x + tfs[i + 9] * y + tfs[i + 10] * z);
                };

                for (let i = 0; i < tfs.length; i += 3 * 4) {
                  extendTransformedRange(i, meshRange.low.x, meshRange.low.y, meshRange.low.z);
                  extendTransformedRange(i, meshRange.low.x, meshRange.low.y, meshRange.high.z);
                  extendTransformedRange(i, meshRange.low.x, meshRange.high.y, meshRange.low.z);
                  extendTransformedRange(i, meshRange.low.x, meshRange.high.y, meshRange.high.z);
                  extendTransformedRange(i, meshRange.high.x, meshRange.low.y, meshRange.low.z);
                  extendTransformedRange(i, meshRange.high.x, meshRange.low.y, meshRange.high.z);
                  extendTransformedRange(i, meshRange.high.x, meshRange.high.y, meshRange.low.z);
                  extendTransformedRange(i, meshRange.high.x, meshRange.high.y, meshRange.high.z);
                }

                nodeRange.low.addInPlace(instances.transformCenter);
                nodeRange.high.addInPlace(instances.transformCenter);

                this._computedContentRange.extendRange(nodeRange);
              }
            }
          }
        }
      }
    }

    return meshes;
  }

  protected readMeshPrimitive(primitive: GltfMeshPrimitive, featureTable?: FeatureTable, pseudoRtcBias?: Vector3d): GltfPrimitiveData | undefined {
    const meshMode = JsonUtils.asInt(primitive.mode, GltfMeshMode.Triangles);
    if (meshMode === GltfMeshMode.Points /* && !this._vertexTableRequired */) {
      const pointCloud = this.readPointCloud(primitive, undefined !== featureTable);
      if (pointCloud)
        return pointCloud;
    }

    const materialName = JsonUtils.asString(primitive.material);
    const material = 0 < materialName.length ? this._materials[materialName] : { };
    if (!material)
      return undefined;

    const hasBakedLighting = undefined === primitive.attributes.NORMAL || undefined !== material.extensions?.KHR_materials_unlit;
    const displayParams = material ? this.createDisplayParams(material, hasBakedLighting) : undefined;
    if (!displayParams)
      return undefined;

    let primitiveType: number = -1;
    switch (meshMode) {
      case GltfMeshMode.Lines:
        primitiveType = MeshPrimitiveType.Polyline;
        break;

      case GltfMeshMode.Points:
        primitiveType = MeshPrimitiveType.Point;
        break;

      case GltfMeshMode.Triangles:
        primitiveType = MeshPrimitiveType.Mesh;
        break;

      default:
        return undefined;
    }

    const isVolumeClassifier = this._isVolumeClassifier;
    const meshPrimitive = Mesh.create({
      displayParams,
      features: featureTable,
      type: primitiveType,
      range: Range3d.createNull(),
      is2d: !this._is3d,
      isPlanar: false,
      hasBakedLighting,
      isVolumeClassifier,
      quantizePositions: true,
    });

    const mesh = new GltfMeshData(meshPrimitive);

    // ###TODO_GLTF: There can be more than one color attribute; COLOR_0 might not be the one we want.
    if (!this.readColors(mesh, primitive.attributes, "COLOR_0")) {
      // We don't have real colormap - just load material color.  This will be used if non-Bentley
      // tile or fit the color table is uniform. For a non-Bentley, non-Uniform, we'll set the
      // uv parameters to pick the colors out of the color map texture.
      meshPrimitive.colorMap.insert(displayParams.fillColor.tbgr);   // White...
      // _COLORINDEX is an ancient holdover from glTF 1.0 and Bimium...unlikely to actually encounter it in the wild.
      const colorIndices = this.readBufferData16(primitive.attributes, "_COLORINDEX");
      if (undefined !== colorIndices && material) {
        let texStep;
        if (isGltf1Material(material))
          texStep = material.values?.texStep;
        else
          texStep = material.extensions?.KHR_techniques_webgl?.values?.u_texStep;

        if (texStep) {
          const uvParams = [];
          for (let i = 0; i < colorIndices.count; i++)
            uvParams.push(new Point2d(texStep[1] + texStep[0] * colorIndices.buffer[i], .5));

          const paramList = QPoint2dList.fromPoints(uvParams);
          mesh.uvs = paramList.toTypedArray();
          mesh.uvQParams = paramList.params;
        }
      }
    }

    const draco = primitive.extensions?.KHR_draco_mesh_compression;
    if (draco)
      return this.readDracoMeshPrimitive(mesh.primitive, draco) ? mesh : undefined;

    this.readBatchTable(mesh.primitive, primitive);
    if (mesh.primitive.features) {
      const features = this.readPrimitiveFeatures(primitive);
      if (features) {
        if (features instanceof Feature)
          mesh.primitive.features.add(features, 1);
        else
          mesh.primitive.features.setIndices(features);
      }
    }

    if (!this.readVertices(mesh, primitive, pseudoRtcBias))
      return undefined;

    switch (primitiveType) {
      case MeshPrimitiveType.Mesh: {
        if (!this.readMeshIndices(mesh, primitive))
          return undefined;

        if (!displayParams.ignoreLighting && !this.readNormals(mesh, primitive.attributes, "NORMAL"))
          return undefined;

        if (!mesh.uvs) {
          let texCoordIndex = 0;
          if (!isGltf1Material(material) && undefined !== material.pbrMetallicRoughness?.baseColorTexture?.texCoord)
            texCoordIndex = JsonUtils.asInt(material.pbrMetallicRoughness.baseColorTexture.texCoord);

          this.readUVParams(mesh, primitive.attributes, `TEXCOORD_${texCoordIndex}`);
        }

        if (this._deduplicateVertices && !this.deduplicateVertices(mesh))
          return undefined;

        break;
      }

      case MeshPrimitiveType.Polyline:
      case MeshPrimitiveType.Point: {
        if (undefined !== mesh.primitive.polylines && !this.readPolylines(mesh.primitive.polylines, primitive, "indices", MeshPrimitiveType.Point === primitiveType))
          return undefined;
        break;
      }
      default: {
        assert(false, "unhandled primitive type");
        return undefined;
      }
    }

    if (displayParams.textureMapping && !mesh.uvs)
      return undefined;

    if (primitive.extensions?.CESIUM_primitive_outline) {
      const data = this.readBufferData32(primitive.extensions.CESIUM_primitive_outline, "indices");
      if (data !== undefined) {
        assert(0 === data.count % 2);
        mesh.primitive.edges = new MeshEdges();
        for (let i = 0; i < data.count;)
          mesh.primitive.edges.visible.push(new MeshEdge(data.buffer[i++], data.buffer[i++]));
      }
    }

    return mesh;
  }

  private readPointCloud(primitive: GltfMeshPrimitive, hasFeatures: boolean): GltfPointCloud | undefined {
    const posView = this.getBufferView(primitive.attributes, "POSITION");
    if (!posView || GltfDataType.Float !== posView.type)
      return undefined;

    const posData = posView.toBufferData(GltfDataType.Float);
    if (!(posData?.buffer instanceof Float32Array))
      return undefined;

    const colorView = this.getBufferView(primitive.attributes, "COLOR_0");
    if (!colorView || GltfDataType.UnsignedByte !== colorView.type)
      return undefined;

    const colorData = colorView.toBufferData(GltfDataType.UnsignedByte);
    if (!(colorData?.buffer instanceof Uint8Array))
      return undefined;

    const strideSkip = posView.stride - 3;
    const pointRange = new Range3d();
    for (let i = 0; i < posData.buffer.length; i+= strideSkip)
      pointRange.extendXYZ(posData.buffer[i++], posData.buffer[i++], posData.buffer[i++]);

    let colors = colorData.buffer;
    if ("VEC4" === colorView.accessor.type) {
      // ###TODO support transparent point clouds
      colors = new Uint8Array(colorData.count * 3);
      for (let i = 0; i < colorData.count; i++) {
        const srcIdx = colorView.stride * i;
        const dstIdx = 3 * i;
        for (let j = 0; j < 3; j++)
          colors[dstIdx + j] = colorData.buffer[srcIdx + j];
      }
    }

    const features = new FeatureIndex();
    if (hasFeatures)
      features.type = FeatureIndexType.Uniform;

    this._containsPointCloud = true;
    return {
      type: "pointcloud",
      positions: posData.buffer,
      qparams: QParams3d.fromOriginAndScale(new Point3d(0, 0, 0), new Point3d(1, 1, 1)),
      pointRange,
      colors,
      colorFormat: "rgb",
      features,
      // ###TODO: If tile does not use additive refinement, compute voxelSize based on point range.
      // Additive refinement is typical of the glTF point clouds we receive from Orbit.
      voxelSize: 0,
    };
  }

  private readDracoMeshPrimitive(mesh: Mesh, ext: DracoMeshCompression): boolean {
    const draco = this._dracoMeshes.get(ext);
    if (!draco || "triangle-list" !== draco.topology)
      return false;

    const indices = draco.indices?.value;
    if (!indices || (indices.length % 3) !== 0)
      return false;

    const pos = draco.attributes.POSITION?.value;
    if (!pos || (pos.length % 3) !== 0)
      return false;

    // ###TODO: I have yet to see a draco-encoded mesh with interleaved attributes. Currently not checking.
    const triangle = new Triangle();
    for (let i = 0; i < indices.length; i += 3) {
      triangle.setIndices(indices[i], indices[i + 1], indices[i + 2]);
      mesh.addTriangle(triangle);
    }

    let posRange: Range3d;
    const bbox = draco.header?.boundingBox;
    if (bbox) {
      posRange = Range3d.createXYZXYZ(bbox[0][0], bbox[0][1], bbox[0][2], bbox[1][0], bbox[1][1], bbox[1][2]);
    } else {
      posRange = Range3d.createNull();
      for (let i = 0; i < pos.length; i += 3)
        posRange.extendXYZ(pos[i], pos[i + 1], pos[i + 2]);
    }

    assert(mesh.points instanceof QPoint3dList);
    mesh.points.params.setFromRange(posRange);
    const pt = Point3d.createZero();
    for (let i = 0; i < pos.length; i += 3) {
      pt.set(pos[i], pos[i + 1], pos[i + 2]);
      mesh.points.add(pt);
    }

    const normals = draco.attributes.NORMAL?.value;
    if (normals && (normals.length % 3) === 0) {
      const vec = Vector3d.createZero();
      for (let i = 0; i < normals.length; i += 3) {
        vec.set(normals[i], normals[i + 1], normals[i + 2]);
        mesh.normals.push(OctEncodedNormal.fromVector(vec));
      }
    }

    const uvs = draco.attributes.TEXCOORD_0?.value;
    if (uvs && (uvs.length % 2) === 0)
      for (let i = 0; i < uvs.length; i += 2)
        mesh.uvParams.push(new Point2d(uvs[i], uvs[i + 1]));

    const batchIds = draco.attributes._BATCHID?.value;
    if (batchIds && mesh.features) {
      const featureIndices = [];
      for (const batchId of batchIds)
        featureIndices.push(batchId);

      mesh.features.setIndices(featureIndices);
    }

    return true;
  }

  private deduplicateVertices(mesh: GltfMeshData): boolean {
    if (!mesh.points || !mesh.indices)
      return false;

    const numPoints = mesh.indices.length;
    assert(0 === numPoints % 3);

    const indices = mesh.indices;
    if (indices instanceof Uint16Array && numPoints > 0xffff)
      mesh.indices = new Uint32Array(numPoints);
    else if (indices instanceof Uint8Array && numPoints > 0xff)
      mesh.indices = new Uint32Array(numPoints);

    const points = new Uint16Array(3 * numPoints);
    const normals = mesh.normals ? new Uint16Array(numPoints) : undefined;
    const uvs = mesh.uvs ? new Uint16Array(2 * numPoints) : undefined;

    for (let i = 0; i < numPoints; i++) {
      const index = indices[i];
      mesh.indices[i] = i;

      points[i * 3 + 0] = mesh.points[index * 3 + 0];
      points[i * 3 + 1] = mesh.points[index * 3 + 1];
      points[i * 3 + 2] = mesh.points[index * 3 + 2];

      if (normals)
        normals[i] = mesh.normals![index];

      if (uvs) {
        uvs[i * 2 + 0] = mesh.uvs![index * 2 + 0];
        uvs[i * 2 + 1] = mesh.uvs![index * 2 + 1];
      }
    }

    mesh.points = points;
    mesh.normals = normals;
    mesh.uvs = uvs;

    return true;
  }

  /**
   *
   * @param positions quantized points
   * @param primitive input json
   * @param pseudoRtcBias a bias applied to each point - this is a workaround for tiles generated by
   * context capture which have a large offset from the tileset origin that exceeds the
   * capacity of 32 bit integers. This is essentially an ad hoc RTC applied at read time.
   */
  private readVertices(mesh: GltfMeshData, primitive: GltfMeshPrimitive, pseudoRtcBias?: Vector3d): boolean {
    const view = this.getBufferView(primitive.attributes, "POSITION");
    if (undefined === view)
      return false;

    if (GltfDataType.Float === view.type) {
      const buffer = view.toBufferData(GltfDataType.Float);
      if (undefined === buffer)
        return false;

      const strideSkip = view.stride - 3;
      mesh.pointRange = Range3d.createNull();
      for (let i = 0; i < buffer.buffer.length; i += strideSkip)
        mesh.pointRange.extendXYZ(buffer.buffer[i++], buffer.buffer[i++], buffer.buffer[i++]);

      const positions = new QPoint3dList(QParams3d.fromRange(mesh.pointRange));
      const scratchPoint = new Point3d();
      for (let i = 0, j = 0; i < buffer.count; i++, j += strideSkip) {
        scratchPoint.set(buffer.buffer[j++], buffer.buffer[j++], buffer.buffer[j++]);
        if (undefined !== pseudoRtcBias)
          scratchPoint.subtractInPlace(pseudoRtcBias);

        positions.add(scratchPoint);
      }
      mesh.pointQParams = positions.params;
      mesh.points = positions.toTypedArray();
    } else {
      if (GltfDataType.UnsignedShort !== view.type)
        return false;

      const quantized = view.accessor.extensions?.WEB3D_quantized_attributes;
      const rangeMin = quantized?.decodedMin;
      const rangeMax = quantized?.decodedMax;
      if (!rangeMin || !rangeMax) // required by spec...
        return false;

      // ###TODO apply WEB3D_quantized_attributes.decodeMatrix? Have not encountered in the wild; glTF 1.0 only.
      const buffer = view.toBufferData(GltfDataType.UnsignedShort);
      if (undefined === buffer || !(buffer.buffer instanceof Uint16Array))
        return false;

      assert(buffer.buffer instanceof Uint16Array);
      mesh.pointRange = Range3d.createXYZXYZ(rangeMin[0], rangeMin[1], rangeMin[2], rangeMax[0], rangeMax[1], rangeMax[2]);
      if (undefined !== pseudoRtcBias) {
        mesh.pointRange.low.subtractInPlace(pseudoRtcBias);
        mesh.pointRange.high.subtractInPlace(pseudoRtcBias);
      }
      mesh.pointQParams = QParams3d.fromRange(mesh.pointRange);
      if (3 === view.stride) {
        mesh.points = buffer.buffer;
      } else {
        mesh.points = new Uint16Array(3 * view.count);
        for (let i = 0, j = 0; i < view.count; i++) {
          const index = i * view.stride;
          mesh.points[j++] = buffer.buffer[index];
          mesh.points[j++] = buffer.buffer[index + 1];
          mesh.points[j++] = buffer.buffer[index + 2];
        }
      }
    }

    return true;
  }

  protected readIndices(json: { [k: string]: any }, accessorName: string): number[] | undefined {
    const data = this.readBufferData32(json, accessorName);
    if (undefined === data)
      return undefined;

    const indices = [];
    for (let i = 0; i < data.count; i++)
      indices.push(data.buffer[i]);

    return indices;
  }

  protected readBatchTable(_mesh: Mesh, _json: GltfMeshPrimitive) {
  }

  protected readPrimitiveFeatures(_primitive: GltfMeshPrimitive): Feature | number[] | undefined {
    return undefined;
  }

  protected readMeshIndices(mesh: GltfMeshData, json: { [k: string]: any }): boolean {
    if (undefined !== json.indices) {
      const data = this.readBufferData16(json, "indices") || this.readBufferData32(json, "indices");
      if (data && (data.buffer instanceof Uint8Array || data.buffer instanceof Uint16Array || data.buffer instanceof Uint32Array)) {
        mesh.indices = data.buffer;
        return true;
      }

      return false;
    }

    // Non-indexed geometry. Manufacture triangle indices from points.
    const numPoints = mesh.points?.length;
    if (undefined === numPoints || 0 !== numPoints % 3)
      return false;

    mesh.indices = numPoints < 255 ? new Uint8Array(numPoints) : (numPoints < 0xffff ? new Uint16Array(numPoints) : new Uint32Array(numPoints));
    for (let i = 0; i < numPoints; i++)
      mesh.indices[i] = i;

    return true;
  }

  protected readNormals(mesh: GltfMeshData, json: { [k: string]: any }, accessorName: string): boolean {
    const view = this.getBufferView(json, accessorName);
    if (undefined === view)
      return false;

    switch (view.type) {
      case GltfDataType.Float: {
        const data = view.toBufferData(GltfDataType.Float);
        if (undefined === data)
          return false;

        mesh.normals = new Uint16Array(data.count);
        const scratchNormal = new Vector3d();
        const strideSkip = view.stride - 3;
        for (let i = 0, j = 0; i < data.count; i++, j += strideSkip) {
          scratchNormal.set(data.buffer[j++], data.buffer[j++], data.buffer[j++]);
          mesh.normals[i] = OctEncodedNormal.encode(scratchNormal);
        }
        return true;
      }

      case GltfDataType.UnsignedByte: {
        const data = view.toBufferData(GltfDataType.UnsignedByte);
        if (undefined === data)
          return false;

        // ###TODO: we shouldn't have to allocate OctEncodedNormal objects...just use uint16s / numbers...
        mesh.normals = new Uint16Array(data.count);
        for (let i = 0; i < data.count; i++) {
          // ###TODO? not clear why ray writes these as pairs of uint8...
          const index = i * view.stride;
          const normal = data.buffer[index] | (data.buffer[index + 1] << 8);
          mesh.normals[i] = normal;
        }
        return true;
      }
      default:
        return false;
    }
  }

  protected readColors(mesh: GltfMeshData, attribute: { [k: string]: any }, accessorName: string): boolean {
    const view = this.getBufferView(attribute, accessorName);
    if (!view || (GltfDataType.Float !== view.type && GltfDataType.UnsignedByte !== view.type && GltfDataType.SignedByte !== view.type))
      return false;

    const data = view.toBufferData(view.type);
    if (!data)
      return false;

    const hasAlpha = "VEC4" === view.accessor.type;
    const factor = view.type === GltfDataType.Float ? 255 : 1;
    const rgbt = new Uint8Array(4);
    const color = new Uint32Array(rgbt.buffer);
    for (let i = 0; i < data.count; i++) {
      const index = view.stride * i;
      rgbt[0] = data.buffer[index] * factor;
      rgbt[1] = data.buffer[index + 1] * factor;
      rgbt[2] = data.buffer[index + 2] * factor;
      rgbt[3] = hasAlpha ? (255 - data.buffer[index + 3] * factor) : 0;
      mesh.primitive.colors.push(mesh.primitive.colorMap.insert(color[0]));
    }

    return true;
  }

  private readUVParams(mesh: GltfMeshData, json: { [k: string]: any }, accessorName: string): boolean {
    const view = this.getBufferView(json, accessorName);

    if (view === undefined)
      return false;

    switch (view.type) {
      case GltfDataType.Float: {
        const data = this.readBufferDataFloat(json, accessorName);
        if (!data)
          return false;

        mesh.uvRange = Range2d.createNull();

        for (let i = 0; i < data.count; i++) {
          const index = view.stride * i; // 2 float per param...
          mesh.uvRange.extendXY(data.buffer[index], data.buffer[index + 1]);
        }
        mesh.uvQParams = QParams2d.fromRange(mesh.uvRange);
        mesh.uvs = new Uint16Array(data.count * 2);
        for (let i = 0, j = 0; i < data.count; i++) {
          const index = view.stride * i; // 2 float per param...
          mesh.uvs[j++] = Quantization.quantize(data.buffer[index], mesh.uvQParams.origin.x, mesh.uvQParams.scale.x);
          mesh.uvs[j++] = Quantization.quantize(data.buffer[index + 1], mesh.uvQParams.origin.y, mesh.uvQParams.scale.y);
        }
        return true;
      }

      case GltfDataType.UnsignedShort: {
        const quantized = view.accessor.extensions?.WEB3D_quantized_attributes;
        const rangeMin = quantized?.decodedMin;
        const rangeMax = quantized?.decodedMax;
        if (undefined === rangeMin || undefined === rangeMax)
          return false;

        const qData = view.toBufferData(GltfDataType.UnsignedShort);
        if (undefined === qData || !(qData.buffer instanceof Uint16Array))
          return false;

        mesh.uvRange = Range2d.createXYXY(rangeMin[0], rangeMin[1], rangeMax[0], rangeMax[1]);
        mesh.uvQParams = QParams2d.fromRange(mesh.uvRange);
        if (2 === view.stride) {
          mesh.uvs = qData.buffer;
        } else {
          mesh.uvs = new Uint16Array(2 * view.count);
          for (let i = 0, j = 0; i < view.count; i++) {
            const index = i * view.stride;
            mesh.uvs[j++] = qData.buffer[index];
            mesh.uvs[j++] = qData.buffer[index + 1];
          }
        }
        return true;
      }
      default:
        assert(false);
        return false;

    }

    return true;
  }

  protected readPolylines(polylines: MeshPolylineList, json: { [k: string]: any }, accessorName: string, disjoint: boolean): boolean {
    const data = this.readBufferData32(json, accessorName);
    if (undefined === data)
      return false;

    const indices = new Array<number>();
    if (disjoint) {
      for (let i = 0; i < data.count;)
        indices.push(data.buffer[i++]);
    } else {
      for (let i = 0; i < data.count;) {
        const index0 = data.buffer[i++];
        const index1 = data.buffer[i++];
        if (0 === indices.length || index0 !== indices[indices.length - 1]) {
          if (indices.length !== 0) {
            polylines.push(new MeshPolyline(indices));
            indices.length = 0;
          }
          indices.push(index0);
        }
        indices.push(index1);
      }
    }
    if (indices.length !== 0)
      polylines.push(new MeshPolyline(indices));

    return true;
  }

  protected async resolveResources(): Promise<void> {
    // Load any external images and buffers.
    await this._resolveResources();

    // If any meshes are draco-compressed, dynamically load the decoder module and then decode the meshes.
    const dracoMeshes: DracoMeshCompression[] = [];

    for (const node of this.traverseScene()) {
      for (const meshId of getGltfNodeMeshIds(node)) {
        const mesh = this._meshes[meshId];
        if (mesh?.primitives)
          for (const primitive of mesh.primitives)
            if (primitive.extensions?.KHR_draco_mesh_compression)
              dracoMeshes.push(primitive.extensions.KHR_draco_mesh_compression);
      }
    }

    if (dracoMeshes.length === 0)
      return;

    try {
      const dracoLoader = (await import("@loaders.gl/draco")).DracoLoader;
      await Promise.all(dracoMeshes.map(async (x) => this.decodeDracoMesh(x, dracoLoader)));
    } catch (err) {
      Logger.logWarning(FrontendLoggerCategory.Render, "Failed to decode draco-encoded glTF mesh");
      Logger.logException(FrontendLoggerCategory.Render, err);
    }
  }

  private async _resolveResources(): Promise<void> {
    // ###TODO traverse the scene nodes to find resources referenced by them, instead of resolving everything - some resources may not
    // be required for the scene.
    const promises: Array<Promise<void>> = [];
    try {
      for (const buffer of gltfDictionaryIterator(this._buffers))
        if (!buffer.resolvedBuffer)
          promises.push(this.resolveBuffer(buffer));

      await Promise.all(promises);
      if (this._isCanceled)
        return;

      promises.length = 0;
      for (const image of gltfDictionaryIterator(this._images))
        if (!image.resolvedImage)
          promises.push(this.resolveImage(image));

      await Promise.all(promises);
    } catch (_) {
    }
  }

  private async decodeDracoMesh(ext: DracoMeshCompression, loader: typeof DracoLoader): Promise<void> {
    const bv = this._bufferViews[ext.bufferView];
    if (!bv || !bv.byteLength)
      return;

    let buf = this._buffers[bv.buffer]?.resolvedBuffer;
    if (!buf)
      return;

    const offset = bv.byteOffset ?? 0;
    buf = buf.subarray(offset, offset + bv.byteLength);
    const mesh = await loader.parse(buf, { }); // NB: `options` argument declared optional but will produce exception if not supplied.
    if (mesh)
      this._dracoMeshes.set(ext, mesh);
  }

  private resolveUrl(uri: string): string | undefined {
    try {
      const resolved = new URL(uri, this._baseUrl);
      resolved.search = this._baseUrl?.search ?? "";
      return resolved.toString();
    } catch (_) {
      return undefined;
    }
  }

  private async resolveBuffer(buffer: GltfBuffer & { resolvedBuffer?: Uint8Array }): Promise<void> {
    if (buffer.resolvedBuffer || undefined === buffer.uri)
      return;

    try {
      const url = this.resolveUrl(buffer.uri);
      const response = url ? await fetch(url) : undefined;
      if (this._isCanceled)
        return;

      const data = await response?.arrayBuffer();
      if (this._isCanceled)
        return;

      if (data)
        buffer.resolvedBuffer = new Uint8Array(data);
    } catch (_) {
      //
    }
  }

  private async resolveImage(image: GltfImage & { resolvedImage?: TextureImageSource }): Promise<void> {
    if (image.resolvedImage)
      return;

    interface BufferViewSource { bufferView?: GltfId, mimeType?: string }
    const bvSrc: BufferViewSource | undefined = undefined !== image.bufferView ? image : image.extensions?.KHR_binary_glTF;
    if (undefined !== bvSrc?.bufferView) {
      const format = undefined !== bvSrc.mimeType ? getImageSourceFormatForMimeType(bvSrc.mimeType) : undefined;
      const bufferView = this._bufferViews[bvSrc.bufferView];
      if (undefined === format || !bufferView || !bufferView.byteLength || bufferView.byteLength < 0)
        return;

      const bufferData = this._buffers[bufferView.buffer]?.resolvedBuffer;
      if (!bufferData)
        return;

      const offset = bufferView.byteOffset ?? 0;
      const bytes = bufferData.subarray(offset, offset + bufferView.byteLength);
      try {
        const imageSource = new ImageSource(bytes, format);
        if (this._system.supportsCreateImageBitmap)
          image.resolvedImage = await imageBitmapFromImageSource(imageSource);
        else
          image.resolvedImage = await imageElementFromImageSource(imageSource);
      } catch (_) {
        //
      }

      return;
    }

    const url = undefined !== image.uri ? this.resolveUrl(image.uri) : undefined;
    if (undefined !== url)
      image.resolvedImage = await tryImageElementFromUrl(url);
  }

  /** The glTF spec says that if GltfSampler.wrapS/T are omitted, they default to Repeat.
   * However, the reality data service serves tiles that lack any wrapS/T property, and we want those clamped to edge, not repeated.
   * (We also don't want to produce mip-maps for them, which is determined indirectly from the wrap mode).
   * Allow the default to be optionally overridden.
   */
  public defaultWrapMode = GltfWrapMode.Repeat;

  /** Exposed strictly for testing. */
  public getTextureType(sampler?: GltfSampler): RenderTexture.Type {
    // ###TODO: RenderTexture currently does not support different wrapping behavior for U vs V, nor does it support mirrored repeat.
    let wrapS = sampler?.wrapS;
    let wrapT = sampler?.wrapT;
    if (undefined === wrapS && undefined === wrapT)
      wrapS = wrapT = this.defaultWrapMode;

    if (GltfWrapMode.ClampToEdge === wrapS || GltfWrapMode.ClampToEdge === wrapT)
      return RenderTexture.Type.TileSection;

    return RenderTexture.Type.Normal;
  }

  private resolveTexture(textureId: string, isTransparent: boolean): RenderTexture | false {
    const texture = this._textures[textureId];
    if (!texture || undefined === texture.source)
      return false;

    const image = this._images[texture.source]?.resolvedImage;
    if (!image)
      return false;

    const samplerId = texture.sampler;
    const sampler = undefined !== samplerId ? this._samplers[samplerId] : undefined;
    const textureType = this.getTextureType(sampler);
    const renderTexture = this._system.createTexture({
      type: textureType,
      image: {
        source: image,
        transparency: isTransparent ? TextureTransparency.Mixed : TextureTransparency.Opaque,
      },
    });

    return renderTexture ?? false;
  }

  protected findTextureMapping(id: string | undefined, isTransparent: boolean, normalMapId: string | undefined): TextureMapping | undefined {
    if (undefined === id && undefined === normalMapId)
      return undefined;

    let texture;
    if (undefined !== id) {
      texture = this._resolvedTextures.get({ id, isTransparent });
      if (undefined === texture)
        this._resolvedTextures.set({ id, isTransparent }, texture = this.resolveTexture(id, isTransparent));
    }

    let normalMap;
    if (undefined !== normalMapId) {
      normalMap = this._resolvedTextures.get({ id: normalMapId, isTransparent: false });
      if (undefined === normalMap)
        this._resolvedTextures.set({ id: normalMapId, isTransparent: false }, normalMap = this.resolveTexture(normalMapId, false));
    }

    let nMap;
    if (normalMap) {
      const greenUp = true;
      if (texture) {
        nMap = {
          normalMap,
          greenUp,
        };
      } else {
        texture = normalMap;
        nMap = { greenUp };
      }
    }

    if (!texture)
      return undefined;

    const textureMapping = new TextureMapping(texture, new TextureMapping.Params());
    textureMapping.normalMapParams = nMap;
    return textureMapping;
  }
}

/** Arguments supplied to [[readGltfGraphics]] to produce a [[RenderGraphic]] from a [glTF](https://www.khronos.org/gltf/) asset.
 * @public
 * @extensions
 */
export interface ReadGltfGraphicsArgs {
  /** A representation of the glTF data as one of:
   *  - The binary data in glb format as a Uint8Array; or
   *  - A JSON object conforming to the [glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html); or
   *  - A Uint8Array containing the utf8-encoded stringified JSON of an object conforming to the [glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html).
   */
  gltf: Uint8Array | Object;
  /** The iModel with which the graphics will be associated - typically obtained from the [[Viewport]] into which they will be drawn. */
  iModel: IModelConnection;
  /** Options for making the graphic [pickable]($docs/learning/frontend/ViewDecorations#pickable-view-graphic-decorations).
   * Only the [[PickableGraphicOptions.id]] property is required to make the graphics pickable. If a `modelId` is also supplied and differs from the `id`,
   * the graphics will also be selectable.
   */
  pickableOptions?: PickableGraphicOptions;
  /** The base URL for any relative URIs in the glTF. Typically, this is the same as the URL for the glTF asset itself.
   * If not supplied, relative URIs cannot be resolved. For glTF assets containing no relative URIs, this is not required.
   */
  baseUrl?: URL | string;
  /** @alpha */
  contentRange?: ElementAlignedBox3d;
  /** @alpha */
  transform?: Transform;
  /** @alpha */
  hasChildren?: boolean;
}

/** The output of [[readGltf]].
 * @public
 */
export interface GltfGraphic {
  /** The graphic created from the glTF model. */
  graphic: RenderGraphic;
  /** The bounding box of the model, in local coordinates (y-axis up). */
  localBoundingBox: ElementAlignedBox3d;
  /** The bounding box of the model, in world coordinates (z-axis up). */
  boundingBox: AxisAlignedBox3d;
}

/** Produce a [[RenderGraphic]] from a [glTF](https://www.khronos.org/gltf/) asset suitable for use in [view decorations]($docs/learning/frontend/ViewDecorations).
 * @returns a graphic produced from the glTF asset's default scene, or `undefined` if a graphic could not be produced from the asset.
 * @note Support for the full [glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html) is currently a work in progress.
 * If a particular glTF asset fails to load and/or display properly, please
 * [submit an issue](https://github.com/iTwin/itwinjs-core/issues).
 * @see [Example decorator]($docs/learning/frontend/ViewDecorations#gltf-decorations) for an example of a decorator that reads and displays a glTF asset.
 * @see [[readGltf]] to obtain more information about the glTF model.
 * @public
 * @extensions
 */
export async function readGltfGraphics(args: ReadGltfGraphicsArgs): Promise<RenderGraphic | undefined> {
  const result = await readGltf(args);
  return result?.graphic;
}

/** Produce a [[RenderGraphic]] from a [glTF](https://www.khronos.org/gltf/) asset suitable for use in [view decorations]($docs/learning/frontend/ViewDecorations).
 * @returns a graphic produced from the glTF asset's default scene, or `undefined` if a graphic could not be produced from the asset.
 * The returned graphic also includes the bounding boxes of the glTF model in world and local coordiantes.
 * @note Support for the full [glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html) is currently a work in progress.
 * If a particular glTF asset fails to load and/or display properly, please
 * [submit an issue](https://github.com/iTwin/itwinjs-core/issues).
 * @see [Example decorator]($docs/learning/frontend/ViewDecorations#gltf-decorations) for an example of a decorator that reads and displays a glTF asset.
 * @public
 */
export async function readGltf(args: ReadGltfGraphicsArgs): Promise<GltfGraphic | undefined> {
  const baseUrl = typeof args.baseUrl === "string" ? new URL(args.baseUrl) : args.baseUrl;
  const props = GltfReaderProps.create(args.gltf, true, baseUrl); // glTF supports exactly one coordinate system with y axis up.
  const reader = props ? new GltfGraphicsReader(props, args) : undefined;
  if (!reader)
    return undefined;

  const result = await reader.read();
  if (!result.graphic)
    return undefined;

  assert(result.contentRange !== undefined, "readGltf always computes content range");
  assert(result.range !== undefined, "readGltf always computes world range");

  return {
    graphic: result.graphic,
    localBoundingBox: result.contentRange ?? Range3d.createNull(),
    boundingBox: result.range ?? Range3d.createNull(),
  };
}

/** Implements [[readGltfGraphics]]. Exported strictly for tests.
 * @internal
 */
export class GltfGraphicsReader extends GltfReader {
  private readonly _featureTable?: FeatureTable;
  private readonly _contentRange?: ElementAlignedBox3d;
  private readonly _transform?: Transform;
  private readonly _isLeaf: boolean;
  public readonly binaryData?: Uint8Array; // strictly for tests

  public constructor(props: GltfReaderProps, args: ReadGltfGraphicsArgs) {
    super({
      props,
      iModel: args.iModel,
      vertexTableRequired: true,
    });

    this._contentRange = args.contentRange;
    this._transform = args.transform;
    this._isLeaf = true !== args.hasChildren;

    this.binaryData = props.binaryData;
    const pickableId = args.pickableOptions?.id;
    if (pickableId) {
      this._featureTable = new FeatureTable(1, args.pickableOptions?.modelId ?? pickableId, BatchType.Primary);
      this._featureTable.insert(new Feature(pickableId));
    }
  }

  protected override get viewFlagOverrides(): ViewFlagOverrides {
    return {
      whiteOnWhiteReversal: false,
      renderMode: RenderMode.SmoothShade,
    };
  }

  public async read(): Promise<GltfReaderResult> {
    await this.resolveResources();
    return this.readGltfAndCreateGraphics(this._isLeaf, this._featureTable, this._contentRange, this._transform);
  }

  public get nodes(): GltfDictionary<GltfNode> { return this._nodes; }
  public get scenes(): GltfDictionary<GltfScene> { return this._glTF.scenes ?? emptyDict; }
  public get sceneNodes(): GltfId[] { return this._sceneNodes; }
  public get textures(): GltfDictionary<GltfTexture> { return this._textures; }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import { ClipVector, ClipVectorProps, Point2d, Point3d, Range2d, Range3d, Range3dProps, Transform, TransformProps, XYProps, XYZProps } from "@itwin/core-geometry";
import {
  BatchType, ColorDef, ColorDefProps, ComputeNodeId, ElementAlignedBox3d, FeatureIndexType, FeatureTableHeader, FillFlags, GltfV2ChunkTypes, GltfVersions, Gradient,
  ImageSource, ImageSourceFormat, ImdlHeader, LinePixels, PackedFeatureTable, PolylineTypeFlags, QParams2d, QParams3d, readTileContentDescription, RenderMaterial,
  RenderSchedule, RenderTexture, TextureMapping, TextureTransparency, TileFormat, TileHeader, TileReadError, TileReadStatus,
} from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { AnimationNodeId, GraphicBranch } from "../render/GraphicBranch";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { AuxChannelTable, AuxChannelTableProps } from "../render/primitives/AuxChannelTable";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { createSurfaceMaterial, isValidSurfaceType, SurfaceMaterial, SurfaceParams, SurfaceType } from "../render/primitives/SurfaceParams";
import { EdgeParams, IndexedEdgeParams, SegmentEdgeParams, SilhouetteParams } from "../render/primitives/EdgeParams";
import { MeshParams, VertexIndices, VertexTable } from "../render/primitives/VertexTable";
import { splitMeshParams, splitPointStringParams, splitPolylineParams } from "../render/primitives/VertexTableSplitter";
import { PointStringParams } from "../render/primitives/PointStringParams";
import { PolylineParams, TesselatedPolyline } from "../render/primitives/PolylineParams";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderGeometry, RenderSystem } from "../render/RenderSystem";
import { BatchOptions } from "../render/GraphicBuilder";
import { IModelTileContent } from "./internal";

/** @internal */
export type ShouldAbortImdlReader = (reader: ImdlReader) => boolean;

/* eslint-disable no-restricted-syntax */

/** @internal */
export interface ImdlReaderResult extends IModelTileContent {
  readStatus: TileReadStatus;
}

/** Header preceding "glTF" data in iMdl tile.
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

/** Convert the byte array returned by [[TileAdmin.requestElementGraphics]] into a [[RenderGraphic]].
 * @param bytes The binary graphics data obtained from `requestElementGraphics`.
 * @param iModel The iModel with which the graphics are associated.
 * @param modelId The Id of the [[GeometricModelState]] with which the graphics are associated. Can be an invalid Id.
 * @param is3d True if the graphics are 3d.
 * @param options Options customizing how [Feature]($common)s within the graphic can be resymbolized; or false if you don't want to produce a batch.
 * @public
 * @extensions
 */
export async function readElementGraphics(bytes: Uint8Array, iModel: IModelConnection, modelId: Id64String, is3d: boolean, options?: BatchOptions | false): Promise<RenderGraphic | undefined> {
  const stream = ByteStream.fromUint8Array(bytes);
  const reader = ImdlReader.create({
    stream, iModel, modelId, is3d, options,
    system: IModelApp.renderSystem,
  });

  if (!reader)
    return undefined;

  const result = await reader.read();
  return result.graphic;
}

const nodeIdRegex = /Node_(.*)/;
function extractNodeId(nodeName: string): number {
  const match = nodeName.match(nodeIdRegex);
  assert(!!match && match.length === 2);
  if (!match || match.length !== 2)
    return 0;

  const nodeId = Number.parseInt(match[1], 10);
  assert(!Number.isNaN(nodeId));
  return Number.isNaN(nodeId) ? 0 : nodeId;
}

/** Describes a [ColorDef]($common) as [r, g, b] with each component in [0..1]. */
type ImdlColorDef = number[];

/** Describes a [TextureMapping]($common). */
interface ImdlTextureMapping {
  /** Optional name, which may be the Id of a persistent [RenderTexture]($common) or some other name unique among all texture mappings within the tile. */
  name?: string;
  /** Describes the [TextureMapping.Params]($common). */
  params: {
    /** Describes a [TextureMapping.Trans2x3]($common) as a 2x3 matrix. */
    transform: number[][];
    /** @see [TextureMapping.Params.weight]($common). Default: 1.0. */
    weight?: number;
    /** Default: [TextureMapping.Mode.Parametric]($common). */
    mode?: TextureMapping.Mode;
    /** @see [TextureMapping.Params.worldMapping]($common). Default: false. */
    worldMapping?: boolean;
  };
}

/** Describes a [RenderTexture]($common) with its image embedded into the tile data. */
interface ImdlNamedTexture {
  /** If true, the image is a texture atlas containing any number of glyphs used for text. */
  isGlyph?: boolean;
  /** If true, the texture should not repeat and should not be mip-mapped. */
  isTileSection?: boolean;
  /** The Id of the [[ImdlBufferView]] containing the image data. */
  bufferView: string;
  /** The format of the image data referenced by [[bufferView]]. */
  format: ImageSourceFormat;
  /** The kind of transparency present in the texture image. Default: Mixed. */
  transparency?: TextureTransparency;
}

/** Describes a [[DisplayParams]]. */
interface ImdlDisplayParams {
  type: DisplayParams.Type;
  lineColor?: ColorDefProps;
  fillColor?: ColorDefProps;
  lineWidth?: number;
  linePixels?: LinePixels;
  fillFlags?: FillFlags;
  ignoreLighting?: boolean;
  materialId?: string;
  texture?: ImdlTextureMapping;
  gradient?: Gradient.SymbProps;
}

/** Describes a [RenderMaterial]($common). */
interface ImdlRenderMaterial {
  diffuseColor?: ImdlColorDef;
  diffuse?: number;
  specularColor?: ImdlColorDef;
  specular?: number;
  reflectColor?: ImdlColorDef;
  reflect?: number;
  specularExponent?: number;
  /** In [0..1] where 0 is fully opaque. */
  transparency?: number;
  refract?: number;
  shadows?: boolean;
  ambient?: number;
  textureMapping?: {
    texture: ImdlTextureMapping;
  };
}

/** Describes a [[SurfaceMaterialAtlas]] embedded into an [[ImdlVertexTable]]. */
interface ImdlMaterialAtlas {
  readonly numMaterials: number;
  readonly hasTranslucency?: boolean;
  readonly overridesAlpha?: boolean;
}

/** Describes a [[VertexTable]]. */
interface ImdlVertexTable {
  /** Id of the [[ImdlBufferView]] containing the binary vertex table data. */
  readonly bufferView: string;
  /** The number of vertices in the table. */
  readonly count: number;
  /** The number of RGBA values in the lookup texture allocated per vertex. */
  readonly numRgbaPerVertex: number;
  /** The number of colors in the color table embedded into the vertex table, or undefined if [[uniformColor]] is defined. */
  readonly numColors?: number;
  /** The width of the lookup texture. */
  readonly width: number;
  /** The height of the lookup texture. */
  readonly height: number;
  /** True if [[uniformColor]] has transparency or the embedded color table contains transparent colors. */
  readonly hasTranslucency: boolean;
  /** Describes the number (0, 1, or more than 1) of features contained in the vertex table. */
  readonly featureIndexType: FeatureIndexType;
  /** If [[featureIndexType]] is [FeatureIndexType.Uniform]($common), the ID of the feature associated with all vertices in the table. */
  readonly featureID?: number;
  /** If defined, the color associated with all vertices in the table. */
  readonly uniformColor?: ColorDefProps;
  /** The quantization range of the vertex positions. @see [QParams3d]($common). */
  readonly params: {
    readonly decodedMin: number[];
    readonly decodedMax: number[];
  };
  /** If the vertex table contains multiple surface materials, describes the embedded material atlas. */
  readonly materialAtlas?: ImdlMaterialAtlas;
  readonly usesUnquantizedPositions?: boolean;
}

/** Describes how to draw a single [[ImdlPrimitive]] repeatedly.
 * @see [[InstancedGraphicParams]].
 */
interface ImdlInstances {
  readonly count: number;
  readonly transformCenter: number[];
  readonly featureIds: string;
  readonly transforms: string;
  readonly symbologyOverrides?: string;
}

/** Describes a unit of geometry within an [[ImdlMesh]]. */
interface ImdlPrimitive {
  /** The Id of the associated [[ImdlDisplayParams]]. */
  readonly material?: string;
  /** A lookup table containing the primitive's vertices. */
  readonly vertices: ImdlVertexTable;
  /** If true, all the vertices lie in a single plane. */
  readonly isPlanar?: boolean;
  /** If defined, a point about which the primitive should rotate when displayed to always face the camera. */
  readonly viewIndependentOrigin?: XYZProps;
  /** If defined, describes repeated instances of the same primitive. */
  readonly instances?: ImdlInstances;
}

/** Per-vertex data used to animate and/or resymbolize a mesh.
 * @see [[AuxChannelTable]].
 */
type ImdlAuxChannelTable = Omit<AuxChannelTableProps, "data"> & { bufferView: string };

/** Describes the "hard" edges of an [[ImdlMeshPrimitive]]. These edges represent simple line segments connecting two vertices of the mesh.
 * They are always visible regardless of view orientation.
 * Each segment is represented as a quad such that it can be expanded to a desired width in pixels.
 */
interface ImdlSegmentEdges {
  /** Id of the [[ImdlBufferView]] containing - for each vertex of each quad - the 24-bit index of the vertex in the mesh's [[ImdlVertexTable]]. */
  readonly indices: string;
  /** Id of the [[ImdlBufferView]] containing - for each vertex of each quad - the 24-bit index of the segmnent's other endpoint in the mesh's [[ImdlVertexTable]],
   * along with a "quad index" in [0..3] identifying which corner of the quad the vertex represents.
   */
  readonly endPointAndQuadIndices: string;
}

/** Describes "hidden" edges of an [[ImdlMeshPrimitive]]. These edges represent simple line segments connecting two vertices of the mesh.
 * A given silhouette is visible when only one of the faces associated with the edge is facing the camera, producing view-dependent outlines for curved
 * geometry like spheres and cones.
 */
interface ImdlSilhouetteEdges extends ImdlSegmentEdges {
  /** The Id of the [[ImdlBufferView]] containing - for each vertex - a pair of [OctEncodedNormal]($common)s for the two faces associated with the edge. */
  readonly normalPairs: string;
}

/** A compact alternative representation of [[ImdlSegmentEdges]] and [[ImdlSilhouetteEdges]] consisting of a lookup table containing information about each unique
 * edge, along with indices into that table.
 * @see [[IndexedEdgeParams]].
 */
interface ImdlIndexedEdges {
  /** Id of the [[ImdlBufferView]] containing the indices - 6 per segment, forming a quad. */
  readonly indices: string;
  /** Id of the [[ImdlBufferView]] containing the lookup table binary data. */
  readonly edges: string;
  /** Width of the lookup texture. */
  readonly width: number;
  /** Height of the lookup texture. */
  readonly height: number;
  /** The number of simple segments in the lower partition of the lookup table. @see [[IndexedEdgeParams.numSegments]]. */
  readonly numSegments: number;
  /** The number of bytes inserted for alignment between the lower and upper partitions of the lookup table. @see [[IndexedEdgeParams.silhouettePadding]]. */
  readonly silhouettePadding: number;
}

/** Describes the edges of an [[ImdlMeshPrimitive]]. */
interface ImdlMeshEdges {
  /** @see [[ImdlSegmentEdges]]. */
  readonly segments?: ImdlSegmentEdges;
  /** @see [[ImdlSilhouetteEdges]]. */
  readonly silhouettes?: ImdlSilhouetteEdges;
  /** Line strings with additional joint triangles inserted to produce wide edges with rounded corners.
   * Typically only produced for 2d views.
   */
  readonly polylines?: ImdlPolyline;
  /** @see [[ImdlIndexedEdges]]. */
  readonly indexed?: ImdlIndexedEdges;
}

/** Describes a collection of line strings with additional joint triangles inserted to produce wide line strings with rounded corners.
 * @see [[TesselatedPolyline]] and [[PolylineParams]].
 */
interface ImdlPolyline {
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.indices]]. */
  readonly indices: string;
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.prevIndices]]. */
  readonly prevIndices: string;
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.nextIndicesAndParams]]. */
  readonly nextIndicesAndParams: string;
}

/** Describes a planar region in which a pattern symbol is repeated in a regular grid.
 * @see [[PatternGraphicParams]].
 */
interface ImdlAreaPattern {
  readonly type: "areaPattern";
  /** The Id of the [[ImdlAreaPatternSymbol]] containing the pattern geometry. */
  readonly symbolName: string;
  /** A [ClipVector]($core-geometry) used to clip symbols to the pattern region's boundary. */
  readonly clip: ClipVectorProps;
  /** Uniform scale applied to the pattern geometry. */
  readonly scale: number;
  /** Spacing between each instance of the pattern in meters. */
  readonly spacing: XYProps;
  readonly orgTransform: TransformProps;
  readonly origin: XYProps;
  /** Id of the [[ImdlBufferView]] containing the offset of each occurrence of the symbol in pattern-space. */
  readonly xyOffsets: string;
  readonly featureId: number;
  readonly modelTransform: TransformProps;
  readonly range: Range3dProps;
  readonly symbolTranslation: XYZProps;
  readonly viewIndependentOrigin?: XYZProps;
}

/** Describes the surface of an [[ImdlMeshPrimitive]] as a collection of triangles. */
interface ImdlSurface {
  /** The type of surface. */
  readonly type: SurfaceType;
  /** The 24-bit indices into the [[ImdlVertexTable]] of each triangle's vertex. */
  readonly indices: string;
  /** If true, the [[ImdlTextureMapping]] is applied regardless of [ViewFlags.textures]($common). */
  readonly alwaysDisplayTexture?: boolean;
  /** The quantization range for the UV coordinates. @see [QParams2d]($common). */
  readonly uvParams?: {
    readonly decodedMin: number[];
    readonly decodedMax: number[];
  };
}

/** Describes a triangle mesh, optionally including its edges. @see [[MeshParams]]. */
interface ImdlMeshPrimitive extends ImdlPrimitive {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: Mesh.PrimitiveType.Mesh;
  readonly surface: ImdlSurface;
  readonly edges?: ImdlMeshEdges;
  readonly auxChannels?: ImdlAuxChannelTable;
  readonly areaPattern?: ImdlAreaPattern;
}

/** Describes a collection of line strings. @see [[PolylineParams]]. */
interface ImdlPolylinePrimitive extends ImdlPrimitive, ImdlPolyline {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: Mesh.PrimitiveType.Polyline;
}

/** Describes a collection of individual points. @see [[PointStringParams. */
interface ImdlPointStringPrimitive extends ImdlPrimitive {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: Mesh.PrimitiveType.Point;
  /** The Id of the [[ImdlBufferView]] containing - for each point - the 24-bit index of the corresponding vertex in the [[ImdlVertexTable]]. */
  readonly indices: string;
}

type AnyImdlPrimitive = ImdlMeshPrimitive | ImdlPolylinePrimitive | ImdlPointStringPrimitive;

/** A collection of primitive geometry to be rendered. */
interface ImdlMesh {
  /** The geometry to be rendered. */
  readonly primitives?: Array<AnyImdlPrimitive | ImdlAreaPattern>;
  /** If this mesh defines a layer, the unique Id of that layer.
   * @see [[RenderSystem.createGraphicLayer]] for a description of layers.
   */
  readonly layer?: string;
}

/** A collection of primitive geometry to be rendered as the pattern symbol for an [[ImdlAreaPattern]]. */
interface ImdlAreaPatternSymbol {
  readonly primitives: AnyImdlPrimitive[];
}

/** If the tile has an associated [RenderSchedule.Script]($common), an array of Ids of nodes in the script used to group elements. */
interface ImdlAnimationNodes {
  /** The number of bytes in each integer Id provided by [[bufferView]] - either 1, 2, or 4. */
  bytesPerId: number;
  /** The Id of the [[ImdlBufferView]] containing the tightly-packed array of 1-, 2- or 4-byte unsigned integer node Ids; the number of bytes is specified by [[bytesPerId]]. */
  bufferView: string;
}

/** Describes a contiguous array of bytes within the binary portion of the tile. */
interface ImdlBufferView {
  /** The number of bytes in the array. */
  byteLength: number;
  /** The offset from the beginning of the binary portion of the tile data to the first byte in the array. */
  byteOffset: number;
}

/** A top-level dictionary of resources of a particular type contained in an [[Imdl]] tile.
 * Each resource has a unique name by which it can be referred to by other contents of the tile.
 */
interface ImdlDictionary<T> {
  [key: string]: T | undefined;
}

/** Describes all of the geometry contained in the tile. */
interface ImdlScene {
  /** The Ids of the elements of [[Imdl.nodes]] to be included in the scene. */
  nodes: string[];
}

/** Describes the top-level contents of a tile.
 * @internal
 */
export interface Imdl {
  /** The Id of the ImdlScene in [[scenes]] that describes the tile's geometry. */
  scene: string;
  /** The collection of ImdlScenes included in the tile. */
  scenes: ImdlDictionary<ImdlScene>;
  /** Specifies point to which all vertex positions in the tile are relative, as an array of 3 numbers.
   * Currently only used for requestElementGraphics - see GraphicsRequestProps.useAbsolutePositions.
   */
  rtcCenter?: number[];
  /** Maps each node Id to the Id of the corresponding mesh in [[meshes]]. */
  nodes: ImdlDictionary<string>;
  meshes: ImdlDictionary<ImdlMesh>;
  bufferViews: ImdlDictionary<ImdlBufferView>;
  materials?: ImdlDictionary<ImdlDisplayParams>;
  patternSymbols?: ImdlDictionary<ImdlAreaPatternSymbol>;
  animationNodes?: ImdlAnimationNodes;
  renderMaterials?: ImdlDictionary<ImdlRenderMaterial>;
  namedTextures?: ImdlDictionary<ImdlNamedTexture>;
}

/** Arguments supplied to [[ImdlReader.create]]
 * @internal
 */
export interface ImdlReaderCreateArgs {
  stream: ByteStream;
  iModel: IModelConnection;
  modelId: Id64String;
  is3d: boolean;
  system: RenderSystem;
  type?: BatchType; // default Primary
  loadEdges?: boolean; // default true
  isCanceled?: ShouldAbortImdlReader;
  sizeMultiplier?: number;
  options?: BatchOptions | false;
  containsTransformNodes?: boolean; // default false
  /** Supplied if the graphics in the tile are to be split up based on the nodes in the timeline. */
  timeline?: RenderSchedule.ModelTimeline;
}

type PrimitiveParams = {
  params: MeshParams;
  viOrigin?: Point3d;
  type: "mesh";
} | {
  params: PointStringParams;
  viOrigin?: Point3d;
  type: "point";
} | {
  params: PolylineParams;
  viOrigin?: Point3d;
  type: "polyline";
};

/** Deserializes tile content in iMdl format. These tiles contain element geometry encoded into a format optimized for the imodeljs webgl renderer.
 * @internal
 */
export class ImdlReader {
  private readonly _buffer: ByteStream;
  private readonly _bufferViews: ImdlDictionary<ImdlBufferView>;
  private readonly _meshes: ImdlDictionary<ImdlMesh>;
  private readonly _nodes: ImdlDictionary<string>;
  private readonly _materialValues: ImdlDictionary<ImdlDisplayParams>;
  private readonly _renderMaterials: ImdlDictionary<ImdlRenderMaterial>;
  private readonly _namedTextures: ImdlDictionary<ImdlNamedTexture & { renderTexture?: RenderTexture }>;
  private readonly _patternSymbols: { [key: string]: ImdlAreaPatternSymbol | undefined };
  private readonly _animationNodes?: ImdlAnimationNodes;
  private readonly _binaryData: Uint8Array;
  private readonly _iModel: IModelConnection;
  private readonly _is3d: boolean;
  private readonly _modelId: Id64String;
  private readonly _system: RenderSystem;
  private readonly _type: BatchType;
  private readonly _canceled?: ShouldAbortImdlReader;
  private readonly _sizeMultiplier?: number;
  private readonly _loadEdges: boolean;
  private readonly _options: BatchOptions | false;
  private readonly _patternGeometry = new Map<string, RenderGeometry[]>();
  private readonly _containsTransformNodes: boolean;
  private readonly _timeline?: RenderSchedule.ModelTimeline;
  private readonly _rtcCenter?: Point3d;

  private get _isCanceled(): boolean { return undefined !== this._canceled && this._canceled(this); }
  private get _isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this._type; }

  /** Attempt to initialize an ImdlReader to deserialize iModel tile data beginning at the stream's current position. */
  public static create(args: ImdlReaderCreateArgs): ImdlReader | undefined {
    const imdlHeader = new ImdlHeader(args.stream);
    if (!imdlHeader.isValid || !imdlHeader.isReadableVersion)
      return undefined;

    // The feature table follows the iMdl header
    if (!this.skipFeatureTable(args.stream))
      return undefined;

    // A glTF header follows the feature table
    const gltfHeader = new GltfHeader(args.stream);
    if (!gltfHeader.isValid)
      return undefined;

    args.stream.curPos = gltfHeader.scenePosition;
    const sceneStrData = args.stream.nextBytes(gltfHeader.sceneStrLength);
    const sceneStr = utf8ToString(sceneStrData);
    if (!sceneStr)
      return undefined;

    try {
      const sceneValue = JSON.parse(sceneStr);
      const imdl: Imdl = {
        scene: JsonUtils.asString(sceneValue.scene),
        scenes: JsonUtils.asArray(sceneValue.scenes),
        animationNodes: JsonUtils.asObject(sceneValue.animationNodes),
        bufferViews: JsonUtils.asObject(sceneValue.bufferViews),
        meshes: JsonUtils.asObject(sceneValue.meshes),
        nodes: JsonUtils.asObject(sceneValue.nodes),
        materials: JsonUtils.asObject(sceneValue.materials),
        renderMaterials: JsonUtils.asObject(sceneValue.renderMaterials),
        namedTextures: JsonUtils.asObject(sceneValue.namedTextures),
        patternSymbols: JsonUtils.asObject(sceneValue.patternSymbols),
        rtcCenter: JsonUtils.asArray(sceneValue.rtcCenter),
      };

      return undefined !== imdl.meshes ? new ImdlReader(imdl, gltfHeader.binaryPosition, args) : undefined;
    } catch (_) {
      return undefined;
    }
  }

  private constructor(imdl: Imdl, binaryPosition: number, args: ImdlReaderCreateArgs) {
    this._buffer = args.stream;
    this._binaryData = new Uint8Array(this._buffer.arrayBuffer, binaryPosition);

    this._animationNodes = JsonUtils.asObject(imdl.animationNodes);
    this._bufferViews = imdl.bufferViews;
    this._meshes = imdl.meshes;
    this._nodes = imdl.nodes;
    this._materialValues = imdl.materials ?? { };
    this._renderMaterials = imdl.renderMaterials ?? { };
    this._namedTextures = imdl.namedTextures ?? { };
    this._patternSymbols = imdl.patternSymbols ?? {};
    this._rtcCenter = imdl.rtcCenter ? Point3d.fromJSON(imdl.rtcCenter) : undefined;

    this._iModel = args.iModel;
    this._modelId = args.modelId;
    this._is3d = args.is3d;
    this._system = args.system;
    this._type = args.type ?? BatchType.Primary;
    this._canceled = args.isCanceled;

    this._sizeMultiplier = args.sizeMultiplier;
    this._loadEdges = args.loadEdges ?? true;
    this._options = args.options ?? {};
    this._containsTransformNodes = args.containsTransformNodes ?? false;
    this._timeline = args.timeline;
  }

  /** Attempt to deserialize the tile data */
  public async read(): Promise<ImdlReaderResult> {
    let content;
    try {
      content = readTileContentDescription(this._buffer, this._sizeMultiplier, !this._is3d, IModelApp.tileAdmin, this._isVolumeClassifier);
    } catch (e) {
      if (e instanceof TileReadError)
        return { isLeaf: true, readStatus: e.errorNumber };
      else
        throw e;
    }

    const featureTable = this.readFeatureTable(content.featureTableStartPos);
    if (undefined === featureTable)
      return { readStatus: TileReadStatus.InvalidFeatureTable, isLeaf: true };

    // Textures must be loaded asynchronously first...
    await this.loadNamedTextures();
    if (this._isCanceled)
      return { readStatus: TileReadStatus.Canceled, isLeaf: true };

    return this.finishRead(content.isLeaf, featureTable, content.contentRange, content.emptySubRangeMask, content.sizeMultiplier);
  }

  /** @internal */
  protected createDisplayParams(json: ImdlDisplayParams): DisplayParams | undefined {
    const type = JsonUtils.asInt(json.type, DisplayParams.Type.Mesh);
    const lineColor = ColorDef.create(JsonUtils.asInt(json.lineColor));
    const fillColor = ColorDef.create(JsonUtils.asInt(json.fillColor));
    const width = JsonUtils.asInt(json.lineWidth);
    const linePixels = JsonUtils.asInt(json.linePixels, LinePixels.Solid);
    const fillFlags = JsonUtils.asInt(json.fillFlags, FillFlags.None);
    const ignoreLighting = JsonUtils.asBool(json.ignoreLighting);

    // Material will always contain its own texture if it has one
    const materialKey = json.materialId;
    const material = undefined !== materialKey ? this.materialFromJson(materialKey) : undefined;

    // We will only attempt to include the texture if material is undefined
    let textureMapping;
    if (!material) {
      const textureJson = json.texture;
      textureMapping = undefined !== textureJson ? this.textureMappingFromJson(textureJson) : undefined;

      if (undefined === textureMapping) {
        // Look for a gradient. If defined, create a texture mapping. No reason to pass the Gradient.Symb to the DisplayParams once we have the texture.
        const gradientProps = json.gradient;
        const gradient = undefined !== gradientProps ? Gradient.Symb.fromJSON(gradientProps) : undefined;
        if (undefined !== gradient) {
          const texture = this._system.getGradientTexture(gradient, this._iModel);
          if (undefined !== texture) {
            // ###TODO: would be better if DisplayParams created the TextureMapping - but that requires an IModelConnection and a RenderSystem...
            textureMapping = new TextureMapping(texture, new TextureMapping.Params({ textureMat2x3: new TextureMapping.Trans2x3(0, 1, 0, 1, 0, 0) }));
          }
        }
      }
    }

    return new DisplayParams(type, lineColor, fillColor, width, linePixels, fillFlags, material, undefined, ignoreLighting, textureMapping);
  }

  /** @internal */
  protected colorDefFromMaterialJson(json: ImdlColorDef | undefined): ColorDef | undefined {
    return undefined !== json ? ColorDef.from(json[0] * 255 + 0.5, json[1] * 255 + 0.5, json[2] * 255 + 0.5) : undefined;
  }

  /** @internal */
  protected materialFromJson(key: string): RenderMaterial | undefined {
    const material = this._system.findMaterial(key, this._iModel);
    if (material)
      return material;

    if (!this._renderMaterials)
      return undefined;

    const materialJson = this._renderMaterials[key];
    if (!materialJson)
      return undefined;

    // eslint-disable-next-line deprecation/deprecation
    const materialParams = new RenderMaterial.Params(key);
    materialParams.diffuseColor = this.colorDefFromMaterialJson(materialJson.diffuseColor);
    if (materialJson.diffuse !== undefined)
      materialParams.diffuse = JsonUtils.asDouble(materialJson.diffuse);

    materialParams.specularColor = this.colorDefFromMaterialJson(materialJson.specularColor);
    if (materialJson.specular !== undefined)
      materialParams.specular = JsonUtils.asDouble(materialJson.specular);

    materialParams.reflectColor = this.colorDefFromMaterialJson(materialJson.reflectColor);
    if (materialJson.reflect !== undefined)
      materialParams.reflect = JsonUtils.asDouble(materialJson.reflect);

    if (materialJson.specularExponent !== undefined)
      materialParams.specularExponent = materialJson.specularExponent;

    if (undefined !== materialJson.transparency)
      materialParams.alpha = 1.0 - materialJson.transparency;

    materialParams.refract = JsonUtils.asDouble(materialJson.refract);
    materialParams.shadows = JsonUtils.asBool(materialJson.shadows);
    materialParams.ambient = JsonUtils.asDouble(materialJson.ambient);

    if (undefined !== materialJson.textureMapping)
      materialParams.textureMapping = this.textureMappingFromJson(materialJson.textureMapping.texture);

    // eslint-disable-next-line deprecation/deprecation
    return this._system.createMaterial(materialParams, this._iModel);
  }

  private textureMappingFromJson(json: ImdlTextureMapping | undefined): TextureMapping | undefined {
    if (undefined === json)
      return undefined;

    const name = JsonUtils.asString(json.name);
    const namedTex = 0 !== name.length ? this._namedTextures[name] : undefined;
    const texture = undefined !== namedTex ? namedTex.renderTexture : undefined;
    if (undefined === texture) {
      assert(false, "bad texture mapping json");
      return undefined;
    }

    const paramsJson = json.params;
    const tf = paramsJson.transform;
    const paramProps: TextureMapping.ParamProps = {
      textureMat2x3: new TextureMapping.Trans2x3(tf[0][0], tf[0][1], tf[0][2], tf[1][0], tf[1][1], tf[1][2]),
      textureWeight: JsonUtils.asDouble(paramsJson.weight, 1.0),
      mapMode: JsonUtils.asInt(paramsJson.mode),
      worldMapping: JsonUtils.asBool(paramsJson.worldMapping),
    };

    return new TextureMapping(texture, new TextureMapping.Params(paramProps));
  }

  private async loadNamedTextures(): Promise<void> {
    if (undefined === this._namedTextures)
      return;

    const promises = new Array<Promise<void>>();
    for (const name of Object.keys(this._namedTextures))
      promises.push(this.loadNamedTexture(name));

    if (promises.length > 0)
      await Promise.all(promises);
  }

  private async loadNamedTexture(name: string): Promise<void> {
    if (this._isCanceled)
      return;

    const namedTex = this._namedTextures[name];
    assert(undefined !== namedTex); // we got here by iterating the keys of this.namedTextures...
    if (undefined === namedTex)
      return;

    const texture = this._system.findTexture(name, this._iModel);
    if (undefined !== texture) {
      namedTex.renderTexture = texture;
      return;
    }

    namedTex.renderTexture = await this.readNamedTexture(namedTex, name);
  }

  private async readNamedTexture(namedTex: ImdlNamedTexture, name: string): Promise<RenderTexture | undefined> {
    // Reasons a texture could be embedded in the tile content instead of requested separately from the backend:
    // - external textures are disabled
    // - the texture name is not a valid Id64 string
    // - the texture is below a certain backend-hardcoded size threshold
    // The bufferViewJson being defined signifies any of the above conditions. In that case, the image content
    // has been embedded in the tile contents. Otherwise, we will attempt to request the image content separately
    // from the backend.

    let textureType = RenderTexture.Type.Normal;
    const isGlyph = JsonUtils.asBool(namedTex.isGlyph);
    const isTileSection = !isGlyph && JsonUtils.asBool(namedTex.isTileSection);
    if (isGlyph)
      textureType = RenderTexture.Type.Glyph;
    else if (isTileSection)
      textureType = RenderTexture.Type.TileSection;

    // We produce unique tile sections for very large (> 8 megapixel) textures, and unique glyph atlases for raster text.
    // Neither should be cached.
    const cacheable = !isGlyph && !isTileSection;
    const ownership = cacheable ? { iModel: this._iModel, key: name } : undefined;

    const bufferViewId = JsonUtils.asString(namedTex.bufferView);
    const bufferViewJson = 0 !== bufferViewId.length ? this._bufferViews[bufferViewId] : undefined;

    if (undefined !== bufferViewJson) { // presence of bufferViewJson signifies we should read the texture from the tile content
      const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
      const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
      if (0 === byteLength)
        return undefined;

      const texBytes = this._binaryData.subarray(byteOffset, byteOffset + byteLength);
      const format = namedTex.format;
      const source = new ImageSource(texBytes, format);
      return this._system.createTextureFromSource({ source, ownership, type: textureType, transparency: namedTex.transparency });
    }

    // bufferViewJson was undefined, so attempt to request the texture directly from the backend
    // eslint-disable-next-line deprecation/deprecation
    const params = new RenderTexture.Params(cacheable ? name : undefined, textureType);
    return this._system.createTextureFromElement(name, this._iModel, params, namedTex.format);
  }

  /** @internal */
  protected readFeatureTable(startPos: number): PackedFeatureTable | undefined {
    this._buffer.curPos = startPos;
    const header = FeatureTableHeader.readFrom(this._buffer);
    if (undefined === header || 0 !== header.length % 4)
      return undefined;

    // NB: We make a copy of the sub-array because we don't want to pin the entire data array in memory.
    const numUint32s = (header.length - FeatureTableHeader.sizeInBytes) / 4;
    const packedFeatureArray = new Uint32Array(this._buffer.nextUint32s(numUint32s));
    if (this._buffer.isPastTheEnd)
      return undefined;

    let animNodesArray: Uint8Array | Uint16Array | Uint32Array | undefined;
    const animationNodes = this._animationNodes;
    if (undefined !== animationNodes) {
      const bytesPerId = JsonUtils.asInt(animationNodes.bytesPerId);
      const bufferViewId = JsonUtils.asString(animationNodes.bufferView);
      const bufferViewJson = this._bufferViews[bufferViewId];
      if (undefined !== bufferViewJson) {
        const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
        const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
        const bytes = this._binaryData.subarray(byteOffset, byteOffset + byteLength);
        switch (bytesPerId) {
          case 1:
            animNodesArray = new Uint8Array(bytes);
            break;
          case 2:
            // NB: A *copy* of the subarray.
            animNodesArray = Uint16Array.from(new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2));
            break;
          case 4:
            // NB: A *copy* of the subarray.
            animNodesArray = Uint32Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
            break;
        }
      }
    }

    this._buffer.curPos = startPos + header.length;

    return new PackedFeatureTable(packedFeatureArray, this._modelId, header.count, header.maxFeatures, this._type, animNodesArray);
  }

  private static skipFeatureTable(stream: ByteStream): boolean {
    const startPos = stream.curPos;
    const header = FeatureTableHeader.readFrom(stream);
    if (undefined !== header)
      stream.curPos = startPos + header.length;

    return undefined !== header;
  }

  private readAreaPattern(json: ImdlAreaPattern): RenderGraphic | undefined {
    const geometry = this.getPatternGeometry(json.symbolName);
    if (!geometry || geometry.length === 0)
      return undefined;

    const xyOffsets = this.findBuffer(json.xyOffsets);
    if (!xyOffsets)
      return undefined;

    const clip = ClipVector.fromJSON(json.clip);
    const clipVolume = clip && clip.isValid ? this._system.createClipVolume(clip) : undefined;
    if (!clipVolume)
      return undefined;

    const viewIndependentOrigin = json.viewIndependentOrigin ? Point3d.fromJSON(json.viewIndependentOrigin) : undefined;
    const pattern = this._system.createAreaPattern({
      xyOffsets: new Float32Array(xyOffsets.buffer, xyOffsets.byteOffset, xyOffsets.byteLength / 4),
      featureId: json.featureId,
      orgTransform: Transform.fromJSON(json.orgTransform),
      origin: Point2d.fromJSON(json.origin),
      scale: json.scale,
      spacing: Point2d.fromJSON(json.spacing),
      patternToModel: Transform.fromJSON(json.modelTransform),
      range: Range3d.fromJSON(json.range),
      symbolTranslation: Point3d.fromJSON(json.symbolTranslation),
      viewIndependentOrigin,
    });

    if (!pattern)
      return undefined;

    const branch = new GraphicBranch(true);
    for (const geom of geometry) {
      const graphic = this._system.createRenderGraphic(geom, pattern);
      if (graphic)
        branch.add(graphic);
    }

    if (branch.isEmpty)
      return undefined;

    return this._system.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume });
  }

  private readMeshGeometry(primitive: AnyImdlPrimitive): { geometry: RenderGeometry, instances?: InstancedGraphicParams } | undefined {
    const geometry = this.readPrimitiveGeometry(primitive);
    if (!geometry)
      return undefined;

    const instances = this.readInstances(primitive);
    return { geometry, instances };
  }

  private readMeshGraphic(primitive: AnyImdlPrimitive | ImdlAreaPattern): RenderGraphic | undefined {
    if (primitive.type === "areaPattern")
      return this.readAreaPattern(primitive);

    const geom = this.readMeshGeometry(primitive);
    return geom ? this._system.createRenderGraphic(geom.geometry, geom.instances) : undefined;
  }

  private findBuffer(bufferViewId: string): Uint8Array | undefined {
    if (typeof bufferViewId !== "string" || 0 === bufferViewId.length)
      return undefined;

    const bufferViewJson = this._bufferViews[bufferViewId];
    if (undefined === bufferViewJson)
      return undefined;

    const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
    const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
    if (0 === byteLength)
      return undefined;

    return this._binaryData.subarray(byteOffset, byteOffset + byteLength);
  }

  private readVertexTable(primitive: AnyImdlPrimitive): VertexTable | undefined {
    const json = primitive.vertices;
    if (undefined === json)
      return undefined;

    const bytes = this.findBuffer(JsonUtils.asString(json.bufferView));
    if (undefined === bytes)
      return undefined;

    const uniformFeatureID = undefined !== json.featureID ? JsonUtils.asInt(json.featureID) : undefined;

    const rangeMin = JsonUtils.asArray(json.params.decodedMin);
    const rangeMax = JsonUtils.asArray(json.params.decodedMax);
    if (undefined === rangeMin || undefined === rangeMax)
      return undefined;

    const qparams = QParams3d.fromRange(Range3d.create(Point3d.create(rangeMin[0], rangeMin[1], rangeMin[2]), Point3d.create(rangeMax[0], rangeMax[1], rangeMax[2])));

    const uniformColor = undefined !== json.uniformColor ? ColorDef.fromJSON(json.uniformColor) : undefined;
    let uvParams: QParams2d | undefined;
    if (Mesh.PrimitiveType.Mesh === primitive.type && primitive.surface && primitive.surface.uvParams) {
      const uvMin = primitive.surface.uvParams.decodedMin;
      const uvMax = primitive.surface.uvParams.decodedMax;
      const uvRange = new Range2d(uvMin[0], uvMin[1], uvMax[0], uvMax[1]);
      uvParams = QParams2d.fromRange(uvRange);
    }

    return new VertexTable({
      data: bytes,
      qparams,
      width: json.width,
      height: json.height,
      hasTranslucency: json.hasTranslucency,
      uniformColor,
      featureIndexType: json.featureIndexType,
      uniformFeatureID,
      numVertices: json.count,
      numRgbaPerVertex: json.numRgbaPerVertex,
      uvParams,
      usesUnquantizedPositions: true === json.usesUnquantizedPositions,
    });
  }

  private readAuxChannelTable(primitive: ImdlMeshPrimitive): AuxChannelTable | undefined {
    const json = primitive.auxChannels;
    if (undefined === json)
      return undefined;

    const bytes = this.findBuffer(JsonUtils.asString(json.bufferView));
    if (undefined === bytes)
      return undefined;

    const props: AuxChannelTableProps = {
      data: bytes,
      width: json.width,
      height: json.height,
      count: json.count,
      numBytesPerVertex: json.numBytesPerVertex,
      displacements: json.displacements,
      normals: json.normals,
      params: json.params,
    };

    return AuxChannelTable.fromJSON(props);
  }

  private readInstances(primitive: ImdlPrimitive): InstancedGraphicParams | undefined {
    const json = primitive.instances;
    if (undefined === json)
      return undefined;

    const count = JsonUtils.asInt(json.count, 0);
    if (count <= 0)
      return undefined;

    const centerComponents = JsonUtils.asArray(json.transformCenter);
    if (undefined === centerComponents || 3 !== centerComponents.length)
      return undefined;

    const transformCenter = Point3d.create(centerComponents[0], centerComponents[1], centerComponents[2]);

    const featureIds = this.findBuffer(JsonUtils.asString(json.featureIds));
    if (undefined === featureIds)
      return undefined;

    const transformBytes = this.findBuffer(JsonUtils.asString(json.transforms));
    if (undefined === transformBytes)
      return undefined;

    // 1 transform = 3 rows of 4 floats = 12 floats per instance
    const numFloats = transformBytes.byteLength / 4;
    assert(Math.floor(numFloats) === numFloats);
    assert(0 === numFloats % 12);

    const transforms = new Float32Array(transformBytes.buffer, transformBytes.byteOffset, numFloats);

    let symbologyOverrides: Uint8Array | undefined;
    if (undefined !== json.symbologyOverrides)
      symbologyOverrides = this.findBuffer(JsonUtils.asString(json.symbologyOverrides));

    return { count, transforms, transformCenter, featureIds, symbologyOverrides };
  }

  private readVertexIndices(bufferName: string): VertexIndices | undefined {
    const bytes = this.findBuffer(bufferName);
    return undefined !== bytes ? new VertexIndices(bytes) : undefined;
  }

  private readTesselatedPolyline(json: ImdlPolyline): TesselatedPolyline | undefined {
    const indices = this.readVertexIndices(json.indices);
    const prevIndices = this.readVertexIndices(json.prevIndices);
    const nextIndicesAndParams = this.findBuffer(json.nextIndicesAndParams);

    if (!indices || !prevIndices || !nextIndicesAndParams)
      return undefined;

    return { indices, prevIndices, nextIndicesAndParams };
  }

  private readSurface(mesh: ImdlMeshPrimitive, displayParams: DisplayParams): SurfaceParams | undefined {
    const surf = mesh.surface;
    if (undefined === surf)
      return undefined;

    const indices = this.readVertexIndices(surf.indices);
    if (undefined === indices)
      return undefined;

    const type = surf.type;
    if (!isValidSurfaceType(type))
      return undefined;

    const texture = undefined !== displayParams.textureMapping ? displayParams.textureMapping.texture : undefined;
    let material: SurfaceMaterial | undefined;
    const atlas = mesh.vertices.materialAtlas;
    const numColors = mesh.vertices.numColors;
    if (undefined !== atlas && undefined !== numColors) {
      material = {
        isAtlas: true,
        hasTranslucency: JsonUtils.asBool(atlas.hasTranslucency),
        overridesAlpha: JsonUtils.asBool(atlas.overridesAlpha, false),
        vertexTableOffset: JsonUtils.asInt(numColors),
        numMaterials: JsonUtils.asInt(atlas.numMaterials),
      };
    } else {
      material = createSurfaceMaterial(displayParams.material);
    }

    const textureMapping = undefined !== texture ? { texture, alwaysDisplayed: JsonUtils.asBool(surf.alwaysDisplayTexture) } : undefined;
    return {
      type,
      indices,
      fillFlags: displayParams.fillFlags,
      hasBakedLighting: false,
      material,
      textureMapping,
    };
  }

  private readSegmentEdges(json: ImdlSegmentEdges): SegmentEdgeParams | undefined {
    const indices = this.readVertexIndices(json.indices);
    const endPointAndQuadIndices = this.findBuffer(json.endPointAndQuadIndices);
    return undefined !== indices && undefined !== endPointAndQuadIndices ? { indices, endPointAndQuadIndices } : undefined;
  }

  private readSilhouettes(json: ImdlSilhouetteEdges): SilhouetteParams | undefined {
    const segments = this.readSegmentEdges(json);
    const normalPairs = this.findBuffer(json.normalPairs);
    return undefined !== segments && undefined !== normalPairs ? { normalPairs, indices: segments.indices, endPointAndQuadIndices: segments.endPointAndQuadIndices } : undefined;
  }

  private readIndexedEdges(json: ImdlIndexedEdges): IndexedEdgeParams | undefined {
    const indices = this.readVertexIndices(json.indices);
    const edgeTable = this.findBuffer(json.edges);
    if (!indices || !edgeTable)
      return undefined;

    return {
      indices,
      edges: {
        data: edgeTable,
        width: json.width,
        height: json.height,
        silhouettePadding: json.silhouettePadding,
        numSegments: json.numSegments,
      },
    };
  }

  private readEdges(json: ImdlMeshEdges, displayParams: DisplayParams): { succeeded: boolean, params?: EdgeParams } {
    let segments: SegmentEdgeParams | undefined;
    let silhouettes: SilhouetteParams | undefined;
    let polylines: TesselatedPolyline | undefined;
    let indexed: IndexedEdgeParams | undefined;

    let succeeded = false;
    if (undefined !== json.segments && undefined === (segments = this.readSegmentEdges(json.segments)))
      return { succeeded };

    if (undefined !== json.silhouettes && undefined === (silhouettes = this.readSilhouettes(json.silhouettes)))
      return { succeeded };

    if (undefined !== json.polylines && undefined === (polylines = this.readTesselatedPolyline(json.polylines)))
      return { succeeded };

    if (undefined !== json.indexed && undefined === (indexed = this.readIndexedEdges(json.indexed)))
      return { succeeded };

    succeeded = true;
    let params: EdgeParams | undefined;
    if (segments || silhouettes || polylines || indexed) {
      params = {
        segments,
        silhouettes,
        polylines,
        indexed,
        weight: displayParams.width,
        linePixels: displayParams.linePixels,
      };
    }

    return { succeeded, params };
  }

  private readPrimitiveParams(primitive: AnyImdlPrimitive): PrimitiveParams | undefined {
    const materialName = primitive.material ?? "";
    const materialValue = 0 < materialName.length ? JsonUtils.asObject(this._materialValues[materialName]) : undefined;
    const displayParams = undefined !== materialValue ? this.createDisplayParams(materialValue) : undefined;
    if (undefined === displayParams)
      return undefined;

    const vertices = this.readVertexTable(primitive);
    if (undefined === vertices) {
      assert(false, "bad vertex table in tile data.");
      return undefined;
    }

    const viOrigin = primitive.viewIndependentOrigin ? Point3d.fromJSON(primitive.viewIndependentOrigin) : undefined;
    const isPlanar = !this._is3d || JsonUtils.asBool(primitive.isPlanar);

    switch (primitive.type) {
      case Mesh.PrimitiveType.Mesh: {
        const surface = this.readSurface(primitive, displayParams);
        if (!surface)
          return undefined;

        // ###TODO: Tile generator shouldn't bother producing edges for classification meshes in the first place...
        let edgeParams: EdgeParams | undefined;
        if (this._loadEdges && undefined !== primitive.edges && SurfaceType.VolumeClassifier !== surface.type) {
          const edgeResult = this.readEdges(primitive.edges, displayParams);
          if (!edgeResult.succeeded)
            return undefined;
          else
            edgeParams = edgeResult.params;
        }

        return {
          params: new MeshParams(vertices, surface, edgeParams, isPlanar, this.readAuxChannelTable(primitive)),
          type: "mesh",
          viOrigin,
        };
      }
      case Mesh.PrimitiveType.Polyline: {
        const polyline = this.readTesselatedPolyline(primitive);
        if (!polyline)
          return undefined;

        let flags = PolylineTypeFlags.Normal;
        if (DisplayParams.RegionEdgeType.Outline === displayParams.regionEdgeType)
          flags = (undefined === displayParams.gradient || displayParams.gradient.isOutlined) ? PolylineTypeFlags.Edge : PolylineTypeFlags.Outline;

        return {
          params: new PolylineParams(vertices, polyline, displayParams.width, displayParams.linePixels, isPlanar, flags),
          type: "polyline",
          viOrigin,
        };
      }
      case Mesh.PrimitiveType.Point: {
        const indices = this.readVertexIndices(primitive.indices);
        if (undefined === indices)
          return undefined;

        return {
          params: new PointStringParams(vertices, indices, displayParams.width),
          type: "point",
          viOrigin,
        };
      }
      default:
        assert(false, "unhandled primitive type");
        return undefined;
    }
  }

  private readPrimitiveGeometry(primitive: AnyImdlPrimitive): RenderGeometry | undefined {
    const prim = this.readPrimitiveParams(primitive);
    return prim ? this.createPrimitiveGeometry(prim) : undefined;
  }

  private createPrimitiveGeometry(prim: PrimitiveParams): RenderGeometry | undefined {
    switch (prim.type) {
      case "mesh":
        return this._system.createMeshGeometry(prim.params, prim.viOrigin);
      case "polyline":
        return this._system.createPolylineGeometry(prim.params, prim.viOrigin);
      case "point":
        return this._system.createPointStringGeometry(prim.params, prim.viOrigin);
    }
  }

  private getPatternGeometry(patternName: string): RenderGeometry[] | undefined {
    let geometry = this._patternGeometry.get(patternName);
    if (geometry)
      return geometry;

    const symbol = this._patternSymbols[patternName];
    if (!symbol)
      return undefined;

    geometry = [];
    for (const primitive of symbol.primitives) {
      const geom = this.readPrimitiveGeometry(primitive);
      if (geom)
        geometry.push(geom);
    }

    this._patternGeometry.set(patternName, geometry);
    return geometry;
  }

  private readAnimationBranches(output: RenderGraphic[], mesh: ImdlMesh, featureTable: PackedFeatureTable): void {
    const timeline = this._timeline;
    assert(undefined !== timeline);

    const primitives = mesh.primitives;
    if (!primitives)
      return;

    const branchesByNodeId = new Map<number, GraphicBranch>();
    const getBranch = (nodeId: number): GraphicBranch => {
      let branch = branchesByNodeId.get(nodeId);
      if (!branch) {
        branchesByNodeId.set(nodeId, branch = new GraphicBranch(true));
        branch.animationNodeId = nodeId;
        branch.animationId =  `${this._modelId}_Node_${nodeId}`;
      }

      return branch;
    };

    featureTable.populateAnimationNodeIds((elemIdPair) => {
      const elementTimeline = timeline.getTimelineForElement(elemIdPair.lower, elemIdPair.upper);
      return elementTimeline?.batchId ?? 0;
    }, timeline.maxBatchId);

    const discreteNodeIds = timeline.discreteBatchIds;
    const computeNodeId: ComputeNodeId = (_id, featureIndex) => {
      const nodeId = featureTable.getAnimationNodeId(featureIndex);
      return 0 !== nodeId && discreteNodeIds.has(nodeId) ? nodeId : 0;
    };

    const splitArgs = {
      maxDimension: this._system.maxTextureSize,
      computeNodeId,
      featureTable,
    };

    for (const primitive of primitives) {
      if (primitive.type === "areaPattern") {
        // ###TODO animated area patterns.
        const gf = this.readAreaPattern(primitive);
        if (gf)
          getBranch(AnimationNodeId.Untransformed).add(gf);
      } else {
        const prim = this.readPrimitiveParams(primitive);
        if (!prim)
          continue;

        const viOrigin = prim.viOrigin;
        switch (prim.type) {
          case "mesh": {
            const split = splitMeshParams({ ...splitArgs, params: prim.params });
            for (const [nodeId, params] of split) {
              const geometry = this.createPrimitiveGeometry({ params, viOrigin, type: "mesh" });
              const instances = undefined; // ###TODO support splitting instances (currently animation tile trees do not permit instancing).
              const graphic = geometry ? this._system.createRenderGraphic(geometry, instances) : undefined;
              if (graphic)
                getBranch(nodeId).add(graphic);
            }

            break;
          }
          case "point": {
            const split = splitPointStringParams({ ...splitArgs, params: prim.params });
            for (const [nodeId, params] of split) {
              const geometry = this.createPrimitiveGeometry({ params, viOrigin, type: "point" });
              const instances = undefined; // ###TODO support splitting instances (currently animation tile trees do not permit instancing).
              const graphic = geometry ? this._system.createRenderGraphic(geometry, instances) : undefined;
              if (graphic)
                getBranch(nodeId).add(graphic);
            }

            break;
          }
          case "polyline": {
            const split = splitPolylineParams({ ...splitArgs, params: prim.params });
            for (const [nodeId, params] of split) {
              const geometry = this.createPrimitiveGeometry({ params, viOrigin, type: "polyline" });
              const instances = undefined; // ###TODO support splitting instances (currently animation tile trees do not permit instancing).
              const graphic = geometry ? this._system.createRenderGraphic(geometry, instances) : undefined;
              if (graphic)
                getBranch(nodeId).add(graphic);
            }
            break;
          }
        }
      }
    }

    for (const branch of branchesByNodeId.values()) {
      assert(!branch.isEmpty);
      output.push(this._system.createBranch(branch, Transform.createIdentity()));
    }
  }

  private readBranch(output: RenderGraphic[], primitives: Array<AnyImdlPrimitive | ImdlAreaPattern>, nodeId: number, animationId: string | undefined): void {
    const branch = new GraphicBranch(true);
    branch.animationId = animationId;
    branch.animationNodeId = nodeId;

    for (const primitive of primitives) {
      const graphic = this.readMeshGraphic(primitive);
      if (graphic)
        branch.add(graphic);
    }

    if (!branch.isEmpty)
      output.push(this._system.createBranch(branch, Transform.createIdentity()));
  }

  private finishRead(isLeaf: boolean, featureTable: PackedFeatureTable, contentRange: ElementAlignedBox3d, emptySubRangeMask: number, sizeMultiplier?: number): ImdlReaderResult {
    const graphics: RenderGraphic[] = [];

    if (undefined === this._nodes.Node_Root) {
      // Unstructured -- prior to animation support....
      for (const meshKey of Object.keys(this._meshes)) {
        const meshValue = this._meshes[meshKey];
        const primitives = meshValue?.primitives;
        if (!primitives || !meshValue)
          continue;

        for (const primitive of primitives) {
          const graphic = this.readMeshGraphic(primitive);
          if (undefined !== graphic)
            graphics.push(graphic);
        }
      }
    } else {
      for (const nodeKey of Object.keys(this._nodes)) {
        const nodeValue = this._nodes[nodeKey];
        const meshValue = undefined !== nodeValue ? this._meshes[nodeValue] : undefined;
        const primitives = meshValue?.primitives;
        if (!primitives || !meshValue)
          continue;

        const layerId = meshValue.layer;
        if ("Node_Root" === nodeKey) {
          if (this._timeline) {
            // Split up the root node into transform nodes.
            this.readAnimationBranches(graphics, meshValue, featureTable);
          } else if (this._containsTransformNodes) {
            // If transform nodes exist in the tile tree, then we need to create a branch for Node_Root so that elements not associated with
            // any node in the schedule script can be grouped together.
            this.readBranch(graphics, primitives, AnimationNodeId.Untransformed, undefined);
          } else {
            for (const primitive of primitives) {
              const graphic = this.readMeshGraphic(primitive);
              if (undefined !== graphic)
                graphics.push(graphic);
            }
          }
        } else if (undefined === layerId) {
          this.readBranch(graphics, primitives, extractNodeId(nodeKey), `${this._modelId}_${nodeKey}`);
        } else {
          const layerGraphics: RenderGraphic[] = [];
          for (const primitive of primitives) {
            const graphic = this.readMeshGraphic(primitive);
            if (undefined !== graphic)
              layerGraphics.push(graphic);
          }

          if (layerGraphics.length > 0) {
            const layerGraphic = 1 === layerGraphics.length ? layerGraphics[0] : this._system.createGraphicList(layerGraphics);
            graphics.push(this._system.createGraphicLayer(layerGraphic, layerId));
          }
        }
      }
    }

    let tileGraphic: RenderGraphic | undefined;
    switch (graphics.length) {
      case 0:
        break;
      case 1:
        tileGraphic = graphics[0];
        break;
      default:
        tileGraphic = this._system.createGraphicList(graphics);
        break;
    }

    if (tileGraphic && false !== this._options)
      tileGraphic = this._system.createBatch(tileGraphic, featureTable, contentRange, this._options);

    if (tileGraphic && this._rtcCenter) {
      const rtcBranch = new GraphicBranch(true);
      rtcBranch.add(tileGraphic);
      tileGraphic = this._system.createBranch(rtcBranch, Transform.createTranslation(this._rtcCenter));
    }

    return {
      readStatus: TileReadStatus.Success,
      isLeaf,
      sizeMultiplier,
      contentRange: contentRange.isNull ? undefined : contentRange,
      graphic: tileGraphic,
      emptySubRangeMask,
    };
  }
}

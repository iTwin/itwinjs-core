/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ClipVectorProps, Range3dProps, TransformProps, XYProps, XYZProps } from "@itwin/core-geometry";
import {
  ColorDefProps, FeatureIndexType, FillFlags, Gradient, ImageSourceFormat, LinePixels, TextureMapping, TextureTransparency,
} from "@itwin/core-common";
import { AuxChannelTableProps } from "../render/primitives/AuxChannelTable";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { MeshPrimitiveType } from "../render/primitives/MeshPrimitive";
import { SurfaceType } from "../render/primitives/SurfaceParams";

/* eslint-disable no-restricted-syntax */

/** Describes a [ColorDef]($common) as [r, g, b] with each component in [0..1].
 * @internal
 */
export type ImdlColorDef = number[];

/** Describes a [TextureMapping]($common).
 * @internal
 */
export interface ImdlTextureMapping {
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
    /** @see [TextureMapping.Params.useConstantLod]($common). Default: false. */
    useConstantLod?: boolean;
    /** Describes the [TextureMapping.ConstantLodParamProps]($common). */
    constantLodParams?: {
      repetitions?: number;
      offset?: number[];
      minDistClamp?: number;
      maxDistClamp?: number;
    };
  };
  /** @see [NormalMapParams]($common). */
  normalMapParams?: {
    textureName?: string;
    greenUp?: boolean;
    scale?: number;
    useConstantLod?: boolean;
  };
}

/** Describes a [RenderTexture]($common) with its image embedded into the tile data.
 * @internal
 */
export interface ImdlNamedTexture {
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

/** Describes a [[DisplayParams]].
 * @internal
 */
export interface ImdlDisplayParams {
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

/** Describes a [RenderMaterial]($common).
 * @internal
 */
export interface ImdlRenderMaterial {
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

/** Describes a [[SurfaceMaterialAtlas]] embedded into an [[ImdlVertexTable]].
 * @internal
 */
export interface ImdlMaterialAtlas {
  readonly numMaterials: number;
  readonly hasTranslucency?: boolean;
  readonly overridesAlpha?: boolean;
}

/** Describes a [[VertexTable]].
 * @internal
 */
export interface ImdlVertexTable {
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
 * @internal
 */
export interface ImdlInstances {
  readonly count: number;
  readonly transformCenter: number[];
  readonly featureIds: string;
  readonly transforms: string;
  readonly symbologyOverrides?: string;
}

/** Describes a unit of geometry within an [[ImdlMesh]].
 * @internal
 */
export interface ImdlPrimitive {
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
 * @internal
 */
export type ImdlAuxChannelTable = Omit<AuxChannelTableProps, "data"> & { bufferView: string };

/** Describes the "hard" edges of an [[ImdlMeshPrimitive]]. These edges represent simple line segments connecting two vertices of the mesh.
 * They are always visible regardless of view orientation.
 * Each segment is represented as a quad such that it can be expanded to a desired width in pixels.
 * @internal
 */
export interface ImdlSegmentEdges {
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
 * @internal
 */
export interface ImdlSilhouetteEdges extends ImdlSegmentEdges {
  /** The Id of the [[ImdlBufferView]] containing - for each vertex - a pair of [OctEncodedNormal]($common)s for the two faces associated with the edge. */
  readonly normalPairs: string;
}

/** A compact alternative representation of [[ImdlSegmentEdges]] and [[ImdlSilhouetteEdges]] consisting of a lookup table containing information about each unique
 * edge, along with indices into that table.
 * @see [[IndexedEdgeParams]].
 * @internal
 */
export interface ImdlIndexedEdges {
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

/** Describes the edges of an [[ImdlMeshPrimitive]].
 * @internal
 */
export interface ImdlMeshEdges {
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
 * @internal
 */
export interface ImdlPolyline {
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.indices]]. */
  readonly indices: string;
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.prevIndices]]. */
  readonly prevIndices: string;
  /** Id of the [[ImdlBufferView]] containing the [[TesselatedPolyline.nextIndicesAndParams]]. */
  readonly nextIndicesAndParams: string;
}

/** Describes a planar region in which a pattern symbol is repeated in a regular grid.
 * @see [[PatternGraphicParams]].
 * @internal
 */
export interface ImdlAreaPattern {
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

/** Describes the surface of an [[ImdlMeshPrimitive]] as a collection of triangles.
 * @internal
 */
export interface ImdlSurface {
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

/** Describes a triangle mesh, optionally including its edges. @see [[MeshParams]].
 * @internal
 */
export interface ImdlMeshPrimitive extends ImdlPrimitive {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: MeshPrimitiveType.Mesh;
  readonly surface: ImdlSurface;
  readonly edges?: ImdlMeshEdges;
  readonly auxChannels?: ImdlAuxChannelTable;
  readonly areaPattern?: ImdlAreaPattern;
}

/** Describes a collection of line strings. @see [[PolylineParams]].
 * @internal
 */
export interface ImdlPolylinePrimitive extends ImdlPrimitive, ImdlPolyline {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: MeshPrimitiveType.Polyline;
}

/** Describes a collection of individual points. @see [[PointStringParams.
 * @internal
 */
export interface ImdlPointStringPrimitive extends ImdlPrimitive {
  /** Type discriminator for [[AnyImdlPrimitive]]. */
  readonly type: MeshPrimitiveType.Point;
  /** The Id of the [[ImdlBufferView]] containing - for each point - the 24-bit index of the corresponding vertex in the [[ImdlVertexTable]]. */
  readonly indices: string;
}

/** @internal */
export type AnyImdlPrimitive = ImdlMeshPrimitive | ImdlPolylinePrimitive | ImdlPointStringPrimitive;

/** A collection of primitive geometry to be rendered.
 * @internal
 */
export interface ImdlMesh {
  /** The geometry to be rendered. */
  readonly primitives?: Array<AnyImdlPrimitive | ImdlAreaPattern>;
  /** If this mesh defines a layer, the unique Id of that layer.
   * @see [[RenderSystem.createGraphicLayer]] for a description of layers.
   */
  readonly layer?: string;
}

/** A collection of primitive geometry to be rendered as the pattern symbol for an [[ImdlAreaPattern]].
 * @internal
 */
export interface ImdlAreaPatternSymbol {
  readonly primitives: AnyImdlPrimitive[];
}

/** If the tile has an associated [RenderSchedule.Script]($common), an array of Ids of nodes in the script used to group elements.
 * @internal
 */
export interface ImdlAnimationNodes {
  /** The number of bytes in each integer Id provided by [[bufferView]] - either 1, 2, or 4. */
  bytesPerId: number;
  /** The Id of the [[ImdlBufferView]] containing the tightly-packed array of 1-, 2- or 4-byte unsigned integer node Ids; the number of bytes is specified by [[bytesPerId]]. */
  bufferView: string;
}

/** Describes a contiguous array of bytes within the binary portion of the tile.
 * @internal
 */
export interface ImdlBufferView {
  /** The number of bytes in the array. */
  byteLength: number;
  /** The offset from the beginning of the binary portion of the tile data to the first byte in the array. */
  byteOffset: number;
}

/** A top-level dictionary of resources of a particular type contained in an [[Imdl]] tile.
 * Each resource has a unique name by which it can be referred to by other contents of the tile.
 * @internal
 */
export interface ImdlDictionary<T> {
  [key: string]: T | undefined;
}

/** Describes all of the geometry contained in the tile.
 * @internal
 */
export interface ImdlScene {
  /** The Ids of the elements of [[Imdl.nodes]] to be included in the scene. */
  nodes: string[];
}

/** Describes the top-level contents of a tile.
 * @internal
 */
export interface ImdlDocument {
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  assert, ByteStream, compareBooleans, compareNumbers, compareStrings, Dictionary, Id64String, JsonUtils, Logger, utf8ToString,
} from "@itwin/core-bentley";
import {
  Angle, IndexedPolyface, Matrix3d, Point2d, Point3d, Point4d, Polyface, Range2d, Range3d, Transform, Vector3d,
} from "@itwin/core-geometry";
import {
  BatchType, ColorDef, ElementAlignedBox3d, Feature, FeatureTable, FillFlags, GlbHeader, ImageSource, LinePixels, MeshEdge,
  MeshEdges, MeshPolyline, MeshPolylineList, OctEncodedNormal, PackedFeatureTable, QParams2d, QParams3d, QPoint2dList,
  QPoint3dList, Quantization, RenderTexture, TextureMapping, TextureTransparency, TileFormat, TileReadStatus,
} from "@itwin/core-common";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { getImageSourceFormatForMimeType, imageElementFromImageSource, tryImageElementFromUrl } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { PickableGraphicOptions } from "../render/GraphicBuilder";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Mesh } from "../render/primitives/mesh/MeshPrimitives";
import { RealityMeshPrimitive } from "../render/primitives/mesh/RealityMeshPrimitive";
import { Triangle } from "../render/primitives/Primitives";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { RealityTileGeometry, TileContent } from "./internal";
import type { DracoLoader, DracoMesh } from "@loaders.gl/draco";

/* eslint-disable no-restricted-syntax */

/** Enumerates the types of [[GltfMeshPrimitive]] topologies. */
enum GltfMeshMode {
  Points = 0,
  Lines = 1,
  LineStrip = 3,
  Triangles = 4,
  /** Not currently supported. */
  TriangleStrip = 5,
  /** Not currently supported. */
  TriangleFan = 6,
}

/** Enumerates the basic data types supported by accessors, material values, technique uniforms, etc.
 * @internal
 */
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
enum GltfMagFilter {
  Nearest = 9728,
  Linear = 9729,
}

/** @internal */
enum GltfMinFilter {
  Nearest = GltfMagFilter.Nearest,
  Linear = GltfMagFilter.Linear,
  NearestMipMapNearest = 9984,
  LinearMipMapNearest = 9985,
  NearestMipMapLinear = 9986,
  LinearMipMapLinear = 9987,
}

/** Describes how texture coordinates outside of the range [0..1] are handled. */
enum GltfWrapMode {
  ClampToEdge = 33071,
  MirroredRepeat = 33648,
  Repeat = 10497,
}

/** Describes the intended target of a [[GltfBufferViewProps]]. */
enum GltfBufferTarget {
  ArrayBuffer = 34962,
  ElementArrayBuffer = 24963,
}

/** The type used to refer to an entry in a GltfDictionary in a glTF 1.0 asset. @internal */
export type Gltf1Id = string;
/** The type used to refer to an entry in a GltfDictionary in a glTF 2.0 asset. @internal */
export type Gltf2Id = number;
/** The type used to refer to an entry in a GltfDictionary. @internal */
export type GltfId = Gltf1Id | Gltf2Id;

/** A collection of resources of some type defined at the top-level of a [[Gltf]] asset.
 * In glTF 1.0, these are defined as objects; each resource is referenced and accessed by its string key.
 * In glTF 2.0, these are defined as arrays; each resource is referenced and accessed by its integer array index.
 */
interface GltfDictionary<T extends GltfChildOfRootProperty> {
  [key: GltfId]: T | undefined;
}

function * dictionaryIterator<T extends GltfChildOfRootProperty>(dict: GltfDictionary<T>): Iterable<T> {
  if (Array.isArray(dict)) {
    for (const elem of dict)
      yield elem;
  } else {
    for (const key of Object.keys(dict)) {
      const value = dict[key];
      if (undefined !== value)
        yield value;
    }
  }
}

/** Optional extensions applied to a [[GltfProperty]] to enable behavior not defined in the core specification. */
interface GltfExtensions {
  [key: string]: unknown | undefined;
}

/** The base interface provided by most objects in a glTF asset, permitting additional data to be associated with the object. */
interface GltfProperty {
  extensions?: GltfExtensions;
  extras?: any;
}

/** The base interface provided by top-level properties of a [[Gltf]] asset. */
interface GltfChildOfRootProperty extends GltfProperty {
  /** Optional name, strictly for human consumption. */
  name?: string;
}

interface DracoMeshCompression {
  bufferView: GltfId;
  // TEXCOORD_0, POSITION, etc
  attributes: { [k: string]: number | undefined };
}

/** A unit of geometry belonging to a [[GltfMesh]]. */
interface GltfMeshPrimitive extends GltfProperty {
  /** Maps the name of each mesh attribute semantic to the Id of the [[GltfAccessor]] providing the attribute's data. */
  attributes: { [k: string]: GltfId | undefined };
  /** The Id of the [[GltfAccessor]] providing the vertex indices. */
  indices?: GltfId;
  /** The Id of the [[GltfMaterial]] to apply to the primitive when rendering. */
  material?: GltfId;
  /** The primitive topology type. */
  mode?: GltfMeshMode;
  /** Morph targets - currently unsupported. */
  targets?: { [k: string]: GltfId | undefined };
  extensions?: GltfExtensions & {
    /** The [CESIUM_primitive_outline](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/CESIUM_primitive_outline) extension
     * describes how to draw outline edges for a triangle mesh.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CESIUM_primitive_outline?: {
      /** The Id of the [[GltfBufferViewProps]] supplying the endpoints of each edge as indices into the triangle mesh's vertex array.
       * The number of indices must be even; each consecutive pair of indices describes one line segment. No connectivity between
       * line segments is implied.
       */
      indices?: GltfId;
    };
    /** The [KHR_draco_mesh_compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md) extension
     * allows glTF to support geometry compressed with Draco geometry compression.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    KHR_draco_mesh_compression?: DracoMeshCompression;
  };
}

/** A collection of [[GltfMeshPrimitive]]s to be rendered. Each mesh is referenced by a node. Multiple nodes can refer to the same mesh.
 * The node's transform is applied when rendering the mesh.
 */
interface GltfMesh extends GltfChildOfRootProperty {
  /** The collection of primitives to be rendered. */
  primitives?: GltfMeshPrimitive[];
  /** For morph targets - currently unsupported. */
  weights?: number[];
}

/** Properties common to [[Gltf1Node]] and [[Gltf2Node]]. */
interface GltfNodeBaseProps {
  /** The Ids of the child nodes. @see [[GltfNode]]. */
  children?: GltfId[];
  /** Currently ignored. */
  camera?: GltfId;
  /** Currently ignored. */
  skin?: GltfId;
  /** A 4x4 column-major transformation matrix. Mutually exclusive with [[rotation]], [[scale]], and [[translation]]. */
  matrix?: number[];
  /** Unit quaternion as [x, y, z, w], where w is the scalar. */
  rotation?: number[];
  /** Non-uniform scale as [x, y, z]. */
  scale?: number[];
  /** Translation as [x, y, z]. */
  translation?: number[];
}

/** glTF 1.0 representation of a [[GltfNode]]. Unlike a [[Gltf2Node]], a Gltf1Node may refer to any number of [[GltfMesh]]es. */
interface Gltf1Node extends GltfChildOfRootProperty, GltfNodeBaseProps {
  /** The Ids of the [[GltfMesh]]es to be rendered by this node.
   * @note The spec defines this as an array of strings, but the original implementation of [[GltfReader]] was written to treat it as a string instead.
   * In case this was because of non-spec-compliant glTF that placed a string here instead of an array, either is permitted.
   */
  meshes?: GltfId[] | string;
  mesh?: never;
  /** Currently ignored. */
  jointName?: GltfId;
  /** Currently ignored. */
  skeletons?: GltfId[];
}

/** glTF 2.0 representation of a [[GltfNode]]. Unlike a [[Gltf1Node]], a Gltf2Node may refer to at most one [[GltfMesh]]. */
interface Gltf2Node extends GltfChildOfRootProperty, GltfNodeBaseProps {
  /** The Id of the [[GltfMesh]] to be rendered by this node. */
  mesh?: GltfId;
  meshes?: never;
  /** Morph targets - currently ignored. */
  weights?: number[];
}

/** Describes a node in a [[GltfScene]]. Each node may be associated with zero, one (glTF 2.0), or any number of (glTF 1.0) [[GltfMesh]]es.
 * Each node may define a transform. Each node may have any number of child nodes. A child node's transform is multiplied by its parent node's transform.
 * Some nodes may be associated with other types of data like cameras, skins, lights, etc - these types of data are currently unsupported.
 * Rendering a node means rendering its meshes and the meshes of all of its descendants, with transforms applied.
 * @internal
 */
export type GltfNode = Gltf1Node | Gltf2Node;

function getNodeMeshIds(node: GltfNode): GltfId[] {
  if (undefined !== node.meshes)
    return typeof node.meshes === "string" ? [node.meshes] : node.meshes;
  else if (undefined !== node.mesh)
    return [node.mesh];

  return [];
}

/** Describes a scene graph that composes any number of [[GltfNode]]s to produce a rendering of the [[Gltf]] asset.
 * An asset may define any number of scenes; the default scene is specified by [[Gltf.scene]].
 */
interface GltfScene extends GltfChildOfRootProperty {
  /** The Ids of the nodes comprising the scene graph. */
  nodes?: GltfId[];
}

/** Provides metadata about a [[Gltf]] asset. */
interface GltfAsset extends GltfProperty {
  /** A copyright message suitable for display to credit the content creator. */
  copyright?: string;
  /** The name of the tool that generated the asset. */
  generator?: string;
  /** The glTF version targeted by the asset, in the form "major.minor" where "major" and "minor" are integers. */
  version: string;
  /** The minimum glTF version required to properly load this asset, in the same form as [[version]].
   * This minimum version must be no greater than [[version]].
   */
  minVersion?: string;
}

/** Describes an image such as one used for a [[GltfTexture]]. The image may be referenced by a [[uri]] or a [[bufferView]]. */
interface GltfImage extends GltfChildOfRootProperty {
  /** URI from which the image data can be obtained, either as a base-64-encoded data URI or an external resource.
   * Mutually exclusive with [[bufferView]].
   */
  uri?: string;
  /** The image's media type. This property is required if [[bufferView]] is defined. */
  mimeType?: "image/jpeg" | "image/png";
  /** The Id of the [[GltfBufferViewProps]] containing the image data. Mutually exclusive with [[uri]]. */
  bufferView?: GltfId;
  extensions?: GltfExtensions & {
    /** The [KHR_binary_glTF](https://github.com/KhronosGroup/glTF/tree/main/extensions/1.0/Khronos/KHR_binary_glTF) allows an image to
     * be embedded in a binary chunk appended to the glTF asset's JSON, instead of being referenced by an external URI.
     * This is superseded in glTF 2.0 by support for the glb file format specification.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    KHR_binary_glTF?: {
      /** The Id of the [[GltfBufferViewProps]] that contains the binary image data. */
      bufferView?: GltfId;
      /** Required - @see [[GltfImage.mimeType]]. */
      mimeType?: string;
    };
  };
}

/** Describes a reference to a [[GltfTexture]]. */
interface GltfTextureInfo extends GltfProperty {
  /** The Id of the [[GltfTexture]]. */
  index: GltfId;
  /** The set index of the texture's TEXCOORD attribute used for texture coordinate mapping.
   * For example, if `texCoord` is `2`, an attribute named `TEXCOORD_2` must exist containing the texture coordinates.
   * Default: 0.
   */
  texCoord?: number;
}

/** Describes a texture and its sampler. */
interface GltfTexture extends GltfChildOfRootProperty {
  /** The Id of the [[GltfSampler]] used by this texture.
   * If undefined, a sampler with repeat wrapping and auto filtering should be used by default.
   */
  sampler?: GltfId;
  /** The Id of the [[GltfImage]] used by this texture.
   * If undefined, an extension or other mechanism should supply an alternate image source - otherwise, the behavior is undefined.
   */
  source?: GltfId;
}

/** Describes the filtering and wrapping behavior to be applied to a [[GltfTexture]].
 * @note The implementation currently does not support MirroredRepeat and does not support different wrapping for U and V;
 * effectively, unless `wrapS` or `wrapT` is set to ClampToEdge, the sampler will use GltfWrapMode.Repeat.
 */
interface GltfSampler extends  GltfChildOfRootProperty {
  /** Magnification filter. */
  magFilter?: GltfMagFilter;
  /** Minification filter. */
  minFilter?: GltfMinFilter;
  /** S (U) wrapping mode. Default: Repeat. */
  wrapS?: GltfWrapMode;
  /** T (V) wrapping mode. Default: Repeat. */
  wrapT?: GltfWrapMode;
}

/** GL states that can be enabled by a [[GltfTechnique]]. Only those queried by this implementation are enumerated. */
enum GltfTechniqueState {
  /** Enables alpha blending. */
  Blend = 3042,
}

/** For glTF 1.0 only, describes shader programs and shader state associated with a [[Gltf1Material]], used to render meshes associated with the material.
 * This implementation uses it strictly to identify techniques that require alpha blending.
 */
interface GltfTechnique extends GltfChildOfRootProperty {
  /** GL render states to be applied by the technique. */
  states?: {
    /** An array of integers corresponding to boolean GL states that should be enabled using GL's `enable` function.
     * For example, the value [[GltfTechniqueState.Blend]] (3042) indicates that blending should be enabled.
     */
    enable?: GltfTechniqueState[];
  };
}

interface Gltf1Material extends GltfChildOfRootProperty {
  diffuse?: string;
  emission?: number[];
  shininess?: number;
  specular?: number[];
  technique?: GltfId;
  values?: {
    texStep?: number[];
    color?: number[];
    tex?: number | string;
  };
}

interface GltfMaterialPbrMetallicRoughness extends GltfProperty {
  baseColorFactor?: number[];
  baseColorTexture?: GltfTextureInfo;
  metallicFactor?: number;
  metallicRoughnessTexture?: GltfTextureInfo;
}

interface Gltf2Material extends GltfChildOfRootProperty {
  pbrMetallicRoughness?: GltfMaterialPbrMetallicRoughness;
  normalTexture?: unknown;
  occlusionTexture?: unknown;
  emissiveTexture?: GltfTextureInfo;
  emissiveFactor?: number[];
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: GltfExtensions & {
    /** The [KHR_materials_unlit](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit) extension
     * indicates that the material should be displayed without lighting. The extension adds no additional properties; it is effectively a boolean flag.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    KHR_materials_unlit?: { };
    /** The [KHR_techniques_webgl extension](https://github.com/KhronosGroup/glTF/blob/c1c12bd100e88ff468ccef1cb88cfbec56a69af2/extensions/2.0/Khronos/KHR_techniques_webgl/README.md)
     * allows "techniques" to be associated with [[GltfMaterial]]s. Techniques can supply custom shader programs to render geometry; this was a core feature of glTF 1.0 (see [[GltfTechnique]]).
     * Here, it is only used to extract uniform values.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    KHR_techniques_webgl?: {
      technique?: number;
      // An object containing uniform values. Each property name corresponds to a uniform in the material's technique and must conform to that uniform's type and count properties.
      // A handful of uniforms referenced in this implementation by name are defined below.
      values?: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        u_texStep?: number[];
        // eslint-disable-next-line @typescript-eslint/naming-convention
        u_color?: number[];
        // Diffuse texture.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        u_diffuse?: { index: number, texCoord: number };
        [k: string]: unknown | undefined;
      };
    };
  };
}

type GltfMaterial = Gltf1Material | Gltf2Material;

function isGltf1Material(material: GltfMaterial): material is Gltf1Material {
  const mat1 = material as Gltf1Material;
  return undefined !== mat1.technique || undefined !== mat1.values;
}

interface GltfBuffer extends GltfChildOfRootProperty {
  uri?: string;
  byteLength?: number;
}

interface GltfBufferViewProps extends GltfChildOfRootProperty {
  buffer: GltfId;
  byteLength?: number;
  byteOffset?: number;
  byteStride?: number;
  target?: GltfBufferTarget;
}

interface GltfAccessor extends GltfChildOfRootProperty {
  bufferView?: GltfId;
  byteOffset?: number;
  componentType?: GltfDataType.SignedByte | GltfDataType.UnsignedByte | GltfDataType.SignedShort | GltfDataType.UnsignedShort | GltfDataType.UInt32 | GltfDataType.Float;
  normalized?: boolean;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
  max?: number[];
  min?: number[];
  sparse?: unknown; // ###TODO sparse accessors
}

/** Describes the top-level structure of a glTF asset.
 * This interface, along with all of the related Gltf* types defined in this file, is primarily based upon the [official glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html).
 * However, it can also represent a [glTF 1.0](https://github.com/KhronosGroup/glTF/tree/main/specification/1.0#reference-node) asset.
 * Some types are combined. For example, the top-level dictionaries in glTF 1.0 are objects, while in glTF 2.0 they are arrays; the GltfDictionary interface supports accessing
 * items using either strings or numeric indexes represented by [[GltfId]].
 * For types that differ significantly between the two specs, Gltf1* and Gltf2* versions are defined (e.g., GltfMaterial is a union of Gltf1Material and Gltf2Material).
 * These interfaces also accommodate some deviations from both specs that are known to exist in the wild.
 * Most aspects of the specifications that are not implemented here are omitted (e.g., skinning, animations).
 * @internal
 */
export interface Gltf extends GltfProperty {
  /** Metadata about the glTF asset.
   * @note This property is required in glTF 2.0, but optional in 1.0.
   */
  asset?: GltfAsset;
  /** The Id of the default [[GltfScene]] in [[scenes]]. */
  scene?: GltfId;
  extensions?: GltfExtensions & {
    /** The [CESIUM_RTC extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/1.0/Vendor/CESIUM_RTC/README.md) defines a centroid
     * relative to which all coordinates in the asset are defined, to reduce floating-point precision errors for large coordinates.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CESIUM_RTC?: {
      center?: number[];
    };
    /** The [KHR_techniques_webgl extension](https://github.com/KhronosGroup/glTF/blob/c1c12bd100e88ff468ccef1cb88cfbec56a69af2/extensions/2.0/Khronos/KHR_techniques_webgl/README.md)
     * allows "techniques" to be associated with [[GltfMaterial]]s. Techniques can supply custom shader programs to render geometry; this was a core feature of glTF 1.0 (see [[GltfTechnique]]).
     * Here, it is only used to extract uniform values.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    KHR_techniques_webgl?: {
      techniques?: Array<{
        uniforms?: {
          [key: string]: { type: GltfDataType, value?: any } | undefined;
        };
      }>;
    };
  };
  /** Names of glTF extensions used in the asset. */
  extensionsUsed?: string[];
  /** Names of glTF extensions required to properly load the asset. */
  extensionsRequired?: string[];
  accessors?: GltfDictionary<GltfAccessor>;
  /** Not currently supported. */
  animations?: GltfDictionary<any>;
  buffers?: GltfDictionary<GltfBuffer>;
  bufferViews?: GltfDictionary<GltfBufferViewProps>;
  /** Not currently used. */
  cameras?: GltfDictionary<any>;
  images?: GltfDictionary<GltfImage>;
  materials?: GltfDictionary<GltfMaterial>;
  meshes?: GltfDictionary<GltfMesh>;
  nodes?: GltfDictionary<GltfNode>;
  samplers?: GltfDictionary<GltfSampler>;
  scenes?: GltfDictionary<GltfScene>;
  /** Not currently supported. */
  skins?: GltfDictionary<any>;
  textures?: GltfDictionary<GltfTexture>;
  /** For glTF 1.0 only, techniques associated with [[Gltf1Material]]s. */
  techniques?: GltfDictionary<GltfTechnique>;
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

/* -----------------------------------
 * To restore the use of web workers to decode jpeg, locate and uncomment the three sections by searching for "webworker".
  import { WorkerOperation, WebWorkerManager } from "../WebWorkerManager";
  ------------------------------------ */

/** The result of [[GltfReader.read]].
 * @internal
 */
export interface GltfReaderResult extends TileContent {
  readStatus: TileReadStatus;
}

/** Data required for creating a [[GltfReader]] capable of deserializing [glTF](https://www.khronos.org/gltf/).
 * @internal
 */
export class GltfReaderProps {
  public readonly version: number;
  public readonly glTF: Gltf;
  public readonly yAxisUp: boolean;
  public readonly binaryData?: Uint8Array;
  public readonly baseUrl?: string;

  private constructor(glTF: Gltf, version: number, yAxisUp: boolean, binaryData: Uint8Array | undefined, baseUrl?: string | undefined) {
    this.version = version;
    this.glTF = glTF;
    this.binaryData = binaryData;
    this.yAxisUp = yAxisUp;
    this.baseUrl = baseUrl;
  }

  /** Attempt to construct a new GltfReaderProps from the binary data beginning at the supplied stream's current read position. */
  public static create(source: Uint8Array | Gltf, yAxisUp: boolean = false, baseUrl?: string): GltfReaderProps | undefined {
    let version: number;
    let json: Gltf;
    let binaryData: Uint8Array | undefined;

    if (source instanceof Uint8Array) {
      // It may be JSON - check for magic indicating glb.
      const buffer = ByteStream.fromUint8Array(source);
      if (TileFormat.Gltf !== buffer.nextUint32) {
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

    const glTF: Gltf = {
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

  public constructor(props: Mesh) {
    this.primitive = props;
  }
}

/** A function that returns true if deserialization of the data supplied by the reader should abort.
 * @internal
 */
export type ShouldAbortReadGltf = (reader: GltfReader) => boolean;

/* -----------------------------------
   This is part of the webworker option.

  // input is Uint8Array, the result is an ImageBitMap.
  class ImageDecodeWorkerOperation extends WorkerOperation {
    constructor(imageBytes: ArrayBuffer, imageMimeType: string) {
      super("imageBytesToImageBitmap", [imageBytes, imageMimeType], [imageBytes]);
    }
  }
-------------------------------------- */

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
      // SPEC: To compose the local transformation matrix, TRS properties MUST be converted to matrices and postmultiplied in the T * R * S order;
      // first the scale is applied to the vertices, then the rotation, and then the translation.
      const scale = Transform.createRefs(undefined, node.scale ? Matrix3d.createScale(node.scale[0], node.scale[1], node.scale[2]) : Matrix3d.identity);
      const rot = Transform.createRefs(undefined, node.rotation ? Matrix3d.createFromQuaternion(Point4d.create(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3])) : Matrix3d.identity);
      rot.matrix.transposeInPlace(); // See comment on Matrix3d.createFromQuaternion
      const trans = Transform.createTranslation(node.translation ? new Point3d(node.translation[0], node.translation[1], node.translation[2]) : Point3d.createZero());

      nodeTransform = scale.multiplyTransformTransform(rot);
      trans.multiplyTransformTransform(nodeTransform, nodeTransform);
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
  /** If true, the graphics produced will always use a [[VertexTable]]; otherwise, where possible a [[RealityMeshPrimitive]] will be used instead.
   * Reality meshes are simpler but do not support some features like lighting.
   */
  vertexTableRequired?: boolean;
}

function * traverseNodes(ids: Iterable<GltfId>, nodes: GltfDictionary<GltfNode>, traversed: Set<GltfId>): Iterable<GltfNode> {
  for (const id of ids) {
    if (traversed.has(id))
      throw new Error("Cycle detected while traversing glTF nodes");

    const node = nodes[id];
    if (!node)
      continue;

    traversed.add(id);
    yield node;
    if (node.children)
      for (const child of traverseNodes(node.children, nodes, traversed))
        yield child;
  }
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
  protected readonly _glTF: Gltf;
  protected readonly _version: number;
  protected readonly _iModel: IModelConnection;
  protected readonly _is3d: boolean;
  protected readonly _system: RenderSystem;
  protected readonly _returnToCenter?: Point3d;
  protected readonly _yAxisUp: boolean;
  protected readonly _baseUrl?: string;
  protected readonly _type: BatchType;
  protected readonly _deduplicateVertices: boolean;
  protected readonly _vertexTableRequired: boolean;
  private readonly _canceled?: ShouldAbortReadGltf;
  protected readonly _sceneNodes: GltfId[];
  protected _computedContentRange?: ElementAlignedBox3d;
  private readonly _resolvedTextures = new Dictionary<TextureKey, RenderTexture | false>((lhs, rhs) => compareTextureKeys(lhs, rhs));
  private readonly _dracoMeshes = new Map<DracoMeshCompression, DracoMesh>();

  protected get _nodes(): GltfDictionary<GltfNode> { return this._glTF.nodes ?? emptyDict; }
  protected get _meshes(): GltfDictionary<GltfMesh> { return this._glTF.meshes ?? emptyDict; }
  protected get _accessors(): GltfDictionary<GltfAccessor> { return this._glTF.accessors ?? emptyDict; }
  protected get _bufferViews(): GltfDictionary<GltfBufferViewProps> { return this._glTF.bufferViews ?? emptyDict; }
  protected get _materials(): GltfDictionary<GltfMaterial> { return this._glTF.materials ?? emptyDict; }
  protected get _samplers(): GltfDictionary<GltfSampler> { return this._glTF.samplers ?? emptyDict; }
  protected get _textures(): GltfDictionary<GltfTexture> { return this._glTF.textures ?? emptyDict; }

  protected get _images(): GltfDictionary<GltfImage & { resolvedImage?: HTMLImageElement }> { return this._glTF.images ?? emptyDict; }
  protected get _buffers(): GltfDictionary<GltfBuffer & { resolvedBuffer?: Uint8Array }> { return this._glTF.buffers ?? emptyDict; }

  /* -----------------------------------
  private static _webWorkerManager: WebWorkerManager;

  private static get webWorkerManager() {
    if (!GltfReader._webWorkerManager) {
      GltfReader._webWorkerManager = new WebWorkerManager("v" + BUILD_SEMVER + "/frontend-webworker.js", 4);
    }
    return GltfReader._webWorkerManager;
  }
  ------------------------------------- */

  /** Asynchronously deserialize the tile data and return the result. */
  public abstract read(): Promise<GltfReaderResult>;

  protected get _isCanceled(): boolean { return undefined !== this._canceled && this._canceled(this); }
  protected get _isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this._type; }

  /** Traverse the nodes specified by their Ids, recursing into their child nodes.
   * @param nodeIds The Ids of the nodes to traverse.
   * @throws Error if a node appears more than once during traversal
   */
  public traverseNodes(nodeIds: Iterable<GltfId>): Iterable<GltfNode> {
    return traverseNodes(nodeIds, this._nodes, new Set<GltfId>());
  }

  /** Traverse the nodes specified by their scene, recursing into their child nodes.
   * @throws Error if a node appears more than once during traversal
   */
  public traverseScene(): Iterable<GltfNode> {
    return this.traverseNodes(this._sceneNodes);
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
    let range = contentRange;
    const invTransform = transform?.inverse();
    if (invTransform)
      range = invTransform.multiplyRange(contentRange);

    if (featureTable)
      renderGraphic = this._system.createBatch(renderGraphic, PackedFeatureTable.pack(featureTable), range);

    if (transform) {
      const branch = new GraphicBranch(true);
      branch.add(renderGraphic);
      renderGraphic = this._system.createBranch(branch, transform);
    }

    return {
      readStatus,
      isLeaf,
      contentRange,
      graphic: renderGraphic,
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

  private graphicFromMeshData(gltfMesh: GltfMeshData, instances?: InstancedGraphicParams): RenderGraphic | undefined {
    if (!gltfMesh.points || !gltfMesh.pointRange)
      return gltfMesh.primitive.getGraphics(this._system, instances);

    const realityMeshPrimitive = (this._vertexTableRequired || instances) ? undefined : RealityMeshPrimitive.createFromGltfMesh(gltfMesh);
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

  private readNodeAndCreateGraphics(renderGraphicList: RenderGraphic[], node: GltfNode, featureTable: FeatureTable | undefined, transformStack: TransformStack, instances?: InstancedGraphicParams, pseudoRtcBias?: Vector3d): TileReadStatus {
    if (undefined === node)
      return TileReadStatus.InvalidTileData;

    // IMPORTANT: Do not return without popping this node from the stack.
    transformStack.push(node);
    const thisTransform = transformStack.transform;

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

    for (const meshKey of getNodeMeshIds(node)) {
      const nodeMesh = this._meshes[meshKey];
      if (nodeMesh?.primitives) {
        const meshes = this.readMeshPrimitives(node, featureTable, thisTransform, thisBias);

        let renderGraphic: RenderGraphic | undefined;
        if (0 !== meshes.length) {
          if (1 === meshes.length) {
            renderGraphic = this.graphicFromMeshData(meshes[0], instances);
          } else {
            const thisList: RenderGraphic[] = [];
            for (const mesh of meshes) {
              renderGraphic = this.graphicFromMeshData(mesh, instances);
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
          this.readNodeAndCreateGraphics(renderGraphicList, child, featureTable, transformStack, instances);
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
      const polyface = this.polyfaceFromGltfMesh(mesh, transformStack.transform, needNormals, needParams);
      if (polyface)
        polyfaces.push(polyface);
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

  private extractTextureId(material: GltfMaterial): string | undefined {
    if (typeof material !== "object")
      return undefined;

    const extractId = (value: any) => {
      switch (typeof value) {
        case "string":
          return value;
        case "number":
          return value.toString();
        default:
          return undefined;
      }
    };

    // Bimium's shader value...almost certainly obsolete at this point.
    if (isGltf1Material(material))
      return material.diffuse ?? extractId(material.values?.tex);

    // KHR_techniques_webgl extension
    const techniques = this._glTF.extensions?.KHR_techniques_webgl?.techniques;
    const ext = Array.isArray(techniques) ? material.extensions?.KHR_techniques_webgl : undefined;
    if (techniques && undefined !== ext && typeof(ext.values) === "object") {
      const uniforms = typeof ext.technique === "number" ? techniques[ext.technique].uniforms : undefined;
      if (typeof uniforms === "object") {
        for (const uniformName of Object.keys(uniforms)) {
          const uniform = uniforms[uniformName];
          if (typeof uniform === "object" && uniform.type === GltfDataType.Sampler2d)
            return extractId((ext.values[uniformName] as any)?.index);
        }
      }
    }

    const id = extractId(material.pbrMetallicRoughness?.baseColorTexture?.index);
    return id ?? extractId(material.emissiveTexture?.index);
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
    const textureMapping = undefined !== textureId ? this.findTextureMapping(textureId, isTransparent) : undefined;
    const color = colorFromMaterial(material, isTransparent);
    return new DisplayParams(DisplayParams.Type.Mesh, color, color, 1, LinePixels.Solid, FillFlags.Always, undefined, undefined, hasBakedLighting, textureMapping);
  }

  private readMeshPrimitives(node: GltfNode, featureTable?: FeatureTable, thisTransform?: Transform, thisBias?: Vector3d): GltfMeshData[] {
    const meshes: GltfMeshData[] = [];
    for (const meshKey of getNodeMeshIds(node)) {
      const nodeMesh = this._meshes[meshKey];
      if (nodeMesh?.primitives) {
        for (const primitive of nodeMesh.primitives) {
          const mesh = this.readMeshPrimitive(primitive, featureTable, thisBias);
          if (mesh) {
            meshes.push(mesh);
            if (this._computedContentRange && mesh.pointRange) {
              const invTransform = thisTransform?.inverse();
              const meshRange = invTransform ? invTransform.multiplyRange(mesh.pointRange) : mesh.pointRange;
              this._computedContentRange.extendRange(meshRange);
            }
          }
        }
      }
    }

    return meshes;
  }

  protected readMeshPrimitive(primitive: GltfMeshPrimitive, featureTable?: FeatureTable, pseudoRtcBias?: Vector3d): GltfMeshData | undefined {
    const materialName = JsonUtils.asString(primitive.material);
    const material = 0 < materialName.length ? this._materials[materialName] : undefined;
    if (!material)
      return undefined;

    const hasBakedLighting = undefined === primitive.attributes.NORMAL || undefined !== material.extensions?.KHR_materials_unlit;
    const displayParams = material ? this.createDisplayParams(material, hasBakedLighting) : undefined;
    if (!displayParams)
      return undefined;

    let primitiveType: number = -1;
    const meshMode = JsonUtils.asInt(primitive.mode, GltfMeshMode.Triangles);
    switch (meshMode) {
      case GltfMeshMode.Lines:
        primitiveType = Mesh.PrimitiveType.Polyline;
        break;

      case GltfMeshMode.Points:
        primitiveType = Mesh.PrimitiveType.Point;
        break;

      case GltfMeshMode.Triangles:
        primitiveType = Mesh.PrimitiveType.Mesh;
        break;

      default:
        assert(false);
        return undefined;
    }

    const isVolumeClassifier = this._isVolumeClassifier;
    const meshPrimitive = Mesh.create({
      displayParams,
      features: undefined !== featureTable ? new Mesh.Features(featureTable) : undefined,
      type: primitiveType,
      range: Range3d.createNull(),
      is2d: !this._is3d,
      isPlanar: false,
      hasBakedLighting,
      isVolumeClassifier,
      quantizePositions: true,
    });

    const mesh = new GltfMeshData(meshPrimitive);

    // We don't have real colormap - just load material color.  This will be used if non-Bentley
    // tile or fit the color table is uniform. For a non-Bentley, non-Uniform, we'll set the
    // uv parameters to pick the colors out of the color map texture.
    meshPrimitive.colorMap.insert(displayParams.fillColor.tbgr);   // White...

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

    const draco = primitive.extensions?.KHR_draco_mesh_compression;
    if (draco)
      return this.readDracoMeshPrimitive(mesh.primitive, draco) ? mesh : undefined;

    this.readBatchTable(mesh.primitive, primitive);

    if (!this.readVertices(mesh, primitive, pseudoRtcBias))
      return undefined;

    switch (primitiveType) {
      case Mesh.PrimitiveType.Mesh: {
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

      case Mesh.PrimitiveType.Polyline:
      case Mesh.PrimitiveType.Point: {
        if (undefined !== mesh.primitive.polylines && !this.readPolylines(mesh.primitive.polylines, primitive, "indices", Mesh.PrimitiveType.Point === primitiveType))
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
    if (uvs && (uvs.length & 2) === 0)
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

      const extensions = JsonUtils.asObject(view.accessor.extensions);
      const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
      if (undefined === quantized)
        return false;

      const rangeMin = JsonUtils.asArray(quantized.decodedMin);
      const rangeMax = JsonUtils.asArray(quantized.decodedMax);
      if (undefined === rangeMin || undefined === rangeMax)
        return false;

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

  protected readBatchTable(_mesh: Mesh, _json: any) {
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
        const extensions = JsonUtils.asObject(view.accessor.extensions);
        const quantized = undefined !== extensions ? JsonUtils.asObject(extensions.WEB3D_quantized_attributes) : undefined;
        if (undefined === quantized)
          return false;

        const rangeMin = JsonUtils.asArray(quantized.decodedMin);
        const rangeMax = JsonUtils.asArray(quantized.decodedMax);
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
      for (const meshId of getNodeMeshIds(node)) {
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
      for (const buffer of dictionaryIterator(this._buffers))
        if (!buffer.resolvedBuffer)
          promises.push(this.resolveBuffer(buffer));

      await Promise.all(promises);
      if (this._isCanceled)
        return;

      promises.length = 0;
      for (const image of dictionaryIterator(this._images))
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
      return new URL(uri, this._baseUrl).toString();
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

  private async resolveImage(image: GltfImage & { resolvedImage?: HTMLImageElement }): Promise<void> {
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
        image.resolvedImage = await imageElementFromImageSource(new ImageSource(bytes, format));
      } catch (_) {
        //
      }

      return;
    }

    const url = undefined !== image.uri ? this.resolveUrl(image.uri) : undefined;
    if (undefined !== url)
      image.resolvedImage = await tryImageElementFromUrl(url);
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
    // ###TODO: RenderTexture should support different wrapping behavior for U vs V, and support mirrored repeat.
    // For now, repeat unless either explicitly clamps.
    const textureType = GltfWrapMode.ClampToEdge === sampler?.wrapS || GltfWrapMode.ClampToEdge === sampler?.wrapT ? RenderTexture.Type.TileSection : RenderTexture.Type.Normal;
    const renderTexture = this._system.createTexture({
      type: textureType,
      image: {
        source: image,
        transparency: isTransparent ? TextureTransparency.Mixed : TextureTransparency.Opaque,
      },
    });

    return renderTexture ?? false;
  }

  protected findTextureMapping(id: string, isTransparent: boolean): TextureMapping | undefined {
    let texture = this._resolvedTextures.get({ id, isTransparent });
    if (undefined === texture)
      this._resolvedTextures.set({ id, isTransparent }, texture = this.resolveTexture(id, isTransparent));

    return texture ? new TextureMapping(texture, new TextureMapping.Params()) : undefined;
  }
}

/** Arguments supplied to [[readGltfGraphics]] to produce a [[RenderGraphic]] from a [glTF](https://www.khronos.org/gltf/) asset.
 * @public
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
  pickableOptions?: PickableGraphicOptions & { modelId?: Id64String };
  /** The base URL for any relative URIs in the glTF. Typically, this is the same as the URL for the glTF asset itself.
   * If not supplied, relative URIs cannot be resolved. For glTF assets containing no relative URIs, this is not required.
   */
  baseUrl?: string;
}

/** Produce a [[RenderGraphic]] from a [glTF](https://www.khronos.org/gltf/) asset suitable for use in [view decorations]($docs/learning/frontend/ViewDecorations).
 * @returns a graphic produced from the glTF asset's default scene, or `undefined` if a graphic could not be produced from the asset.
 * @note Support for the full [glTF 2.0 specification](https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html) is currently a work in progress.
 * If a particular glTF asset fails to load and/or display properly, please
 * [submit an issue](https://github.com/iTwin/itwinjs-core/issues).
 * @see [Example decorator]($docs/learning/frontend/ViewDecorations#gltf-decorations) for an example of a decorator that reads and displays a glTF asset.
 * @public
 */
export async function readGltfGraphics(args: ReadGltfGraphicsArgs): Promise<RenderGraphic | undefined> {
  const props = GltfReaderProps.create(args.gltf, true, args.baseUrl); // glTF supports exactly one coordinate system with y axis up.
  const reader = props ? new GltfGraphicsReader(props, args) : undefined;
  if (!reader)
    return undefined;

  const result = await reader.read();
  return result.graphic;
}

/** Implements [[readGltfGraphics]]. Exported strictly for tests.
 * @internal
 */
export class GltfGraphicsReader extends GltfReader {
  private readonly _featureTable?: FeatureTable;
  public readonly binaryData?: Uint8Array; // strictly for tests

  public constructor(props: GltfReaderProps, args: ReadGltfGraphicsArgs) {
    super({
      props,
      iModel: args.iModel,
      vertexTableRequired: true,
    });

    this.binaryData = props.binaryData;
    const pickableId = args.pickableOptions?.id;
    if (pickableId) {
      this._featureTable = new FeatureTable(1, args.pickableOptions?.modelId ?? pickableId, BatchType.Primary);
      this._featureTable.insert(new Feature(pickableId));
    }
  }

  public async read(): Promise<GltfReaderResult> {
    await this.resolveResources();
    return this.readGltfAndCreateGraphics(true, this._featureTable, undefined);
  }

  public get nodes(): GltfDictionary<GltfNode> { return this._nodes; }
  public get scenes(): GltfDictionary<GltfScene> { return this._glTF.scenes ?? emptyDict; }
  public get sceneNodes(): GltfId[] { return this._sceneNodes; }
  public get textures(): GltfDictionary<GltfTexture> { return this._textures; }
}

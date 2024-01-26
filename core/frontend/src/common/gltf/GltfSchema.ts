/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Enumerates the types of [[GltfMeshPrimitive]] topologies.
 * @internal
 */
export enum GltfMeshMode {
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
export enum GltfMagFilter {
  Nearest = 9728,
  Linear = 9729,
}

/** @internal */
export enum GltfMinFilter {
  Nearest = GltfMagFilter.Nearest,
  Linear = GltfMagFilter.Linear,
  NearestMipMapNearest = 9984,
  LinearMipMapNearest = 9985,
  NearestMipMapLinear = 9986,
  LinearMipMapLinear = 9987,
}

/** Describes how texture coordinates outside of the range [0..1] are handled.
 * @internal
 */
export enum GltfWrapMode {
  ClampToEdge = 33071,
  MirroredRepeat = 33648,
  Repeat = 10497,
}

/** Describes the intended target of a [[GltfBufferViewProps]].
 * @internal
 */
export enum GltfBufferTarget {
  ArrayBuffer = 34962,
  ElementArrayBuffer = 24963,
}

/** The type used to refer to an entry in a GltfDictionary in a glTF 1.0 asset. @internal */
export type Gltf1Id = string;
/** The type used to refer to an entry in a GltfDictionary in a glTF 2.0 asset. @internal */
export type Gltf2Id = number;
/** The type used to refer to an entry in a GltfDictionary. @internal */
export type GltfId = Gltf1Id | Gltf2Id;

/** A collection of resources of some type defined at the top-level of a [[GltfDocument]].
 * In glTF 1.0, these are defined as objects; each resource is referenced and accessed by its string key.
 * In glTF 2.0, these are defined as arrays; each resource is referenced and accessed by its integer array index.
 * @internal
 */
export interface GltfDictionary<T extends GltfChildOfRootProperty> {
  [key: GltfId]: T | undefined;
}

/** @internal */
export interface GltfStringMap<T> {
  [key: string]: T | undefined;
}

/** Iterate the contents of a [[GltfDictionary]].
 * @internal
 */
export function * gltfDictionaryIterator<T extends GltfChildOfRootProperty>(dict: GltfDictionary<T>): Iterable<T> {
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

/** Optional extensions applied to a [[GltfProperty]] to enable behavior not defined in the core specification.
 * @internal
 */
export type GltfExtensions = GltfStringMap<unknown>;

/** The base interface provided by most objects in a glTF asset, permitting additional data to be associated with the object.
 * @internal
 */
export interface GltfProperty {
  extensions?: GltfExtensions;
  extras?: any;
}

/** The base interface provided by top-level properties of a [[GltfDocument]].
 * @internal
 */
export interface GltfChildOfRootProperty extends GltfProperty {
  /** Optional name, strictly for human consumption. */
  name?: string;
}

/** @internal */
export interface DracoMeshCompression {
  bufferView: GltfId;
  // TEXCOORD_0, POSITION, etc
  attributes: GltfStringMap<number>;
}

/** @internal */
export interface MeshFeature extends GltfProperty {
  featureCount: number;
  nullFeatureId?: number;
  label?: string;
  propertyTable?: number;
  texture?: unknown;
  attribute?: number;
}

/** @internal */
export interface MeshFeatures {
  featureIds: MeshFeature[];
}

/** A unit of geometry belonging to a [[GltfMesh]]. @internal */
export interface GltfMeshPrimitive extends GltfProperty {
  /** Maps the name of each mesh attribute semantic to the Id of the [[GltfAccessor]] providing the attribute's data. */
  attributes: GltfStringMap<GltfId>;
  /** The Id of the [[GltfAccessor]] providing the vertex indices. */
  indices?: GltfId;
  /** The Id of the [[GltfMaterial]] to apply to the primitive when rendering. */
  material?: GltfId;
  /** The primitive topology type. */
  mode?: GltfMeshMode;
  /** Morph targets - currently unsupported. */
  targets?: GltfStringMap<GltfId>;
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EXT_mesh_features?: MeshFeatures;
  };
}

/** A collection of [[GltfMeshPrimitive]]s to be rendered. Each mesh is referenced by a node. Multiple nodes can refer to the same mesh.
 * The node's transform is applied when rendering the mesh.
 * @internal
 */
export interface GltfMesh extends GltfChildOfRootProperty {
  /** The collection of primitives to be rendered. */
  primitives?: GltfMeshPrimitive[];
  /** For morph targets - currently unsupported. */
  weights?: number[];
}

/** Properties common to [[Gltf1Node]] and [[Gltf2Node]]. @internal */
export interface GltfNodeBaseProps {
  /** The Ids of the child nodes. @see [[GltfNode]]. */
  children?: GltfId[];
  /** Currently ignored. */
  camera?: GltfId;
  /** Currently ignored. */
  skin?: GltfId;
  /** A 4x4 column-major transformation matrix. Mutually exclusive with [[rotation]], [[scale]], and [[translation]]. */
  matrix?: number[];
  /** Unit quaternion as [x, y, z, w], where w is the scalar. */
  rotation?: [number, number, number, number];
  /** Non-uniform scale as [x, y, z]. */
  scale?: [number, number, number];
  /** Translation as [x, y, z]. */
  translation?: [number, number, number];
}

/** glTF 1.0 representation of a [[GltfNode]]. Unlike a [[Gltf2Node]], a Gltf1Node may refer to any number of [[GltfMesh]]es.
 * @internal
 */
export interface Gltf1Node extends GltfChildOfRootProperty, GltfNodeBaseProps {
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

/** glTF 2.0 representation of a [[GltfNode]]. Unlike a [[Gltf1Node]], a Gltf2Node may refer to at most one [[GltfMesh]].
 * @internal
 */
export interface Gltf2Node extends GltfChildOfRootProperty, GltfNodeBaseProps {
  /** The Id of the [[GltfMesh]] to be rendered by this node. */
  mesh?: GltfId;
  meshes?: never;
  /** Morph targets - currently ignored. */
  weights?: number[];
  extensions?: GltfExtensions & {
    /** The [EXT_mesh_gpu_instancing](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing/README.md) extension permits multiple
     * instances of the same mesh to be rendered with different translation, rotation, and/or scale.
     * All of the attribute accessors must have the same count (which indicates the number of instances to be drawn).
     * All attributes are optional (though omitting all of them would be silly).
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EXT_mesh_gpu_instancing?: {
      attributes?: {
        /** VEC3; FLOAT */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        TRANSLATION?: GltfId;
        /** VEC4 (quaternion); FLOAT, normalized BYTE, or normalized SHORT */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ROTATION?: GltfId;
        /** VEC3; FLOAT */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SCALE?: GltfId;
      };
    };
  };
}

/** Describes a node in a [[GltfScene]]. Each node may be associated with zero, one (glTF 2.0), or any number of (glTF 1.0) [[GltfMesh]]es.
 * Each node may define a transform. Each node may have any number of child nodes. A child node's transform is multiplied by its parent node's transform.
 * Some nodes may be associated with other types of data like cameras, skins, lights, etc - these types of data are currently unsupported.
 * Rendering a node means rendering its meshes and the meshes of all of its descendants, with transforms applied.
 * @internal
 */
export type GltfNode = Gltf1Node | Gltf2Node;

/** Get the Ids of the meshes associated with a node.
 * @internal
 */
export function getGltfNodeMeshIds(node: GltfNode): GltfId[] {
  if (undefined !== node.meshes)
    return typeof node.meshes === "string" ? [node.meshes] : node.meshes;
  else if (undefined !== node.mesh)
    return [node.mesh];

  return [];
}

/** @internal */
export function * traverseGltfNodes(ids: Iterable<GltfId>, nodes: GltfDictionary<GltfNode>, traversed: Set<GltfId>): Iterable<GltfNode> {
  for (const id of ids) {
    if (traversed.has(id))
      throw new Error("Cycle detected while traversing glTF nodes");

    const node = nodes[id];
    if (!node)
      continue;

    traversed.add(id);
    yield node;
    if (node.children)
      for (const child of traverseGltfNodes(node.children, nodes, traversed))
        yield child;
  }
}

/** Describes a scene graph that composes any number of [[GltfNode]]s to produce a rendering of the [[GltfDocument]] asset.
 * An asset may define any number of scenes; the default scene is specified by [[Gltf.scene]].
 * @internal
 */
export interface GltfScene extends GltfChildOfRootProperty {
  /** The Ids of the nodes comprising the scene graph. */
  nodes?: GltfId[];
}

/** Provides metadata about a [[GltfDocument]] asset.
 * @internal
 */
export interface GltfAsset extends GltfProperty {
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

/** Describes an image such as one used for a [[GltfTexture]]. The image may be referenced by a [[uri]] or a [[bufferView]].
 * @internal
 */
export interface GltfImage extends GltfChildOfRootProperty {
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

/** Describes a reference to a [[GltfTexture]]. @internal */
export interface GltfTextureInfo extends GltfProperty {
  /** The Id of the [[GltfTexture]]. */
  index: GltfId;
  /** The set index of the texture's TEXCOORD attribute used for texture coordinate mapping.
   * For example, if `texCoord` is `2`, an attribute named `TEXCOORD_2` must exist containing the texture coordinates.
   * Default: 0.
   */
  texCoord?: number;
}

/** Describes a texture and its sampler.
 * @internal
 */
export interface GltfTexture extends GltfChildOfRootProperty {
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
 * @internal
 */
export interface GltfSampler extends  GltfChildOfRootProperty {
  /** Magnification filter. */
  magFilter?: GltfMagFilter;
  /** Minification filter. */
  minFilter?: GltfMinFilter;
  /** S (U) wrapping mode. Default: Repeat. */
  wrapS?: GltfWrapMode;
  /** T (V) wrapping mode. Default: Repeat. */
  wrapT?: GltfWrapMode;
}

/** GL states that can be enabled by a [[GltfTechnique]]. Only those queried by this implementation are enumerated.
 * @internal
 */
export enum GltfTechniqueState {
  /** Enables alpha blending. */
  Blend = 3042,
}

/** For glTF 1.0 only, describes shader programs and shader state associated with a [[Gltf1Material]], used to render meshes associated with the material.
 * This implementation uses it strictly to identify techniques that require alpha blending.
 * @internal
 */
export interface GltfTechnique extends GltfChildOfRootProperty {
  /** GL render states to be applied by the technique. */
  states?: {
    /** An array of integers corresponding to boolean GL states that should be enabled using GL's `enable` function.
     * For example, the value [[GltfTechniqueState.Blend]] (3042) indicates that blending should be enabled.
     */
    enable?: GltfTechniqueState[];
  };
}

/** @internal */
export interface Gltf1Material extends GltfChildOfRootProperty {
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

/** @internal */
export interface GltfMaterialPbrMetallicRoughness extends GltfProperty {
  // Default [1,1,1,1]
  baseColorFactor?: number[];
  baseColorTexture?: GltfTextureInfo;
  // Default 1
  metallicFactor?: number;
  // Default 1
  roughnessFactor?: number;
  metallicRoughnessTexture?: GltfTextureInfo;
}

/** @internal */
export type GltfAlphaMode = "OPAQUE" | "MASK" | "BLEND";

/** @internal */
export interface Gltf2Material extends GltfChildOfRootProperty {
  pbrMetallicRoughness?: GltfMaterialPbrMetallicRoughness;
  normalTexture?: GltfTextureInfo;
  occlusionTexture?: unknown;
  emissiveTexture?: GltfTextureInfo;
  emissiveFactor?: number[];
  // Default OPAQUE
  alphaMode?: GltfAlphaMode;
  // Default 0.5. Ignored unless alphaMode=MASK
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

/** @internal */
export type GltfMaterial = Gltf1Material | Gltf2Material;

/** @internal */
export function isGltf1Material(material: GltfMaterial): material is Gltf1Material {
  const mat1 = material as Gltf1Material;
  return undefined !== mat1.technique || undefined !== mat1.values;
}

/** @internal */
export interface GltfBuffer extends GltfChildOfRootProperty {
  uri?: string;
  byteLength?: number;
}

/** @internal */
export interface GltfBufferViewProps extends GltfChildOfRootProperty {
  buffer: GltfId;
  byteLength?: number;
  byteOffset?: number;
  byteStride?: number;
  target?: GltfBufferTarget;
}

/** @internal */
export interface GltfAccessor extends GltfChildOfRootProperty {
  bufferView?: GltfId;
  byteOffset?: number;
  componentType?: GltfDataType.SignedByte | GltfDataType.UnsignedByte | GltfDataType.SignedShort | GltfDataType.UnsignedShort | GltfDataType.UInt32 | GltfDataType.Float;
  normalized?: boolean;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
  max?: number[];
  min?: number[];
  sparse?: unknown; // ###TODO sparse accessors
  extensions?: GltfExtensions & {
    /** Quantized attributes for glTF 1.0. Superceded by KHR_mesh_quantization. */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    WEB3D_quantized_attributes?: {
      decodedMin: number[];
      decodedMax: number[];
      /** Currently ignored. */
      decodeMatrix: number[];
    };
  };
}

/** @internal */
export namespace GltfStructuralMetadata {
  export type ClassPropertyType = "SCALAR" | "STRING" | "BOOLEAN" | "ENUM" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4" | string;
  export type ClassPropertyComponentType = "INT8" | "UINT8" | "INT16" | "UINT16" | "INT32" | "UINT32" | "INT64" | "UINT64" | "FLOAT32" | "FLOAT64" | string;

  // Ignoring VECN and MATN types because they complicate offset, scale, min, and max, all of which are otherwise only relevant to SCALAR in which case they're all just numbers.
  export interface ClassProperty extends GltfProperty {
    type: ClassPropertyType;
    name?: string;
    description?: string;
    componentType?: ClassPropertyComponentType;
    enumType?: string;
    array?: boolean;
    count?: number;
    normalized?: boolean;
    offset?: number;
    scale?: number;
    min?: number;
    max?: number;
    required?: boolean;
    noData?: unknown;
    default?: unknown;
    semantic?: string;
  }

  export interface EnumValue extends GltfProperty {
    name: string;
    value: number; // an integer
    description?: string;
  }

  export interface Enum extends GltfProperty {
    values: EnumValue[];
    // Default: UINT16
    valueType?: "INT8" | "UINT8" | "INT16" | "UINT16" | "INT32" | "UINT32" | "INT64" | "UINT64" | string;
    name?: string;
    description?: string;
  }

  export interface Class extends GltfProperty {
    name?: string;
    description?: string;
    properties?: {
      [propertyId: string]: ClassProperty | undefined;
    };
  }

  export interface Schema extends GltfProperty {
    id: string;
    name?: string;
    description?: string;
    version?: string;
    classes?: Class[];
    enums?: Enum[];
  }

  // Ignoring VECN and MATN types because they complicate offset, scale, min, and max, all of which are otherwise only relevant to SCALAR in which case they're all just numbers.
  export interface PropertyTableProperty extends GltfProperty {
    values: GltfId;
    arrayOffsets?: GltfId;
    stringOffsets?: GltfId;
    arrayOffsetType?: "UINT8" | "UINT16" | "UINT32" | "UINT64" | string;
    stringOffsetType?: "UINT8" | "UINT16" | "UINT32" | "UINT64" | string;
    offset?: number;
    scale?: number;
    min?: number;
    max?: number;
  }

  export interface PropertyTable {
    class: string;
    count: number;
    properties?: {
      [propertyId: string]: PropertyTableProperty | undefined;
    };
  }

  export interface Extension extends GltfProperty {
    // Exactly one of schema or schemaUri must be present.
    schemaUri?: string;
    schema?: Schema;
    propertyTables?: PropertyTable[];
    propertyTextures?: unknown;
    propertyAttributes?: unknown;
  }
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
export interface GltfDocument extends GltfProperty {
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EXT_structural_metadata?: GltfStructuralMetadata.Extension;
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

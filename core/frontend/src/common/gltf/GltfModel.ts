/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Transform, XAndY, XYAndZ } from "@itwin/core-geometry";
import { GltfAlphaMode } from "./GltfSchema";

/** Types describing the in-memory representation of a glTF model as parsed from a [[GltfDocument]].
 * This API is incomplete.
 * @internal
 */
export namespace Gltf {
  // A view into (usually a subset of) a GltfBuffer, used for vertex attributes and indices.
  // Attributes may be interleaved in which case they share the same Buffer object and the stride is specified on each Attribute.
  // The same Buffer object may also be used by more than one set of attributes or indices.
  export interface Buffer {
    data: Uint8Array;
  }

  export interface PositionQuantization {
    origin: XYAndZ;
    scale: XYAndZ;
  }

  export interface Attribute {
    buffer: Buffer;
    // Default zero.
    byteStride?: number;
  }

  export interface PositionAttribute extends Attribute {
    // If not "f32", the positions are quantized or normalized.
    componentType: "f32" | "u8" | "i8" | "u16" | "i16";
    quantization?: PositionQuantization;
    // Unquantized if quantization is defined.
    decodedMin: XYAndZ;
    decodedMax: XYAndZ;
  }

  export interface ColorAttribute extends Attribute {
    componentType: "f32" | "u8" | "u16";
  }

  export interface Indices {
    dataType: "u8" | "u16" | "u32";
    count: number;
    buffer: Buffer;
  }

  export type PrimitiveType = "triangles";

  export interface Primitive {
    indices: Indices;
    attributeCount: number;
    position: PositionAttribute;
    color?: ColorAttribute;
  }

  export interface TextureUVQuantization {
    origin: XAndY;
    scale: XAndY;
  }

  export interface NormalAttribute extends Attribute {
    // Always normalized.
    componentType: "f32" | "i8" | "i16";
  }

  export interface TextureUVAttribute extends Attribute {
    // If not "f32", the components are quantized or normalized.
    componentType: "f32" | "u8" | "u16" | "i8" | "i16";
    quantization?: TextureUVQuantization;
  }

  export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  export interface MetallicRoughness {
    baseColorFactor: Rgba;
    // ###TODO_GLTF baseColorTexture;
    metallicFactor: number;
    roughnessFactor: number;
    // ###TODO_GLTF metallicRoughnessTexture;
  }

  export interface Material {
    metallicRoughness: MetallicRoughness;
    alphaMode: GltfAlphaMode;
    alphaCutoff: number;
    doubleSided: boolean;
    // NB: a  mesh have normals defined but still be intended to be rendered without lighting.
    unlit: boolean;
  }

  export interface TrianglesPrimitive extends Primitive {
    type: "triangles";
    material: Material;
    normal?: NormalAttribute;
    textureUV?: TextureUVAttribute;
  }

  export type AnyPrimitive = TrianglesPrimitive;

  export interface Node {
    /** Transform from this node's local coordinate system to its parent node's coordinate system (or the model's coordinate system, if no parent node). */
    toParent?: Transform;
    /** The primitives drawn by this node. For glTF 2.0, there is exactly one primitive per node; glTF 1.0 permits any number of primitives per node. */
    primitives: AnyPrimitive[];
  }

  export interface Model {
    /** Transform from model coordinates to world coordinates. */
    toWorld?: Transform;
    nodes: Node[];
  }
}

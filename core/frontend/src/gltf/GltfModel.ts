/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Transform, XAndY, XYAndZ } from "@itwin/core-geometry";
import { GltfAlphaMode, GltfDocument } from "./GltfSchema";

export namespace Gltf {
  export type Buffer = Uint8Array;

  // If not "float", the positions are quantized or normalized.
  export type PositionComponentType = "float" | "u8" | "i8";

  export interface PositionQuantization {
    origin: XYAndZ;
    scale: XYAndZ;
    decodedMin: XYAndZ;
    decodedMax: XYAndZ;
  }

  export interface Attribute {
    buffer: Buffer;
  }

  export interface PositionAttribute extends Attribute {
    componentType: PositionComponentType;
    quantization?: PositionQuantization;
  }

  export type ColorComponentType = "float" | "u8" | "u16";

  export interface ColorAttribute extends Attribute {
    componentType: ColorComponentType;
  }

  export type IndexDataType = "u8" | "u16" | "u32";

  export interface Indices {
    dataType: IndexDataType;
    count: number;
    buffer: Buffer;
  }

  // If not "float", the components are quantized or normalized.
  export type TextureUVComponentType = "float" | "u8" | "u16" | "i8" | "i16";

  // If not "float", the components are normalized.
  export type NormalComponentType = "float" | "i8" | "i16";

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
    decodedMin: XAndY;
    decodedMax: XAndY;
  }

  export interface NormalAttribute extends Attribute {
    componentType: NormalComponentType;
  }

  export interface TextureUVAttribute extends Attribute {
    componentType: TextureUVComponentType;
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
    transform?: Transform;
    /** The primitives drawn by this node. For glTF 2.0, there is exactly one primitive per node; glTF 1.0 permits any number of primitives per node. */
    primitives: AnyPrimitive[];
  }

  export interface Model {
    transform?: Transform;
    nodes: Node[];
  }
}

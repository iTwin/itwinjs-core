/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-restricted-syntax */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Gltf {
  accessors: GltfAccessor[];
  asset: GltfAsset;
  buffers: GltfBuffer[];
  bufferViews: GltfBufferView[];
  textures?: GltfTexture[];
  images?: GltfImage[];
  materials: GltfMaterial[];
  samplers?: any[]; // Just use default sampler values
  meshes: GltfMesh[];
  nodes: GltfNode[];
  scenes: GltfScene[];
  scene: number;
}

const enum AccessorComponentType {
  UInt32 = 5125,
  Float = 5126,
}

interface GltfAccessor {
  bufferView: number;
  byteOffset: number;
  componentType: AccessorComponentType;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
  max?: number[];
  min?: number[];
}

interface GltfAsset {
  generator: string;
  version: string;
}

interface GltfBuffer {
  byteLength: number;
  uri: string;
}

const enum BufferViewTarget {
  ArrayBuffer = 34962,
  ElementArrayBuffer = 34963,
}

interface GltfBufferView {
  buffer: 0; // always the accompanying .bin file
  byteOffset: number;
  byteLength: number;
  byteStride?: number;
  target: BufferViewTarget;
}

interface GltfTexture {
  source: number;
  sampler: 0; // only one sampler for the whole model
}

interface GltfImage {
  uri: string;
}

interface GltfMaterial {
  alphaMode?: "BLEND";
  doubleSided: true;
  pbrMetallicRoughness: GltfMaterialPbrMetallicRoughness;
}

interface GltfMaterialPbrMetallicRoughness {
  baseColorTexture?: GltfBaseColorTexture;
  baseColorFactor: number[];
  metallicFactor: 0;  // Completely diffuse for now
  roughnessFactor: 1;
}

interface GltfBaseColorTexture {
  index: number;
}

interface GltfMesh {
  primitives: GltfMeshPrimitive[];
}

const enum MeshPrimitiveMode {
  GlLines = 1,
  GlTriangles = 4,
}

type GltfMeshAttributeName = "POSITION" | "NORMAL" | "TEXCOORD_0";

interface GltfMeshPrimitive {
  attributes: {
    [k in GltfMeshAttributeName]?: number;
  };
  indices: number;
  material: number;
  mode: MeshPrimitiveMode;
}

interface GltfNode {
  mesh: number;
  name: string;
  rotation?: number[];
  scale?: number[];
  translation?: number[];
}

interface GltfScene {
  nodes: number[];
}

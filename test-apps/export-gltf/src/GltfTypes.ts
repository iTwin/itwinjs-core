/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
interface Gltf {
  accessors: GltfAccessor[];
  asset: GltfAsset;
  buffers: GltfBuffer[];
  bufferViews: GltfBufferView[];
  materials: GltfMaterial[];
  meshes: GltfMesh[];
  nodes: GltfNode[];
  scenes: GltfScene[];
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

interface GltfMaterial {
  alphaMode?: "BLEND";
  doubleSided: boolean;
  name?: string;
  pbrMetallicRoughness: GltfMaterialPbrMetallicRoughness;
}

interface GltfMaterialPbrMetallicRoughness {
  baseColorFactor: number[];
  metallicFactor: number;
  roughnessFactor: number;
}

interface GltfMesh {
  primitives: GltfMeshPrimitive[];
}

const enum MeshPrimitiveMode {
  GlLines = 1,
  GlTriangles = 4,
}

interface GltfMeshPrimitive {
  attributes: {
    [k: string]: number;
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

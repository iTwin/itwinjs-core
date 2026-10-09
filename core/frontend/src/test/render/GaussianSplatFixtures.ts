/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GltfAccessor, GltfBufferViewProps, GltfDocument, GltfMeshPrimitive } from "../../common/gltf/GltfSchema";
import { GaussianSplatSource } from "../../internal/render/GaussianSplatData";

/** Original, deterministic data for offline interoperability tests. @internal */
export function gaussianSplatFixture(count = 1, degree = 0): GaussianSplatSource {
  const positions = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const scales = new Float32Array(count * 3).fill(0.1);
  const opacities = new Float32Array(count).fill(0.8);
  const sh = new Float32Array(count * 48);
  for (let i = 0; i < count; i++) {
    positions.set([0.5, 0.5, 0.5], i * 3);
    rotations[i * 4 + 3] = 1;
    sh.set([0.5 / 0.2820947917738781, -0.5 / 0.2820947917738781, -0.5 / 0.2820947917738781], i * 48);
  }

  return { positions, rotations, scales, opacities, sh, shDegree: degree, colorSpace: "srgb_rec709_display" };
}

/** GLB uses actual binary accessors, so tests exercise the same reader path as reality tiles. @internal */
export function gaussianSplatGlb(source = gaussianSplatFixture()): Uint8Array {
  const accessors: GltfAccessor[] = [];
  const views: GltfBufferViewProps[] = [];
  const arrays: Float32Array[] = [];
  const attributes: { [name: string]: number } = {};
  let byteLength = 0;
  const attribute = (name: string, array: Float32Array, type: GltfAccessor["type"]) => {
    attributes[name] = accessors.length;
    accessors.push({ bufferView: views.length, componentType: 5126, count: source.opacities.length, type });
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: array.byteLength });
    arrays.push(array);
    byteLength += array.byteLength;
  };
  attribute("POSITION", source.positions, "VEC3");
  attribute("KHR_gaussian_splatting:ROTATION", source.rotations, "VEC4");
  attribute("KHR_gaussian_splatting:SCALE", source.scales, "VEC3");
  attribute("KHR_gaussian_splatting:OPACITY", source.opacities, "SCALAR");
  let coefficient = 0;
  for (let degree = 0; degree <= source.shDegree; degree++)
    for (let c = 0; c < 2 * degree + 1; c++, coefficient++) {
      const values = new Float32Array(source.opacities.length * 3);
      for (let i = 0; i < source.opacities.length; i++)
        values.set(source.sh.subarray(i * 48 + coefficient * 3, i * 48 + coefficient * 3 + 3), i * 3);

      attribute(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${c}`, values, "VEC3");
    }

  const primitive: GltfMeshPrimitive = { mode: 0, attributes, extensions: { ["KHR_gaussian_splatting"]: { kernel: "ellipse", colorSpace: source.colorSpace } } };
  const document = {
    asset: { version: "2.0" }, buffers: [{ byteLength }], bufferViews: views, accessors,
    meshes: [{ primitives: [primitive] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    extensionsUsed: ["KHR_gaussian_splatting"], extensionsRequired: ["KHR_gaussian_splatting"],
  } as unknown as GltfDocument;
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = (json.length + 3) & ~3;
  const out = new Uint8Array(12 + 8 + jsonLength + 8 + byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + jsonLength);
  out.set(json, 20);
  dv.setUint32(20 + jsonLength, byteLength, true);
  dv.setUint32(24 + jsonLength, 0x004e4942, true);
  let offset = 28 + jsonLength;
  for (const array of arrays) {
    out.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset);
    offset += array.byteLength;
  }

  return out;
}

/** Known SPZ 2 quantized payload, independently assembled from the SPZ byte layout. @internal */
export async function gaussianSplatSpz(degree = 1): Promise<Uint8Array> {
  const higher = ((degree + 1) ** 2 - 1) * 3;
  const bytes = new Uint8Array(16 + 9 + 1 + 3 + 3 + 3 + higher);
  const dv = new DataView(bytes.buffer);
  dv.setUint32(0, 0x5053474e, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, 1, true);
  bytes[12] = degree;
  bytes[13] = 12;
  for (let c = 0; c < 3; c++) {
    const value = (c + 1) * 4096;
    bytes[16 + c * 3] = value & 255;
    bytes[17 + c * 3] = (value >>> 8) & 255;
    bytes[18 + c * 3] = (value >>> 16) & 255;
  }

  bytes[25] = 128; // activated alpha = 128/255
  bytes.set([140, 128, 116], 26); // DC coefficients are ((byte/255)-0.5)/0.15
  bytes.set([160, 160, 160], 29); // log scale = 160/16 - 10 = 0
  bytes.set([128, 128, 128], 32);
  for (let i = 0; i < higher; i++)
    bytes[35 + i] = 129 + i % 16;

  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

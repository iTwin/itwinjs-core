/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expectDefined } from "@itwin/core-bentley";
import { Geometry } from "@itwin/core-geometry";
import { GltfAccessor, GltfBufferViewProps, GltfMeshPrimitive } from "../../common/gltf/GltfSchema";
import {
  decodeGaussianSplatScale, decodeGaussianSplatShScale, decodeGaussianSplatSnorm, gaussianSplatCodes, GaussianSplatData, GaussianSplatDecodeRequest,
  gaussianSplatShCoefficients, GaussianSplatSource, gaussianSplatStride, readGaussianSplatSource,
} from "../../internal/render/GaussianSplatData";
import { GltfReaderProps } from "../../tile/internal";

const shC0 = 0.2820947917738781;

/** Original, deterministic splats: red, at (0.5, 0.5, 0.5), unrotated. */
export function gaussianSplatFixture(count = 1, degree = 0): GaussianSplatSource {
  const positions = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const scales = new Float32Array(count * 3).fill(0.1);
  const opacities = new Float32Array(count).fill(0.8);
  const sh = new Float32Array(count * 48);
  for (let i = 0; i < count; i++) {
    positions.set([0.5, 0.5, 0.5], i * 3);
    rotations[i * 4 + 3] = 1;
    sh.set([0.5 / shC0, -0.5 / shC0, -0.5 / shC0], i * 48);
  }

  return { positions, rotations, scales, opacities, sh, shDegree: degree, colorSpace: "srgb_rec709_display" };
}

/** A GLB holding `document` and, as its binary chunk, `binary`. */
function glb(document: object, binary: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = (json.length + 3) & ~3;
  const binaryLength = (binary.length + 3) & ~3;
  const out = new Uint8Array(28 + jsonLength + binaryLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.fill(32, 20, 20 + jsonLength);
  out.set(json, 20);
  view.setUint32(20 + jsonLength, binaryLength, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true); // "BIN"
  out.set(binary, 28 + jsonLength);
  return out;
}

/** A glTF document with one node drawing `primitive`, whose data is in one buffer of `byteLength` bytes. */
function splatDocument(primitive: GltfMeshPrimitive, accessors: GltfAccessor[], bufferViews: GltfBufferViewProps[], byteLength: number, extensions: string[]) {
  return {
    asset: { version: "2.0" }, buffers: [{ byteLength }], bufferViews, accessors,
    meshes: [{ primitives: [primitive] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    extensionsUsed: extensions, extensionsRequired: extensions,
  };
}

/** A GLB of `source` in KHR_gaussian_splatting's ratified layout, with plain float attributes. */
export function gaussianSplatGlb(source = gaussianSplatFixture()): Uint8Array {
  const count = source.opacities.length;
  const accessors: GltfAccessor[] = [];
  const views: GltfBufferViewProps[] = [];
  const arrays: Float32Array[] = [];
  const attributes: { [name: string]: number } = {};
  let byteLength = 0;
  const attribute = (name: string, array: Float32Array, type: GltfAccessor["type"]) => {
    attributes[name] = accessors.length;
    accessors.push({ bufferView: views.length, componentType: 5126, count, type });
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: array.byteLength });
    arrays.push(array);
    byteLength += array.byteLength;
  };

  attribute("POSITION", source.positions, "VEC3");
  attribute("KHR_gaussian_splatting:ROTATION", source.rotations, "VEC4");
  attribute("KHR_gaussian_splatting:SCALE", source.scales, "VEC3");
  attribute("KHR_gaussian_splatting:OPACITY", source.opacities, "SCALAR");
  let coefficient = 0;
  for (let degree = 0; degree <= source.shDegree; degree++) {
    for (let band = 0; band < 2 * degree + 1; band++, coefficient++) {
      const values = new Float32Array(count * 3);
      for (let i = 0; i < count; i++)
        values.set(source.sh.subarray(i * 48 + coefficient * 3, i * 48 + coefficient * 3 + 3), i * 3);

      attribute(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${band}`, values, "VEC3");
    }
  }

  const binary = new Uint8Array(byteLength);
  arrays.forEach((array, index) => binary.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), views[index].byteOffset));

  const primitive: GltfMeshPrimitive = { mode: 0, attributes, extensions: { ["KHR_gaussian_splatting"]: { kernel: "ellipse", colorSpace: source.colorSpace } } };
  return glb(splatDocument(primitive, accessors, views, byteLength, ["KHR_gaussian_splatting"]), binary);
}

/** A GLB of an SPZ payload in Cesium ion's draft layout: COLOR_0, no degree-0 SH attribute, and neither kernel nor color space. */
export function gaussianSplatDraftGlb(spz: Uint8Array, count: number, shDegree: number): Uint8Array {
  const names = ["POSITION", "COLOR_0", "KHR_gaussian_splatting:ROTATION", "KHR_gaussian_splatting:SCALE"];
  for (let degree = 1; degree <= shDegree; degree++)
    for (let band = 0; band < 2 * degree + 1; band++)
      names.push(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${band}`);

  // The values are only in the SPZ payload; the accessors declare the count.
  const accessors: GltfAccessor[] = names.map(() => ({ componentType: 5126, count, type: "VEC4" }));
  const attributes = Object.fromEntries(names.map((name, index) => [name, index]));
  const compression = { ["KHR_gaussian_splatting_compression_spz_2"]: { bufferView: 0 } };
  const primitive: GltfMeshPrimitive = { mode: 0, attributes, extensions: { ["KHR_gaussian_splatting"]: { extensions: compression } } };
  const extensions = ["KHR_gaussian_splatting", "KHR_gaussian_splatting_compression_spz_2"];
  return glb(splatDocument(primitive, accessors, [{ buffer: 0, byteLength: spz.length }], spz.length, extensions), spz);
}

/** The decode request the glTF reader makes for the first primitive of a GLB. */
export function readGaussianSplatGlb(bytes: Uint8Array): GaussianSplatDecodeRequest {
  const props = expectDefined(GltfReaderProps.create(bytes, true));
  const document = props.glTF;
  const primitive = expectDefined(document.meshes?.[0]?.primitives?.[0]);
  const buffers = { 0: { ...expectDefined(document.buffers?.[0]), resolvedBuffer: props.binaryData } };
  return readGaussianSplatSource(primitive, document, buffers, expectDefined(document.bufferViews));
}

/** An SPZ payload of one splat with an identity rotation, assembled byte by byte from the SPZ layout, independently of the decoder.
 * Its header declares `count` splats.
 */
export async function gaussianSplatSpz(degree = 1, count = 1, version: 2 | 3 = 2): Promise<Uint8Array> {
  const higher = ((degree + 1) ** 2 - 1) * 3;
  const rotationBytes = version === 3 ? 4 : 3;
  const bytes = new Uint8Array(16 + 9 + 1 + 3 + 3 + rotationBytes + higher);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x5053474e, true);
  view.setUint32(4, version, true);
  view.setUint32(8, count, true);
  bytes[12] = degree;
  bytes[13] = 12; // Fractional bits of the 24-bit fixed-point position.
  for (let axis = 0; axis < 3; axis++) {
    const position = (axis + 1) * 4096;
    bytes.set([position & 255, (position >>> 8) & 255, (position >>> 16) & 255], 16 + axis * 3);
  }

  bytes[25] = 128; // activated alpha = 128/255
  bytes.set([140, 128, 116], 26); // DC coefficients are ((byte/255)-0.5)/0.15
  bytes.set([160, 160, 160], 29); // log scale = 160/16 - 10 = 0
  // Identity: x, y and z zero; SPZ 3 also marks w as the largest component.
  bytes.set(version === 3 ? [0, 0, 0, 0xc0] : [128, 128, 128], 32);
  for (let i = 0; i < higher; i++)
    bytes[32 + rotationBytes + i] = 129 + i % 16;

  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** CPU reference decoder of a packed splat, matching the vertex shader. Covariance is xx, xy, xz, yy, yz, zz. */
export function unpackGaussianSplat(data: Uint32Array, index: number) {
  const { colorZero, colorStep, opacityMax } = gaussianSplatCodes;
  const offset = index * gaussianSplatStride;
  const rotationWord0 = data[offset + 3], rotationWord1 = data[offset + 4];
  const scaleWord = data[offset + 5], scaleColorWord = data[offset + 6], colorOpacityWord = data[offset + 7];

  const quantized = [rotationWord0 & 0xffff, rotationWord0 >>> 16, rotationWord1 & 0xffff, rotationWord1 >>> 16].map(decodeGaussianSplatSnorm);
  const norm = Geometry.hypotenuseXYZW(quantized[0], quantized[1], quantized[2], quantized[3]) || 1;
  const [x, y, z, w] = quantized.map((component) => component / norm);

  const scale = [scaleWord & 0xffff, scaleWord >>> 16, scaleColorWord & 0xffff].map(decodeGaussianSplatScale);
  const dc = [(scaleColorWord >>> 16) & 0xfff, colorOpacityWord & 0xfff, (colorOpacityWord >>> 12) & 0xfff].map((code) => (code - colorZero) / colorStep);
  const opacityCode = (scaleColorWord >>> 28) | ((colorOpacityWord >>> 24) << 4);

  // Covariance R S^2 R^T, with the rotation matrix R in row-major order.
  const rotation = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
  const covariance = (row: number, column: number) => rotation[row * 3] * rotation[column * 3] * scale[0] ** 2
    + rotation[row * 3 + 1] * rotation[column * 3 + 1] * scale[1] ** 2
    + rotation[row * 3 + 2] * rotation[column * 3 + 2] * scale[2] ** 2;

  return {
    dc,
    opacity: opacityCode / opacityMax,
    covariance: [covariance(0, 0), covariance(0, 1), covariance(0, 2), covariance(1, 1), covariance(1, 2), covariance(2, 2)],
  };
}

/** CPU reference decoder of a packed splat's higher SH coefficients, matching the vertex shader. */
export function unpackGaussianSplatSh(splats: Pick<GaussianSplatData, "sh" | "count" | "shDegree">, index: number): number[] {
  const wordsPerSplat = splats.sh.length / splats.count;
  const numCoefficients = gaussianSplatShCoefficients(splats.shDegree);
  const byteAt = (byteIndex: number) => (splats.sh[index * wordsPerSplat + (byteIndex >> 2)] >>> ((byteIndex & 3) * 8)) & 255;

  return Array.from({ length: numCoefficients }, (_, coefficient) => {
    // Each band's exponent byte follows the coefficient bytes, in band order.
    const band = Math.floor(Math.sqrt(Math.floor(coefficient / 3) + 1));
    return (byteAt(coefficient) - 128) * decodeGaussianSplatShScale(byteAt(numCoefficients + band - 1));
  });
}

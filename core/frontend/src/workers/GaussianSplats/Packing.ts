/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";
import {
  checkGaussianSplatDecodeLimits, decodeGaussianSplatScale, decodeGaussianSplatShScale, decodeGaussianSplatSnorm, encodeGaussianSplatColor,
  encodeGaussianSplatOpacity, encodeGaussianSplatScale, GaussianSplatData, gaussianSplatShCoefficients, gaussianSplatShGridExponent,
  gaussianSplatShTexels, GaussianSplatSource, gaussianSplatStride,
} from "../../internal/render/GaussianSplatData";
import { gaussianSplatError } from "../../internal/render/GaussianSplatError";

function snorm16(value: number): number {
  return Math.round(Math.max(-1, Math.min(1, value)) * 32767) & 0xffff;
}

/** The SH byte step of each exponent code. */
const shSteps = Float64Array.from({ length: 256 }, (_, code) => decodeGaussianSplatShScale(code));

/** Exponent code for one splat's SH band `values[start, end)`. A band already on SPZ's (byte - 128) / 128
 * grid keeps it exactly; otherwise the smallest step 2^(code/8 - 24) that holds the band's largest
 * magnitude in 127 steps, so each coefficient is within half a step (at most 0.43% of that magnitude).
 */
function shBandExponent(values: Float32Array, start: number, end: number): number {
  let largest = 0, onGrid = true;
  for (let k = start; k < end; k++) {
    const value = values[k];
    largest = Math.max(largest, Math.abs(value));
    const gridValue = value * 128;
    onGrid &&= gridValue === Math.round(gridValue) && gridValue >= -128 && gridValue <= 127;
  }

  if (onGrid)
    return gaussianSplatShGridExponent;

  // Estimate the code from the logarithm, then correct the estimate's rounding.
  let code = Math.max(0, Math.min(255, Math.ceil(8 * Math.log2(largest / 127)) + 192));
  while (code > 0 && largest <= 127 * shSteps[code - 1])
    code--;
  while (code < 255 && largest > 127 * shSteps[code])
    code++;

  return code;
}

/** Pack normalized splats into the compact layout described by [[GaussianSplatData]] and derive a
 * conservative three-sigma local range from the packed (quantized) values.
 * @internal
 */
export function packGaussianSplats(source: GaussianSplatSource): GaussianSplatData {
  const { positions, rotations, scales, opacities, sh: sourceSh, shDegree } = source;
  const count = opacities.length;
  const sourceShStride = sourceSh.length / count;
  const validLengths = count > 0 && positions.length === count * 3 && rotations.length === count * 4 && scales.length === count * 3
    && (sourceShStride === 48 || sourceShStride === (shDegree + 1) ** 2 * 3);
  if (!validLengths || !Number.isInteger(shDegree) || shDegree < 0 || shDegree > 3)
    gaussianSplatError("invalid decoded array lengths");

  // The source arrays exist; bound the packed output before allocating it.
  checkGaussianSplatDecodeLimits(count, shDegree, 0);

  const positionMin = [Infinity, Infinity, Infinity];
  const positionMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const position = positions[i * 3 + axis];
      if (!Number.isFinite(position))
        gaussianSplatError("non-finite mean");

      positionMin[axis] = Math.min(positionMin[axis], position);
      positionMax[axis] = Math.max(positionMax[axis], position);
    }
  }

  const origin: GaussianSplatData["origin"] = [
    (positionMin[0] + positionMax[0]) / 2, (positionMin[1] + positionMax[1]) / 2, (positionMin[2] + positionMax[2]) / 2,
  ];

  for (let i = 0; i < count * sourceShStride; i++)
    if (!Number.isFinite(sourceSh[i]))
      gaussianSplatError("non-finite covariance or spherical harmonic");

  const higherCoefficients = gaussianSplatShCoefficients(shDegree);
  const shWords = gaussianSplatShTexels(shDegree) * 4;
  const sh = new Uint32Array(count * shWords);
  const data = new Uint32Array(count * gaussianSplatStride);
  const floats = new Float32Array(data.buffer);

  // The bounds start from the means' range and grow by each splat's extent.
  const boundsMin = [positionMin[0], positionMin[1], positionMin[2]];
  const boundsMax = [positionMax[0], positionMax[1], positionMax[2]];

  // Measured hot loop: helpers are inlined by hand, because extracting them stopped V8 inlining and slowed packing by 3-7%.
  for (let i = 0; i < count; i++) {
    const offset = i * gaussianSplatStride;
    const opacity = opacities[i];
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
      gaussianSplatError("opacity must be in [0, 1]");

    const norm = Geometry.hypotenuseXYZW(rotations[i * 4], rotations[i * 4 + 1], rotations[i * 4 + 2], rotations[i * 4 + 3]);
    if (!Number.isFinite(norm) || norm < 1e-10 || Math.abs(norm - 1) > 0.01)
      gaussianSplatError("rotation must be a unit xyzw quaternion");

    const scaleX = scales[i * 3], scaleY = scales[i * 3 + 1], scaleZ = scales[i * 3 + 2];
    if (!(scaleX >= 0 && scaleY >= 0 && scaleZ >= 0 && scaleX < Infinity && scaleY < Infinity && scaleZ < Infinity))
      gaussianSplatError("scale must be finite and nonnegative");

    for (let axis = 0; axis < 3; axis++)
      floats[offset + axis] = positions[i * 3 + axis] - origin[axis];

    data[offset + 3] = snorm16(rotations[i * 4] / norm) | (snorm16(rotations[i * 4 + 1] / norm) << 16);
    data[offset + 4] = snorm16(rotations[i * 4 + 2] / norm) | (snorm16(rotations[i * 4 + 3] / norm) << 16);
    const opacityCode = encodeGaussianSplatOpacity(opacity);
    const shOffset = i * sourceShStride;
    const scaleCodeX = encodeGaussianSplatScale(scaleX), scaleCodeY = encodeGaussianSplatScale(scaleY), scaleCodeZ = encodeGaussianSplatScale(scaleZ);
    data[offset + 5] = scaleCodeX | (scaleCodeY << 16);
    data[offset + 6] = (scaleCodeZ | (encodeGaussianSplatColor(sourceSh[shOffset]) << 16) | ((opacityCode & 15) << 28)) >>> 0;
    data[offset + 7] = (encodeGaussianSplatColor(sourceSh[shOffset + 1]) | (encodeGaussianSplatColor(sourceSh[shOffset + 2]) << 12) | ((opacityCode >>> 4) << 24)) >>> 0;

    // Bounds use exactly what the vertex shader reconstructs: the diagonal of
    // R S^2 R^T from the quantized rotation and scales, without per-splat allocation.
    const quantizedX = decodeGaussianSplatSnorm(data[offset + 3] & 0xffff), quantizedY = decodeGaussianSplatSnorm(data[offset + 3] >>> 16);
    const quantizedZ = decodeGaussianSplatSnorm(data[offset + 4] & 0xffff), quantizedW = decodeGaussianSplatSnorm(data[offset + 4] >>> 16);
    const quantizedNorm = Geometry.hypotenuseXYZW(quantizedX, quantizedY, quantizedZ, quantizedW) || 1;
    const x = quantizedX / quantizedNorm, y = quantizedY / quantizedNorm, z = quantizedZ / quantizedNorm, w = quantizedW / quantizedNorm;
    const varianceX = decodeGaussianSplatScale(scaleCodeX) ** 2, varianceY = decodeGaussianSplatScale(scaleCodeY) ** 2, varianceZ = decodeGaussianSplatScale(scaleCodeZ) ** 2;
    for (let axis = 0; axis < 3; axis++) {
      // Row `axis` of the rotation matrix.
      const r0 = axis === 0 ? 1 - 2 * (y * y + z * z) : axis === 1 ? 2 * (x * y + z * w) : 2 * (x * z - y * w);
      const r1 = axis === 0 ? 2 * (x * y - z * w) : axis === 1 ? 1 - 2 * (x * x + z * z) : 2 * (y * z + x * w);
      const r2 = axis === 0 ? 2 * (x * z + y * w) : axis === 1 ? 2 * (y * z - x * w) : 1 - 2 * (x * x + y * y);
      const extent = 3 * Math.sqrt(r0 * r0 * varianceX + r1 * r1 * varianceY + r2 * r2 * varianceZ);
      const position = floats[offset + axis];
      if (!Number.isFinite(extent) || !Number.isFinite(position))
        gaussianSplatError("non-finite covariance or spherical harmonic");

      boundsMin[axis] = Math.min(boundsMin[axis], position + origin[axis] - extent);
      boundsMax[axis] = Math.max(boundsMax[axis], position + origin[axis] + extent);
    }

    // Higher SH bands: a byte per coefficient with a per-splat, per-band exponent in the texel padding.
    const higherOffset = shOffset + 3;
    for (let band = 1; band <= shDegree; band++) {
      const first = (band * band - 1) * 3, last = ((band + 1) * (band + 1) - 1) * 3;
      const exponent = shBandExponent(sourceSh, higherOffset + first, higherOffset + last);
      const step = shSteps[exponent];
      for (let k = first; k < last; k++) {
        const code = Math.max(0, Math.min(255, Math.round(sourceSh[higherOffset + k] / step) + 128));
        sh[i * shWords + (k >> 2)] |= code << ((k & 3) * 8);
      }

      const exponentByte = higherCoefficients + band - 1;
      sh[i * shWords + (exponentByte >> 2)] |= exponent << ((exponentByte & 3) * 8);
    }
  }

  return {
    data,
    sh,
    sortingMethod: source.sortingMethod,
    count,
    origin,
    bounds: [...boundsMin, ...boundsMax] as GaussianSplatData["bounds"],
    shDegree,
    colorSpace: source.colorSpace,
    antialiased: source.antialiased,
  };
}

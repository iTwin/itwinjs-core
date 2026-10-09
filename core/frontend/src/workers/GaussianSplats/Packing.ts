/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";
import { GaussianSplatData, gaussianSplatError, GaussianSplatSource, gaussianSplatStride } from "../../internal/render/GaussianSplatData";
import { generateGaussianSplatTexture } from "./Wasm";

/** Pack normalized splats and derive a conservative three-sigma local range.
 * @internal
 */
export function packGaussianSplats(source: GaussianSplatSource): GaussianSplatData {
  const count = source.opacities.length;
  const sourceStride = source.sh.length / count;
  if (!count || source.positions.length !== count * 3 || source.rotations.length !== count * 4 || source.scales.length !== count * 3 ||
    (sourceStride !== 48 && sourceStride !== (source.shDegree + 1) ** 2 * 3) || !Number.isInteger(source.shDegree) || source.shDegree < 0 || source.shDegree > 3)
    gaussianSplatError("invalid decoded array lengths");

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++)
    for (let c = 0; c < 3; c++) {
      const p = source.positions[i * 3 + c];
      if (!Number.isFinite(p))
        gaussianSplatError("non-finite mean");

      min[c] = Math.min(min[c], p);
      max[c] = Math.max(max[c], p);
    }

  const origin: GaussianSplatData["origin"] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  // Bound the input + output + WASM copies before allocating. A single giant tile
  // cannot participate in bounded residency; producers must split it.
  if (count > 2 * 1024 * 1024 || count * (sourceStride * 8 + 160) > 512 * 1024 * 1024)
    gaussianSplatError("tile exceeds the packing memory limit; split it into smaller tiles");
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Uint8Array(count * 4);
  const covarianceData = new Float32Array(count * 6);
  const exponents = new Float32Array(count);
  let needsPrecision = false;
  let needsAppearance = false;
  const appearance = new Float32Array(count * 4);
  const coefficientsPerSplat = source.shDegree > 0 ? (source.shDegree + 1) ** 2 * 3 : 0;
  const sh = new Float32Array(count * coefficientsPerSplat);
  for (let i = 0; i < count; i++) {
    const o = i * 6;
    const opacity = source.opacities[i];
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
      gaussianSplatError("opacity must be in [0, 1]");

    colors[i * 4 + 3] = Math.round(opacity * 255);
    const q = source.rotations.subarray(i * 4, i * 4 + 4);
    const norm = Geometry.hypotenuseXYZW(q[0], q[1], q[2], q[3]);
    if (!Number.isFinite(norm) || norm < 1e-10 || Math.abs(norm - 1) > 0.01)
      gaussianSplatError("rotation must be a unit xyzw quaternion");

    const [x, y, z, w] = Array.from(q, (v) => v / norm);
    const r = [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w),
      2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w),
      2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)];
    const s = source.scales.subarray(i * 3, i * 3 + 3);
    if (s.some((v) => !Number.isFinite(v) || v < 0))
      gaussianSplatError("scale must be finite and nonnegative");

    const covariance = (a: number, b: number) => r[a*3] * r[b*3] * s[0]*s[0] + r[a*3+1] * r[b*3+1] * s[1]*s[1] + r[a*3+2] * r[b*3+2] * s[2]*s[2];
    covarianceData.set([covariance(0, 0), covariance(0, 1), covariance(0, 2), covariance(1, 1), covariance(1, 2), covariance(2, 2)], o);
    const largest = Math.max(...s);
    const smallest = Math.min(...s);
    // A power-of-two scale preserves mantissas. Half covariance's rounding error
    // is bounded by 2^-10 of the largest axis; use float covariance for anisotropy.
    const exponent = largest > 0 ? Math.floor(Math.log2(largest)) : 0;
    exponents[i] = exponent * 2;
    const normalization = 2 ** -exponent;
    needsPrecision ||= largest > 0 && (smallest / largest < 0.32 || Math.abs(exponent * 2) > 120);
    for (let c = 0; c < 3; c++)
      scales[i * 3 + c] = s[c] * normalization;
    rotations.set([x, y, z, w], i * 4);
    for (let c = 0; c < 3; c++) {
      const p = source.positions[i * 3 + c];
      const extent = 3 * Math.sqrt(covariance(c, c));
      positions[i * 3 + c] = p - origin[c];
      min[c] = Math.min(min[c], p - extent);
      max[c] = Math.max(max[c], p + extent);
    }

    const coefficients = source.sh.subarray(i * sourceStride, (i + 1) * sourceStride);
    if (coefficients.some((v) => !Number.isFinite(v)) || covarianceData.subarray(o, o + 6).some((v) => !Number.isFinite(v)) || positions.subarray(i * 3, i * 3 + 3).some((v) => !Number.isFinite(v)))
      gaussianSplatError("non-finite covariance or spherical harmonic");

    for (let c = 0; c < 3; c++)
      colors[i * 4 + c] = Math.round(Math.max(0, Math.min(1, 0.5 + 0.2820947917738781 * coefficients[c])) * 255);
    for (let c = 0; c < 4; c++) {
      const value = c === 3 ? opacity : 0.5 + 0.2820947917738781 * coefficients[c];
      appearance[i * 4 + c] = value;
      needsAppearance ||= Math.fround(value) !== Math.fround(colors[i * 4 + c] / 255);
    }
    sh.set(coefficients.subarray(0, coefficientsPerSplat), i * coefficientsPerSplat);
  }

  const data = generateGaussianSplatTexture(positions, scales, rotations, colors);
  const floats = new Float32Array(data.buffer);
  for (let i = 0; i < count; i++)
    floats[i * gaussianSplatStride + 3] = exponents[i];

  return { data, sh, appearance: needsAppearance ? appearance : undefined, covariance: needsPrecision ? covarianceData : undefined, sortingMethod: source.sortingMethod, count, origin, bounds: [...min, ...max] as GaussianSplatData["bounds"], shDegree: source.shDegree, colorSpace: source.colorSpace, antialiased: source.antialiased };
}

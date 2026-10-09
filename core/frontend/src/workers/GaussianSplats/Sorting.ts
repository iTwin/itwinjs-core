/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";
import { GaussianSplatSortRequest, gaussianSplatsPerPage } from "../../internal/render/GaussianSplatSort";
import { sortGaussianSplatKeys } from "./Wasm";

/** Global bounded scalar keys preserve cameraDistance for ratified content and depth for the
 * Cesium draft. Every occurrence contributes its own transformed keys and instance identity.
 * @internal
 */
export function sortGaussianSplats(request: GaussianSplatSortRequest, positions: ReadonlyMap<number, Float32Array>): Uint32Array {
  const count = request.tiles.reduce((sum, tile) => sum + tile.count, 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > 8 * 1024 * 1024)
    throw new Error("Gaussian splats: sort exceeds the worker memory limit");
  if (!count)
    return new Uint32Array();

  const depths = new Float64Array(count);
  const slots = new Uint32Array(count * 2);
  let minimum = Infinity, maximum = -Infinity, offset = 0;
  for (let t = 0; t < request.tiles.length; t++) {
    const tile = request.tiles[t];
    const p = positions.get(tile.id);
    if (!p || !Number.isSafeInteger(tile.count) || tile.count < 0 || p.length !== tile.count * 3)
      throw new Error("Gaussian splats: stale tile in sort request");
    const m = tile.transform;
    if (m.length !== 12 || m.some((v) => !Number.isFinite(v)) || tile.pages.length !== Math.ceil(tile.count / gaussianSplatsPerPage) || tile.pages.some((v) => !Number.isSafeInteger(v) || v < 0))
      throw new Error("Gaussian splats: invalid sort transform or pages");
    for (let i = 0; i < tile.count; i++, offset++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const ex = m[0]*x + m[1]*y + m[2]*z + m[3];
      const ey = m[4]*x + m[5]*y + m[6]*z + m[7];
      const ez = m[8]*x + m[9]*y + m[10]*z + m[11];
      const key = request.perspective && tile.sortingMethod !== "viewDepth" ? -Geometry.hypotenuseXYZ(ex, ey, ez) : ez;
      if (!Number.isFinite(key))
        throw new Error("Gaussian splats: non-finite sort key");
      depths[offset] = key;
      minimum = Math.min(minimum, key);
      maximum = Math.max(maximum, key);
      slots[offset * 2] = tile.pages[Math.floor(i / gaussianSplatsPerPage)] * gaussianSplatsPerPage + i % gaussianSplatsPerPage;
      slots[offset * 2 + 1] = t;
    }
  }
  // Keep both depth*4096 and the kernel's signed offset/subtraction in range.
  // [0, 65536] uses 28 bits; quantization ties retain occurrence/input order.
  const common = new Float32Array(count * 3);
  const span = maximum - minimum;
  for (let i = 0; i < count; i++)
    common[i * 3 + 2] = span > 0 ? ((depths[i] - minimum) / span) * 65536 : 0;
  const order = sortGaussianSplatKeys(common);
  // Quantization can merge distinct keys in a wide scene. Refine only colliding
  // bins whose original scalar order is inverted; equal keys remain stable.
  for (let start = 0; start < count;) {
    const bin = Math.trunc(common[order[start] * 3 + 2] * 4096);
    let end = start + 1, inverted = false;
    while (end < count && Math.trunc(common[order[end] * 3 + 2] * 4096) === bin) {
      inverted ||= depths[order[end - 1]] > depths[order[end]];
      end++;
    }
    if (inverted) order.subarray(start, end).sort((a, b) => depths[a] - depths[b]);
    start = end;
  }
  const result = new Uint32Array(count * 2);
  for (let i = 0; i < count; i++) {
    result[i * 2] = slots[order[i] * 2];
    result[i * 2 + 1] = slots[order[i] * 2 + 1];
  }
  return result;
}

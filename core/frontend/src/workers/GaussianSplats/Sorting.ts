/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";
import { GaussianSplatSortRequest, GaussianSplatSortTile, gaussianSplatsPerPage } from "../../internal/render/GaussianSplatSort";

/** Largest number of splats one sort accepts, bounding the worker's memory. */
const maxSortCount = 8 * 1024 * 1024;

/** Global bounded scalar keys preserve cameraDistance for KHR_gaussian_splatting content and depth for Cesium ion's draft
 * profile. Every occurrence contributes its own transformed keys. The result holds one logical slot per splat, back to front;
 * each occurrence owns its own logical page range, which identifies it.
 * @internal
 */
export function sortGaussianSplats(request: GaussianSplatSortRequest, positions: ReadonlyMap<number, Float32Array>): Uint32Array {
  const count = request.tiles.reduce((sum, tile) => sum + tile.count, 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > maxSortCount)
    throw new Error("Gaussian splats: sort exceeds the worker memory limit");
  if (!count)
    return new Uint32Array();

  const keys = new Float64Array(count);
  const slots = new Uint32Array(count);
  let minimum = Infinity, maximum = -Infinity, offset = 0;
  for (const tile of request.tiles) {
    const tilePositions = validTilePositions(tile, positions);
    const transform = tile.transform;
    const firstSlot = tile.firstPage * gaussianSplatsPerPage;
    const byCameraDistance = request.perspective && tile.sortingMethod !== "viewDepth";
    // Inlined, unlike the rest of the sort: this loop runs once per splat, and measured slower with helpers.
    for (let i = 0; i < tile.count; i++, offset++) {
      const x = tilePositions[i * 3], y = tilePositions[i * 3 + 1], z = tilePositions[i * 3 + 2];
      const eyeX = transform[0] * x + transform[1] * y + transform[2] * z + transform[3];
      const eyeY = transform[4] * x + transform[5] * y + transform[6] * z + transform[7];
      const eyeZ = transform[8] * x + transform[9] * y + transform[10] * z + transform[11];
      const key = byCameraDistance ? -Geometry.hypotenuseXYZ(eyeX, eyeY, eyeZ) : eyeZ;
      if (!Number.isFinite(key))
        throw new Error("Gaussian splats: non-finite sort key");

      keys[offset] = key;
      minimum = Math.min(minimum, key);
      maximum = Math.max(maximum, key);
      slots[offset] = firstSlot + i;
    }
  }

  const order = sortByKey(keys, minimum, maximum);
  const result = new Uint32Array(count);
  for (let i = 0; i < count; i++)
    result[i] = slots[order[i]];

  return result;
}

/** The registered sort positions of `tile`, checked against the request so that a stale request fails rather than misorders. */
function validTilePositions(tile: GaussianSplatSortTile, positions: ReadonlyMap<number, Float32Array>): Float32Array {
  const tilePositions = positions.get(tile.id);
  if (!tilePositions || !Number.isSafeInteger(tile.count) || tile.count < 0 || tilePositions.length !== tile.count * 3)
    throw new Error("Gaussian splats: stale tile in sort request");

  const { transform, firstPage } = tile;
  const validTransform = transform.length === 12 && transform.every((value) => Number.isFinite(value));
  const validPages = Number.isSafeInteger(firstPage) && firstPage >= 0 && firstPage * gaussianSplatsPerPage + tile.count <= 2 ** 32;
  if (!validTransform || !validPages)
    throw new Error("Gaussian splats: invalid sort transform or pages");

  return tilePositions;
}

const radixBits = 16;
const radixBuckets = 1 << radixBits;
const radixMask = radixBuckets - 1;

/** The indices of `keys` in ascending key order, equal keys in index order. The keys are quantized to 32-bit codes over their
 * range and ordered by two stable 16-bit counting passes; codes that quantization made equal are then ordered by exact key.
 */
function sortByKey(keys: Float64Array, minimum: number, maximum: number): Uint32Array {
  const count = keys.length;
  const span = maximum - minimum;
  const codeScale = span > 0 ? 0xffffffff / span : 0;
  const codes = new Uint32Array(count);
  const lowCounts = new Uint32Array(radixBuckets);
  const highCounts = new Uint32Array(radixBuckets);
  for (let i = 0; i < count; i++) {
    const code = ((keys[i] - minimum) * codeScale) >>> 0;
    codes[i] = code;
    lowCounts[code & radixMask]++;
    highCounts[code >>> radixBits]++;
  }

  toBucketStarts(lowCounts);
  toBucketStarts(highCounts);
  const byLowBits = new Uint32Array(count);
  for (let i = 0; i < count; i++)
    byLowBits[lowCounts[codes[i] & radixMask]++] = i;

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const index = byLowBits[i];
    order[highCounts[codes[index] >>> radixBits]++] = index;
  }

  orderEqualCodesByKey(order, codes, keys);
  return order;
}

/** Replace each bucket's count by the position of its first element. */
function toBucketStarts(counts: Uint32Array): void {
  let start = 0;
  for (let bucket = 0; bucket < counts.length; bucket++) {
    const bucketCount = counts[bucket];
    counts[bucket] = start;
    start += bucketCount;
  }
}

/** Distinct keys can share a code in a very wide scene. Re-sort, by their exact keys, only the runs of equal codes whose keys are
 * out of order; equal keys keep their order.
 */
function orderEqualCodesByKey(order: Uint32Array, codes: Uint32Array, keys: Float64Array): void {
  for (let start = 0; start < order.length;) {
    const code = codes[order[start]];
    let end = start + 1, inverted = false;
    while (end < order.length && codes[order[end]] === code) {
      inverted ||= keys[order[end - 1]] > keys[order[end]];
      end++;
    }

    if (inverted)
      order.subarray(start, end).sort((a, b) => keys[a] - keys[b]);

    start = end;
  }
}

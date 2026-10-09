/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** A visible occurrence of a tile. A tile can occur more than once with different transforms.
 * @internal
 */
export interface GaussianSplatSortTile {
  id: number;
  pages: number[];
  count: number;
  /** Row-major affine transform from relative means to eye coordinates, computed in double precision. */
  transform: number[];
}

/** @internal */
export interface GaussianSplatSortRequest {
  tiles: GaussianSplatSortTile[];
  perspective: boolean;
}

/** Number of splats in one shared GPU page. @internal */
export const gaussianSplatsPerPage = 16384;

/** Stable four-pass radix sort of positive floating point distance keys, far to near.
 * Returns pairs of GPU slot and visible tile index, ready for the instanced vertex buffer.
 * @internal
 */
export function sortGaussianSplats(request: GaussianSplatSortRequest, positions: ReadonlyMap<number, Float32Array>): Uint32Array {
  const count = request.tiles.reduce((sum, tile) => sum + tile.count, 0);
  let input = new Uint32Array(count);
  let output = new Uint32Array(count);
  const keys = new Uint32Array(count);
  const floats = new Float32Array(keys.buffer);
  const slots = new Uint32Array(count * 2);
  let offset = 0;
  for (let t = 0; t < request.tiles.length; t++) {
    const tile = request.tiles[t];
    const p = positions.get(tile.id);
    if (!p || p.length !== tile.count * 3)
      throw new Error("Gaussian splats: stale tile in sort request");

    const m = tile.transform;
    for (let i = 0; i < tile.count; i++, offset++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const ex = m[0]*x + m[1]*y + m[2]*z + m[3];
      const ey = m[4]*x + m[5]*y + m[6]*z + m[7];
      const ez = m[8]*x + m[9]*y + m[10]*z + m[11];
      // Nonnegative float bits preserve order. Complement for far-to-near sorting.
      floats[offset] = request.perspective ? Math.min(3e38, ex*ex + ey*ey + ez*ez) : Math.max(0, -ez);
      keys[offset] = ~keys[offset];
      input[offset] = offset;
      slots[offset * 2] = tile.pages[Math.floor(i / gaussianSplatsPerPage)] * gaussianSplatsPerPage + i % gaussianSplatsPerPage;
      slots[offset * 2 + 1] = t;
    }
  }

  const bins = new Uint32Array(256);
  for (let shift = 0; shift < 32; shift += 8) {
    bins.fill(0);
    for (const index of input)
      bins[(keys[index] >>> shift) & 255]++;

    let sum = 0;
    for (let b = 0; b < bins.length; b++) {
      const n = bins[b];
      bins[b] = sum;
      sum += n;
    }

    for (const index of input)
      output[bins[(keys[index] >>> shift) & 255]++] = index;

    [input, output] = [output, input];
  }

  const result = new Uint32Array(count * 2);
  for (let i = 0; i < count; i++) {
    result[i * 2] = slots[input[i] * 2];
    result[i * 2 + 1] = slots[input[i] * 2 + 1];
  }

  return result;
}

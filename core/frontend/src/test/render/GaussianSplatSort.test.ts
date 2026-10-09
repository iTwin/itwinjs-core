/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Geometry } from "@itwin/core-geometry";
import { GaussianSplatSortRequest, gaussianSplatsPerPage as page } from "../../internal/render/GaussianSplatSort";
import { sortGaussianSplats } from "../../workers/GaussianSplats/Sorting";

/** Tiles of random means in boxes spread across a wide scene; each tile spans several pages. */
function scene(tiles: number, perTile: number, extent: number) {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const positions = new Map<number, Float32Array>();
  const request: GaussianSplatSortRequest = { perspective: true, tiles: [] };
  let nextPage = 0;
  for (let t = 0; t < tiles; t++) {
    const p = new Float32Array(perTile * 3);
    for (let i = 0; i < p.length; i++)
      p[i] = (random() - 0.5) * 50;
    positions.set(t, p);
    const pages = Array.from({ length: Math.ceil(perTile / page) }, () => nextPage++);
    request.tiles.push({ id: t, count: perTile, pages, transform: [1,0,0,(random() - 0.5) * extent, 0,1,0,(random() - 0.5) * extent, 0,0,1,-100 - random() * extent] });
  }
  return { positions, request };
}

function eyePosition(request: GaussianSplatSortRequest, positions: Map<number, Float32Array>, slot: number, t: number): number[] {
  const tile = request.tiles[t];
  const p = positions.get(tile.id)!;
  const local = tile.pages.indexOf(Math.floor(slot / page)) * page + slot % page;
  const m = tile.transform;
  const [x, y, z] = [p[local * 3], p[local * 3 + 1], p[local * 3 + 2]];
  return [m[0]*x + m[1]*y + m[2]*z + m[3], m[4]*x + m[5]*y + m[6]*z + m[7], m[8]*x + m[9]*y + m[10]*z + m[11]];
}

describe("Gaussian splat sorting", () => {
  it("orders every occurrence back to front exactly once across pages and repeated tiles", () => {
    const { positions, request } = scene(6, page + 5000, 2000);
    // A second occurrence of tile 2 with a different transform contributes its own instances.
    request.tiles.push({ ...request.tiles[2], pages: request.tiles[2].pages.map((p) => p + 100), transform: [1,0,0,30, 0,1,0,0, 0,0,1,-500] });
    const count = request.tiles.reduce((n, tile) => n + tile.count, 0);
    for (const perspective of [true, false]) {
      request.perspective = perspective;
      const sorted = sortGaussianSplats(request, positions);
      expect(sorted.length).toBe(count * 2);
      const seen = new Set<number>();
      let previous = -Infinity;
      for (let i = 0; i < count; i++) {
        const slot = sorted[i * 2], t = sorted[i * 2 + 1];
        seen.add(t * 2 ** 24 + slot);
        const [x, y, z] = eyePosition(request, positions, slot, t);
        const key = perspective ? -Geometry.hypotenuseXYZ(x, y, z) : z;
        // 32-bit keys over this span resolve well below a millimetre.
        expect(key).toBeGreaterThanOrEqual(previous - 1e-3);
        previous = Math.max(previous, key);
      }
      expect(seen.size).toBe(count);
    }
  });

  it("returns an empty order and rejects non-finite keys", () => {
    expect(sortGaussianSplats({ perspective: true, tiles: [] }, new Map()).length).toBe(0);
    const positions = new Map([[1, new Float32Array([0, 0, NaN])]]);
    expect(() => sortGaussianSplats({ perspective: true, tiles: [{ id: 1, count: 1, pages: [0], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0] }] }, positions)).toThrow(/non-finite/);
  });
});

declare const ITWIN_GAUSSIAN_BENCHMARK_ENABLED: boolean;
it.skipIf(!ITWIN_GAUSSIAN_BENCHMARK_ENABLED)("benchmarks a two-million-splat camera-distance sort", () => {
  const { positions, request } = scene(40, 50_000, 2000);
  const samples: number[] = [];
  for (let i = 0; i < 16; i++) {
    // Move the eye slightly so each sample sorts a different order.
    request.tiles.forEach((tile) => tile.transform[3] += 0.25);
    const start = performance.now();
    sortGaussianSplats(request, positions);
    const ms = performance.now() - start;
    if (i >= 4) samples.push(ms);
  }
  const ordered = [...samples].sort((a, b) => a - b);
  // eslint-disable-next-line no-console -- Opt-in performance evidence.
  console.info("GAUSSIAN_SORT_BENCHMARK", JSON.stringify({ count: 2_000_000, tiles: 40, medianMs: ordered[6], p95Ms: ordered[11], samples }));
});

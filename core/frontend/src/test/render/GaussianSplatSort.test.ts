/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Geometry } from "@itwin/core-geometry";
import { GaussianSplatSortRequest, gaussianSplatsPerPage as page } from "../../internal/render/GaussianSplatSort";
import { sortGaussianSplats } from "../../workers/GaussianSplats/Sorting";

/** Tiles of random means in boxes spread across a wide scene; each tile spans several pages. */
function scene(numTiles: number, splatsPerTile: number, extent: number) {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const positions = new Map<number, Float32Array>();
  const request: GaussianSplatSortRequest = { perspective: true, tiles: [] };
  let nextPage = 0;
  for (let id = 0; id < numTiles; id++) {
    positions.set(id, Float32Array.from({ length: splatsPerTile * 3 }, () => (random() - 0.5) * 50));
    const translation = [(random() - 0.5) * extent, (random() - 0.5) * extent, -100 - random() * extent];
    request.tiles.push({ id, count: splatsPerTile, firstPage: nextPage, transform: [1,0,0,translation[0], 0,1,0,translation[1], 0,0,1,translation[2]] });
    nextPage += Math.ceil(splatsPerTile / page);
  }

  return { positions, request };
}

/** The index of the occurrence owning a logical slot: occurrences own disjoint logical page ranges. */
function occurrenceOf(request: GaussianSplatSortRequest, slot: number): number {
  return request.tiles.findIndex((tile) => slot >= tile.firstPage * page && slot < tile.firstPage * page + tile.count);
}

/** The eye-space position of the splat in a logical slot of an occurrence. */
function eyePosition(request: GaussianSplatSortRequest, positions: Map<number, Float32Array>, slot: number, occurrence: number): number[] {
  const tile = request.tiles[occurrence];
  const tilePositions = positions.get(tile.id)!;
  const index = slot - tile.firstPage * page;
  const [x, y, z] = tilePositions.subarray(index * 3, index * 3 + 3);
  const matrix = tile.transform;
  return [0, 4, 8].map((row) => matrix[row] * x + matrix[row + 1] * y + matrix[row + 2] * z + matrix[row + 3]);
}

describe("Gaussian splat sorting", () => {
  it("orders every occurrence back to front exactly once across pages and repeated tiles", () => {
    const { positions, request } = scene(6, page + 5000, 2000);
    // A second occurrence of tile 2 with a different transform contributes its own instances.
    request.tiles.push({ ...request.tiles[2], firstPage: 1000, transform: [1,0,0,30, 0,1,0,0, 0,0,1,-500] });
    const count = request.tiles.reduce((n, tile) => n + tile.count, 0);
    for (const perspective of [true, false]) {
      request.perspective = perspective;

      const sorted = sortGaussianSplats(request, positions);

      expect(sorted.length).toBe(count);
      expect(new Set(sorted).size).toBe(count);
      let previousKey = -Infinity;
      for (const slot of sorted) {
        const occurrence = occurrenceOf(request, slot);
        expect(occurrence).toBeGreaterThanOrEqual(0);
        const [x, y, z] = eyePosition(request, positions, slot, occurrence);
        const key = perspective ? -Geometry.hypotenuseXYZ(x, y, z) : z;
        // 32-bit keys over this span resolve well below a millimetre.
        expect(key).toBeGreaterThanOrEqual(previousKey - 1e-3);
        previousKey = Math.max(previousKey, key);
      }
    }
  });
});

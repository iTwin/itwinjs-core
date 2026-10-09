/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { remapSortedInstances } from "../../internal/render/GaussianSplatInstances";
import { gaussianSplatsPerPage as page } from "../../internal/render/GaussianSplatSort";

describe("Gaussian sorted instance remapping", () => {
  it("reuses the worker result when occurrence rows and page addresses match", () => {
    const instances = new Uint32Array([3 * page + 7, 1, page + 42, 0]);
    const before = [{ identity: "a", pages: [1, 2] }, { identity: "b", pages: [3] }];
    const after = before.map((tile) => ({ identity: tile.identity, pages: [...tile.pages] }));
    expect(remapSortedInstances(instances, before, after)).toBe(instances);
  });

  it("remaps compacted pages and reordered rows without changing depth order or input", () => {
    const instances = new Uint32Array([3 * page + 7, 1, 2 * page + 42, 0, page + 9, 0]);
    const before = [{ identity: "a", pages: [1, 2] }, { identity: "b", pages: [3] }];
    const after = [{ identity: "b", pages: [0] }, { identity: "a", pages: [4, 6] }];
    expect(remapSortedInstances(instances, before, after)).toEqual(new Uint32Array([7, 0, 6 * page + 42, 1, 4 * page + 9, 1]));
    expect(instances).toEqual(new Uint32Array([3 * page + 7, 1, 2 * page + 42, 0, page + 9, 0]));
  });

  it("filters hidden occurrences without confusing repeated geometry or duplicate identities", () => {
    const before = [{ identity: "a", pages: [1] }, { identity: "b", pages: [1] }, { identity: "a", pages: [1] }];
    const instances = new Uint32Array([page + 5, 2, page + 7, 1, page + 9, 0]);
    expect(remapSortedInstances(instances, before, [before[0], before[2]])).toEqual(new Uint32Array([page + 5, 1, page + 9, 0]));
    expect(remapSortedInstances(instances, before, [before[0]])).toEqual(new Uint32Array([page + 9, 0]));
    expect(remapSortedInstances(instances, before, [])).toEqual(new Uint32Array());
  });
});

// Keep this opt-in: measure real million-instance remapping without making routine
// correctness tests depend on timing or large allocations.
declare const ITWIN_GAUSSIAN_BENCHMARK_ENABLED: boolean;
it.skipIf(!ITWIN_GAUSSIAN_BENCHMARK_ENABLED)("benchmarks unchanged, translated and filtered instance mappings", () => {
  const count = 1_000_000;
  const instances = new Uint32Array(count * 2);
  const before = Array.from({ length: 4 }, (_tile, t) => ({ identity: String(t), pages: Array.from({ length: 16 }, (_page, p) => t * 16 + p) }));
  for (let i = 0; i < count; i++) {
    const tile = i % 4;
    instances[i * 2] = tile * 16 * page + Math.floor(i / 4);
    instances[i * 2 + 1] = tile;
  }
  const cases = [before.map((t) => ({ ...t, pages: [...t.pages] })), [...before].reverse().map((t) => ({ ...t, pages: t.pages.map((p) => p + 4) })), [before[0], before[2]]];
  const results = cases.map((after, c) => {
    const samples: number[] = [];
    for (let i = 0; i < 16; i++) {
      const start = performance.now();
      const result = remapSortedInstances(instances, before, after);
      const ms = performance.now() - start;
      expect(result.length).toBe(c === 2 ? count : count * 2);
      if (i >= 4) samples.push(ms);
    }
    const ordered = [...samples].sort((a, b) => a - b);
    return { name: ["unchanged", "translated", "filtered"][c], count, medianMs: ordered[6], p95Ms: ordered[11], samples };
  });
  // eslint-disable-next-line no-console -- Opt-in performance evidence.
  console.info("GAUSSIAN_INSTANCE_BENCHMARK", JSON.stringify(results));
});

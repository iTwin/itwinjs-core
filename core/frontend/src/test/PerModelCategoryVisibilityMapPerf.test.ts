/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { Viewport } from "../Viewport";
import { PerModelCategoryVisibility as oldImpl } from "../PerModelCategoryVisibilityOld";
import { PerModelCategoryVisibility as newImpl } from "../PerModelCategoryVisibility";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockViewport(subcatMap?: Map<string, Set<string>>) {
  return {
    setViewedCategoriesPerModelChanged: vi.fn(),
    iModel: {
      subcategories: {
        getSubCategories: (catId: string) => subcatMap?.get(catId),
      },
    },
    subcategories: {
      push: vi.fn(),
    },
  } as unknown as Viewport;
}

/** Create one old and one new override instance, each backed by its own mock viewport. */
function createBoth(subcatMap?: Map<string, Set<string>>) {
  const vp1 = createMockViewport(subcatMap);
  const vp2 = createMockViewport(subcatMap);
  return { old: oldImpl.createOverrides(vp1), new: newImpl.createOverrides(vp2), vp1, vp2 };
}

const { Show, Hide } = oldImpl.Override;

// ---------------------------------------------------------------------------
// h) Performance benchmarks
// ---------------------------------------------------------------------------

/** Run `fn` `iterations` times, return elapsed ms. */
function bench(_label: string, iterations: number, fn: () => void): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++)
    fn();
  const elapsed = performance.now() - start;
  return elapsed;
}

/** Run async `fn` `iterations` times, return elapsed ms. */
async function benchAsync(_label: string, iterations: number, fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++)
    await fn();
  const elapsed = performance.now() - start;
  return elapsed;
}

function logResult(name: string, oldMs: number, newMs: number, iterations: number) {
  const ratio = oldMs / newMs;
  // eslint-disable-next-line no-console
  console.log(
    `[PERF] ${name} (${iterations} iters): old=${oldMs.toFixed(2)}ms, new=${newMs.toFixed(2)}ms, speedup=${ratio.toFixed(2)}x`,
  );
}

function makeIds(count: number, offset: number = 1): string[] {
  return Array.from({ length: count }, (_, i) => `0x${(i + offset).toString(16)}`);
}

describe("performance benchmarks", () => {

  describe("setOverride", () => {
    it("single model × single category, many iterations", () => {
      const iterations = 10_000;
      const vp = createMockViewport();
      const oldOvr = oldImpl.createOverrides(vp);
      const oldMs = bench("setOverride-single-old", iterations, () => {
        oldOvr.setOverride("0x1", "0x10", Show);
      });
      const newOvr = newImpl.createOverrides(vp);
      const newMs = bench("setOverride-single-new", iterations, () => {
        newOvr.setOverride("0x1", "0x10", Show);
      });
      logResult("setOverride (1×1, create+set)", oldMs, newMs, iterations);
    });

    it("bulk: 100 models × 100 categories", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const iterations = 50;

      const vp = createMockViewport();
      const oldOvr = oldImpl.createOverrides(vp);
      const oldMs = bench("setOverride-bulk-old", iterations, () => {
        oldOvr.setOverride(models, cats, Show);
      });
      const newOvr = newImpl.createOverrides(vp);
      const newMs = bench("setOverride-bulk-new", iterations, () => {
        newOvr.setOverride(models, cats, Show);
      });
      logResult("setOverride (100×100 bulk)", oldMs, newMs, iterations);
    });

    it("overwrite existing entries (update path)", () => {
      const models = makeIds(50);
      const cats = makeIds(50, 0x1000);
      const iterations = 100;

      const vp = createMockViewport();
      const oldOvr = oldImpl.createOverrides(vp);
      const oldMs = bench("setOverride-update-old", iterations, () => {
      oldOvr.setOverride(models, cats, Show);
        oldOvr.setOverride(models, cats, Hide);
      });
      const newOvr = newImpl.createOverrides(vp);
      const newMs = bench("setOverride-update-new", iterations, () => {
        newOvr.setOverride(models, cats, Show);
        newOvr.setOverride(models, cats, Hide);
      });
      logResult("setOverride (50×50 update Show→Hide)", oldMs, newMs, iterations);
    });
  });

  describe("getOverride", () => {
    it("lookup in populated map (10k entries)", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const pair = createBoth();
      pair.old.setOverride(models, cats, Show);
      pair.new.setOverride(models, cats, Show);

      const iterations = 100_000;
      // Lookup a model/category pair that exists
      const midModel = models[50];
      const midCat = cats[50];

      const oldMs = bench("getOverride-hit-old", iterations, () => {
        pair.old.getOverride(midModel, midCat);
      });
      const newMs = bench("getOverride-hit-new", iterations, () => {
        pair.new.getOverride(midModel, midCat);
      });
      logResult("getOverride (hit, 10k entries)", oldMs, newMs, iterations);
    });

    it("lookup miss in populated map", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const pair = createBoth();
      pair.old.setOverride(models, cats, Show);
      pair.new.setOverride(models, cats, Show);

      const iterations = 100_000;
      const oldMs = bench("getOverride-miss-old", iterations, () => {
        pair.old.getOverride("0xdead", "0xbeef");
      });
      const newMs = bench("getOverride-miss-new", iterations, () => {
        pair.new.getOverride("0xdead", "0xbeef");
      });
      logResult("getOverride (miss, 10k entries)", oldMs, newMs, iterations);
    });
  });

  describe("clearOverrides", () => {
    it("clear all (10k entries)", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const iterations = 200;

      const oldMs = bench("clearOverrides-all-old", iterations, () => {
        const vp = createMockViewport();
        const ovrs = oldImpl.createOverrides(vp);
        ovrs.setOverride(models, cats, Show);
        ovrs.clearOverrides();
      });
      const newMs = bench("clearOverrides-all-new", iterations, () => {
        const vp = createMockViewport();
        const ovrs = newImpl.createOverrides(vp);
        ovrs.setOverride(models, cats, Show);
        ovrs.clearOverrides();
      });
      logResult("clearOverrides (all, 10k entries)", oldMs, newMs, iterations);
    });

    it("clear specific models (50 of 100)", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const clearModels = models.slice(0, 50);
      const iterations = 200;

      const vp = createMockViewport();
      const oldOvr = oldImpl.createOverrides(vp);
      oldOvr.setOverride(models, cats, Show);
      const oldMs = bench("clearOverrides-partial-old", iterations, () => {
        oldOvr.clearOverrides(clearModels);
      });
      const newOvr = newImpl.createOverrides(vp);
        newOvr.setOverride(models, cats, Show);
      const newMs = bench("clearOverrides-partial-new", iterations, () => {
        newOvr.clearOverrides(clearModels);
      });
      logResult("clearOverrides (50 of 100 models, 10k entries)", oldMs, newMs, iterations);
    });
  });

  describe("[Symbol.iterator]", () => {
    it("iterate over 10k entries", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const pair = createBoth();
      pair.old.setOverride(models, cats, Show);
      pair.new.setOverride(models, cats, Show);

      const iterations = 500;
      const oldMs = bench("iterate-old", iterations, () => {
        let _count = 0;
        for (const _ of pair.old)
          _count++;
      });
      const newMs = bench("iterate-new", iterations, () => {
        let _count = 0;
        for (const _ of pair.new)
          _count++;
      });
      logResult("[Symbol.iterator] (10k entries)", oldMs, newMs, iterations);
    });
  });

  describe("setOverrides (async batch)", () => {
    it("set 100 models × 100 categories via Props[]", async () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const props: oldImpl.Props[] = models.map((m) => ({
        modelId: m,
        categoryIds: cats,
        visOverride: Show,
      }));
      const iterations = 50;

      const oldMs = await benchAsync("setOverrides-batch-old", iterations, async () => {
        const vp = createMockViewport();
        const ovrs = oldImpl.createOverrides(vp);
        await ovrs.setOverrides(props);
      });
      const newMs = await benchAsync("setOverrides-batch-new", iterations, async () => {
        const vp = createMockViewport();
        const ovrs = newImpl.createOverrides(vp);
        await ovrs.setOverrides(props);
      });
      logResult("setOverrides (100×100 Props[])", oldMs, newMs, iterations);
    });
  });

  describe("addOverrides", () => {
    it("10k entries with subcategories", () => {
      const models = makeIds(100);
      const cats = makeIds(100, 0x1000);
      const subcatMap = new Map<string, Set<string>>();
      for (const cat of cats) {
        const subcats = new Set<string>();
        for (let s = 0; s < 3; s++)
          subcats.add(`0x${(parseInt(cat, 16) * 16 + s).toString(16)}`);
        subcatMap.set(cat, subcats);
      }

      const pair = createBoth(subcatMap);
      pair.old.setOverride(models, cats, Show);
      pair.new.setOverride(models, cats, Show);

      const iterations = 100;
        const fs = {
          isSubCategoryVisible: () => false,
        } as unknown as FeatureSymbology.Overrides;
        const ovrs = new Id64.Uint32Map<Id64.Uint32Set>();
      const oldMs = bench("addOverrides-old", iterations, () => {
        pair.old.addOverrides(fs, ovrs);
      });
      const newMs = bench("addOverrides-new", iterations, () => {
        pair.new.addOverrides(fs, ovrs);
      });
      logResult("addOverrides (10k entries, 3 subcats each)", oldMs, newMs, iterations);
    });
  });

  describe("mixed workload", () => {
    it("set, get, update, iterate, clear cycle", () => {
      const models = makeIds(50);
      const cats = makeIds(50, 0x1000);
      const iterations = 100;

      const oldMs = bench("mixed-old", iterations, () => {
        const vp = createMockViewport();
        const ovrs = oldImpl.createOverrides(vp);
        ovrs.setOverride(models, cats, Show);
        for (const m of models)
          for (const c of cats)
            ovrs.getOverride(m, c);
        ovrs.setOverride(models.slice(0, 25), cats.slice(0, 25), Hide);
        let _count = 0;
        for (const _ of ovrs)
          _count++;
        ovrs.clearOverrides(models.slice(0, 10));
        ovrs.clearOverrides();
      });
      const newMs = bench("mixed-new", iterations, () => {
        const vp = createMockViewport();
        const ovrs = newImpl.createOverrides(vp);
        ovrs.setOverride(models, cats, Show);
        for (const m of models)
          for (const c of cats)
            ovrs.getOverride(m, c);
        ovrs.setOverride(models.slice(0, 25), cats.slice(0, 25), Hide);
        let _count = 0;
        for (const _ of ovrs)
          _count++;
        ovrs.clearOverrides(models.slice(0, 10));
        ovrs.clearOverrides();
      });
      logResult("mixed workload (50×50)", oldMs, newMs, iterations);
    });
  });
});

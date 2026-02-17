/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai"
import { IModelConnection } from "@itwin/core-frontend";
import { Id64String } from "@itwin/core-bentley";
import { TestSnapshotConnection } from "../TestSnapshotConnection";
import { TestUtility } from "../TestUtility";
import { _nativeDb } from "@itwin/core-backend";

/* eslint-disable @typescript-eslint/dot-notation */

describe.only("NEW: IModelConnection.Models.queryExtents Performance", () => {
  let iModel: IModelConnection;

  const spatiallyLocatedModelIds: Id64String[] = [
    "0x3e", "0x49", "0x54", "0x5f", "0x6a", "0x75", "0x80", "0x8b", "0x96", "0xa1", "0xac", "0xb7", "0xc2", "0xcd", "0xd8", "0xe3", "0xee", "0xf9", "0x104", "0x10f", "0x11a", "0x125", "0x130", "0x13b", "0x146", "0x151", "0x15c", "0x167", "0x172", "0x17d", "0x188", "0x193", "0x19e", "0x1a9", "0x1b4", "0x1bf", "0x1ca", "0x1d5", "0x1e0", "0x1eb", "0x1f6", "0x201", "0x20c", "0x217", "0x222", "0x22d", "0x238", "0x243", "0x24e", "0x259", "0x264", "0x26f", "0x27a", "0x285", "0x290", "0x29b", "0x2a6", "0x2b1", "0x2bc", "0x2c7", "0x2d2", "0x2dd", "0x2e8", "0x2f3", "0x2fe", "0x309", "0x314", "0x31f", "0x32a", "0x335", "0x340", "0x34b", "0x356", "0x361", "0x36c", "0x377", "0x382", "0x38d", "0x398", "0x3a3", "0x3ae", "0x3b9", "0x3c4", "0x3cf", "0x3da", "0x3e5", "0x3f0", "0x3fb", "0x406", "0x411", "0x41c", "0x427", "0x432", "0x43d", "0x448", "0x453", "0x45e", "0x469", "0x474", "0x47f"
  ];
  const nonSpatiallyLocatedModelIds: Id64String[] = [
    "0x48a", "0x48e", "0x492", "0x496", "0x49a", "0x49e", "0x4a2", "0x4a6", "0x4aa", "0x4ae", "0x4b2", "0x4b6", "0x4ba", "0x4be", "0x4c2", "0x4c6", "0x4ca", "0x4ce", "0x4d2", "0x4d6", "0x4da", "0x4de", "0x4e2", "0x4e6", "0x4ea", "0x4ee", "0x4f2", "0x4f6", "0x4fa", "0x4fe", "0x502", "0x506", "0x50a", "0x50e", "0x512", "0x516", "0x51a", "0x51e", "0x522", "0x526", "0x52a", "0x52e", "0x532", "0x536", "0x53a", "0x53e", "0x542", "0x546", "0x54a", "0x54e", "0x552", "0x556", "0x55a", "0x55e", "0x562", "0x566", "0x56a", "0x56e", "0x572", "0x576", "0x57a", "0x57e", "0x582", "0x586", "0x58a", "0x58e", "0x592", "0x596", "0x59a", "0x59e", "0x5a2", "0x5a6", "0x5aa", "0x5ae", "0x5b2", "0x5b6", "0x5ba", "0x5be", "0x5c2", "0x5c6", "0x5ca", "0x5ce", "0x5d2", "0x5d6", "0x5da", "0x5de", "0x5e2", "0x5e6", "0x5ea", "0x5ee", "0x5f2", "0x5f6", "0x5fa", "0x5fe", "0x602", "0x606", "0x60a", "0x60e", "0x612", "0x616"
  ];

  before(async () => {
    // Create a fresh snapshot database for testing
    await TestUtility.startFrontend();
    // Open as IModelConnection for frontend tests
  });

  beforeEach(async () => {
    iModel = await TestSnapshotConnection.openFile(`D:\\Projects\\Codebases\\Investigations\\QueryExtents\\queryExtentsPerfTest.bim`);
    clearExtentsCache();
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  afterEach(() => {
    if (iModel)
      iModel.close();
  });

  // Helper: measure execution time in milliseconds.
  async function measureMs(fn: () => Promise<unknown>): Promise<number> {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  }

  function clearExtentsCache() {
    (iModel.models as any)["_loadedExtents"]?.clear();
  }

  describe("basic tests", () => {
    for (const count of [10, 50, 100]) {
      it(`should handle ${count} spatially located models`, async () => {
        const testModelIds = spatiallyLocatedModelIds.slice(0, count);

        const elapsed = await measureMs(async () => {
          const results = await iModel.models.queryExtents(testModelIds);
          assert.isArray(results);
          assert.equal(results.length, testModelIds.length);

          // Verify that spatially located models have valid extents
          for (const result of results) {
            assert.isDefined(result.extents, "Spatially located model should have extents");
            console.log(` ${count} :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
          }
        });

        console.log(`  queryExtents(${count} spatial models): ${elapsed.toFixed(2)}ms`);
        clearExtentsCache();
      });

      it(`should handle ${count} non-spatially located models`, async () => {
        const testModelIds = nonSpatiallyLocatedModelIds.slice(0, count);

        const elapsed = await measureMs(async () => {
          const results = await iModel.models.queryExtents(testModelIds);
          assert.isArray(results);
          assert.equal(results.length, testModelIds.length);

          for (const result of results) {
            assert.isDefined(result.extents, "Non-spatially located model should have extents");
            console.log(` ${count} :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
          }
        });

        console.log(`  queryExtents(${count} non-spatial models): ${elapsed.toFixed(2)}ms`);
        clearExtentsCache();
      });
    }

    it("should handle all 200 models (performance benchmark)", async () => {
      const allModelIds = [...spatiallyLocatedModelIds, ...nonSpatiallyLocatedModelIds];

      const elapsed = await measureMs(async () => {
        const results = await iModel.models.queryExtents(allModelIds);
        assert.isArray(results);
        assert.equal(results.length, 200);

        for (const result of results) {
          assert.isDefined(result.extents, "Model should have extents");
          console.log(`All 200 :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
        }
      });

      console.log(`  queryExtents(all 200 models): ${elapsed.toFixed(2)}ms (${(elapsed / 200).toFixed(2)}ms per model)`);
      clearExtentsCache();
    });

    it("should handle empty array", async () => {
      const results = await iModel.models.queryExtents([]);
      assert.isArray(results);
      assert.equal(results.length, 0);
    });

    it("should handle duplicate model IDs", async () => {
      const modelId = spatiallyLocatedModelIds[0];
      const duplicateIds = [modelId, modelId, modelId];

      const results = await iModel.models.queryExtents(duplicateIds);
      assert.equal(results.length, duplicateIds.length);

      // All should return the same extents
      for (const result of results) {
        assert.equal(result.id, modelId);
        assert.isDefined(result.extents);
      }
      clearExtentsCache();
    });
  });

  for (const count of [50, 100]) {
    it(`cached lookups for ${count} models should be significantly faster than cold queries`, async () => {
      const testModelIds = spatiallyLocatedModelIds.slice(0, count);

      // Cold call — first time querying, will populate cache
      const coldElapsed = await measureMs(async () => {
        const results = await iModel.models.queryExtents(testModelIds);
        assert.equal(results.length, count);
      });

      // Warm call — should hit cache, no database queries
      const warmElapsed = await measureMs(async () => {
        const results = await iModel.models.queryExtents(testModelIds);
        assert.equal(results.length, count);
        for (const result of results) {
          console.log(` Cache Lookups ${count} :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
        }
      });

      console.log(`  queryExtents(${count} models) cold: ${coldElapsed.toFixed(2)}ms, warm: ${warmElapsed.toFixed(2)}ms, speedup: ${(coldElapsed / Math.max(warmElapsed, 0.01)).toFixed(1)}x`);

      // Cached should be significantly faster
      expect(warmElapsed).to.be.lessThan(coldElapsed);
      clearExtentsCache();
    });
  }

  describe("mix of spatial and non-spatial models", () => {
    it("should handle a mix of cached, uncached, and invalid IDs efficiently", async () => {
      const validCount = 50;
      const validModelIds = spatiallyLocatedModelIds.slice(0, validCount);
      const invalidModelIds = ["notAnId", "alsoInvalid", "0xInvalid"];

      // First call: populate cache for the first half
      const firstHalf = validModelIds.slice(0, validCount / 2);
      await iModel.models.queryExtents(firstHalf);

      // Verify cache was populated
      const cacheSize = (iModel.models as any)["_loadedExtents"]?.size ?? 0;
      assert.isAtLeast(cacheSize, firstHalf.length, "Cache should contain at least the first half");

      // Second call: mix of cached (first half) + uncached (second half) + invalid
      const secondHalf = validModelIds.slice(validCount / 2);
      const mixedIds = [...firstHalf, ...secondHalf, ...invalidModelIds];

      const elapsed = await measureMs(async () => {
        const results = await iModel.models.queryExtents(mixedIds);
        assert.equal(results.length, mixedIds.length);

        // First half + second half: should be valid
        for (let i = 0; i < validCount; i++) {
          assert.isDefined(results[i].extents);
        }

        // Invalid IDs should return results (implementation dependent on how invalid IDs are handled)
        for (let i = validCount; i < mixedIds.length; i++) {
          assert.isDefined(results[i]);
        }

        for (const result of results) {
          console.log(` Mixed Lookups ${mixedIds.length} :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
        }
      });

      console.log(`  queryExtents(${firstHalf.length} cached + ${secondHalf.length} uncached + ${invalidModelIds.length} invalid): ${elapsed.toFixed(2)}ms`);
      clearExtentsCache();
    });

    it("should handle a mix of spatial and non-spatial models", async () => {
      const spatialCount = 50;
      const nonSpatialCount = 30;

      const spatialIds = spatiallyLocatedModelIds.slice(0, spatialCount);
      const nonSpatialIds = nonSpatiallyLocatedModelIds.slice(0, nonSpatialCount);
      const mixedIds = [...spatialIds, ...nonSpatialIds];

      const elapsed = await measureMs(async () => {
        const results = await iModel.models.queryExtents(mixedIds);
        assert.equal(results.length, mixedIds.length);

        // All should have extents defined
        for (const result of results) {
          assert.isDefined(result.extents);
          console.log(` Mix2 :  Model ${result.id} extents: ${JSON.stringify(result.extents)}`);
        }
      });

      console.log(`  queryExtents(${spatialCount} spatial + ${nonSpatialCount} non-spatial): ${elapsed.toFixed(2)}ms`);
      clearExtentsCache();
    });
  });

  describe("result ordering", () => {
    it("should maintain input order for mixed cache states", async () => {
      const count = 60;
      const modelIds = spatiallyLocatedModelIds.slice(0, count);

      // Pre-cache every other model
      const evenIds = modelIds.filter((_, i) => i % 2 === 0);
      await iModel.models.queryExtents(evenIds);

      // Query all — odd-indexed models are uncached
      const results = await iModel.models.queryExtents(modelIds);
      assert.equal(results.length, count);

      // Verify strict ordering matches input
      for (let i = 0; i < count; i++) {
        assert.equal(results[i].id, modelIds[i], `Result at index ${i} should match input order`);
      }
      clearExtentsCache();
    });

    it("should maintain order for mixed spatial and non-spatial models", async () => {
      // Create alternating pattern of spatial and non-spatial
      const pattern: Id64String[] = [];
      for (let i = 0; i < 40; i++) {
        if (i % 2 === 0) {
          pattern.push(spatiallyLocatedModelIds[i / 2]);
        } else {
          pattern.push(nonSpatiallyLocatedModelIds[Math.floor(i / 2)]);
        }
      }

      const results = await iModel.models.queryExtents(pattern);
      assert.equal(results.length, pattern.length);

      // Verify order is preserved
      for (let i = 0; i < pattern.length; i++) {
        assert.equal(results[i].id, pattern[i], `Result at index ${i} should match input order`);
      }
      clearExtentsCache();
    });
  });
});
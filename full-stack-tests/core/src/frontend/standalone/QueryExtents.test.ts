/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai"
import { IModelConnection } from "@itwin/core-frontend";
import { Id64String, IModelStatus } from "@itwin/core-bentley";
import { TestSnapshotConnection } from "../TestSnapshotConnection";
import { TestUtility } from "../TestUtility";
import { ModelExtentsProps } from "@itwin/core-common";
import { FrontendPerfReporter } from "../FrontendPerfReporter";
import * as path from "path";

/* eslint-disable @typescript-eslint/dot-notation */

describe("queryExtents Performance Tests (#performance)", () => {
  let iModel: IModelConnection;
  const spatiallyLocatedModelIds: Id64String[] = [];
  const nonSpatiallyLocatedModelIds: Id64String[] = [];

  const csvPath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "full-stack-tests/core/lib/frontend/test/output", "QueryExtentsPerfTests.csv");
  const reporter = new FrontendPerfReporter(csvPath);

  before(async () => {
    await TestUtility.startFrontend();

    iModel = await TestSnapshotConnection.openFile(path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets", "test_ec_4003.bim"));
    assert.isTrue(iModel.isOpen, "iModel should be open");
    await discoverModelIds();
  });

  after(async () => {
    if (iModel)
      await iModel.close();

    await reporter.exportCSV();
    /* eslint-disable-next-line no-console */
    console.log(`Performance results exported to: ${csvPath}`);
    await TestUtility.shutdownFrontend();
  });

  async function discoverModelIds() {
    for await (const row of iModel.createQueryReader(`SELECT ECInstanceId, IsNotSpatiallyLocated FROM BisCore.PhysicalModel`)) {
      if (row.isNotSpatiallyLocated as boolean) {
        nonSpatiallyLocatedModelIds.push(row.eCInstanceId as Id64String);
      } else {
        spatiallyLocatedModelIds.push(row.eCInstanceId as Id64String);
      }
    }

    assert.isAtLeast(spatiallyLocatedModelIds.length, 350);
    assert.isAtLeast(nonSpatiallyLocatedModelIds.length, 250);
  }

  async function measureMs(fn: () => Promise<unknown>): Promise<number> {
    const start = performance.now();
    await fn();
    const elapsedMs = performance.now() - start;
    return parseFloat(elapsedMs.toFixed(2));
  }

  function clearExtentsCache() {
    (iModel.models as any)["_loadedExtents"]?.clear();
    assert.equal((iModel.models as any)["_loadedExtents"]?.size, 0, "Cache should be cleared");
  }

  describe("basic performance tests", () => {
    beforeEach(() => {
      // Make sure we start with a cold cache. We can warm it up in the test as per our need.
      clearExtentsCache();
    });

    it(`should handle different number of spatially located models`, async () => {
      for (const count of [1, 5, 10, 50, 100, 200, 350]) {
        const testModelIds = spatiallyLocatedModelIds.slice(0, count);
        let results: ModelExtentsProps[] = [];

        const elapsed = await measureMs(async () => {
          results = await iModel.models.queryExtents(testModelIds);
        });

        // Validate the query results
        assert.isArray(results);
        assert.equal(results.length, testModelIds.length);

        for (const result of results) {
          assert.notEqual(result.id, "0", "Result should have a valid model ID");
          assert.isDefined(result.extents, "Spatially located model should have extents");
        }

        reporter.addEntry("queryExtents Performance", `queryExtents for ${count} spatial models`, "Execution time (ms)", elapsed);
        clearExtentsCache();
      }
    });

    it(`should handle different number of non-spatially located models`, async () => {
      for (const count of [1, 5, 10, 50, 100, 200, 250]) {
        const testModelIds = nonSpatiallyLocatedModelIds.slice(0, count);
        let results: ModelExtentsProps[] = [];

        const elapsed = await measureMs(async () => {
          results = await iModel.models.queryExtents(testModelIds);
        });

        // Validate the query results
        assert.isArray(results);
        assert.equal(results.length, testModelIds.length);

        let index = 0;
        for (const result of results) {
          assert.equal(result.id, testModelIds[index], "Result should have a valid model ID");
          assert.isDefined(result.extents, "Non-spatially located model should have extents");
          index++;
        }

        reporter.addEntry("queryExtents Performance", `queryExtents for ${count} non-spatial models`, "Execution time (ms)", elapsed);
        clearExtentsCache();
      }
    });

    it("should handle all models (benchmark)", async () => {
      const allModelIds = [...spatiallyLocatedModelIds, ...nonSpatiallyLocatedModelIds];
      let results: ModelExtentsProps[] = [];

      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents(allModelIds);
      });

      // Validate the query results
      assert.isArray(results);
      assert.equal(results.length, allModelIds.length);

      let index = 0;
      for (const result of results) {
        assert.equal(result.id, allModelIds[index], "Result should have a valid model ID");
        assert.isDefined(result.extents, "Model should have extents");
        index++;
      }

      reporter.addEntry("queryExtents Performance", `queryExtents for ${allModelIds.length} models`, "Execution time (ms)", elapsed);
      clearExtentsCache();
    });

    it("Sanity test: should handle empty array", async () => {
      let results: ModelExtentsProps[] = [];

      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents([]);
      });

      // Validate the query results
      assert.isArray(results);
      assert.equal(results.length, 0);
      reporter.addEntry("queryExtents sanity check", `queryExtents for an empty array`, "Execution time (ms)", elapsed);
    });

    it("Sanity test: should handle duplicate model IDs", async () => {
      const modelId = spatiallyLocatedModelIds[0];
      const duplicateIds = [modelId, modelId, modelId];
      let results: ModelExtentsProps[] = [];

      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents(duplicateIds);
      });

      // Validate the query results
      assert.isArray(results);
      assert.equal(results.length, duplicateIds.length);

      // All should return the same extents
      for (const result of results) {
        assert.equal(result.id, modelId);
        assert.isDefined(result.extents);
      }

      reporter.addEntry("queryExtents sanity check", `queryExtents for 3 duplicate model IDs`, "Execution time (ms)", elapsed);
    });
  });

  describe("Performance tests", () => {
    beforeEach(() => {
      // Make sure we start with a cold cache for each test
      clearExtentsCache();
    });

    it(`cached lookups for models should be significantly faster than cold queries`, async () => {
      for (const count of [1, 5, 10, 50, 100, 200, 350]) {
        clearExtentsCache();

        const testModelIds = spatiallyLocatedModelIds.slice(0, count);

        // Populate the cache first
        let results: ModelExtentsProps[] = [];
        const coldElapsed = await measureMs(async () => {
          results = await iModel.models.queryExtents(testModelIds);
        });
        assert.equal(results.length, count);

        // Warm call — should hit cache, no database queries
        const warmElapsed = await measureMs(async () => {
          results = await iModel.models.queryExtents(testModelIds);
        });

        assert.equal(results.length, count);
        let index = 0;
        for (const result of results) {
          assert.equal(result.id, testModelIds[index], "Result should have a valid model ID");
          assert.isDefined(result.extents, "Model should have extents");
          index++;
        }

        reporter.addEntry("queryExtents Performance", `queryExtents cache performance for ${count} models`, "Cache speedup factor", parseFloat((coldElapsed / Math.max(warmElapsed, 0.01)).toFixed(2)), `Cold: ${coldElapsed.toFixed(2)}ms, Warm: ${warmElapsed.toFixed(2)}ms`);
        expect(warmElapsed).to.be.lessThan(coldElapsed + 0.5);
      }
    });

    it("should handle a mix of 150 modelIds that are either cached/uncached/have invalid IDs", async () => {
      const validCount = 150;
      const validModelIds = spatiallyLocatedModelIds.slice(0, validCount);
      const invalidModelIds = ["invalidId", "anotherInvalidId", "yetAnotherInvalidId"];

      // First call: populate cache for the first half
      const firstHalf = validModelIds.slice(0, validCount / 2);
      await iModel.models.queryExtents(firstHalf);

      // Verify cache was populated
      const cacheSize = (iModel.models as any)["_loadedExtents"]?.size ?? 0;
      assert.isAtLeast(cacheSize, firstHalf.length, "Cache should contain at least the first half");

      // Second call: mix of cached (first half) + uncached (second half) + invalid
      const secondHalf = validModelIds.slice(validCount / 2);
      const mixedIds = [...firstHalf, ...secondHalf, ...invalidModelIds];

      let results: ModelExtentsProps[] = [];
      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents(mixedIds);
      });

      // Validate the results
      assert.equal(results.length, mixedIds.length);

      // First half + second half: should be valid
      for (let i = 0; i < validCount; i++) {
        assert.equal(results[i].id, validModelIds[i], "Result should have a valid model ID");
        assert.isDefined(results[i].extents);
      }

      // Invalid IDs should return results
      for (let i = validCount; i < mixedIds.length; i++) {
        assert.isDefined(results[i]);
        assert.equal(results[i].id, "0");
        assert.equal(results[i].status, IModelStatus.InvalidId);
      }

      reporter.addEntry("queryExtents Performance", `queryExtents for ${firstHalf.length} cached + ${secondHalf.length} uncached + ${invalidModelIds.length} invalid`, "Execution time (ms)", elapsed);
      clearExtentsCache();
    });

    it("should handle a mix of spatial and non-spatial models", async () => {
      const spatialCount = 150;
      const nonSpatialCount = 75;

      const spatialIds = spatiallyLocatedModelIds.slice(0, spatialCount);
      const nonSpatialIds = nonSpatiallyLocatedModelIds.slice(0, nonSpatialCount);
      const mixedIds = [...spatialIds, ...nonSpatialIds];

      let results: ModelExtentsProps[] = [];
      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents(mixedIds);
      });

      // Validate results
      assert.equal(results.length, mixedIds.length);

      // All should have extents defined
      let index = 0;
      for (const result of results) {
        assert.equal(result.id, mixedIds[index], "Result should have a valid model ID");
        assert.isDefined(result.extents);
        index++;
      }

      reporter.addEntry("queryExtents Performance", `queryExtents for ${spatialCount} spatial + ${nonSpatialCount} non-spatial`, "Execution time (ms)", elapsed);
      clearExtentsCache();
    });

    it("should handle a random mix of spatial and non-spatial models, with some cached and some uncached", async () => {
      const spatialCount = 150;
      const nonSpatialCount = 100;

      const spatialIds = spatiallyLocatedModelIds.slice(0, spatialCount);
      const nonSpatialIds = nonSpatiallyLocatedModelIds.slice(0, nonSpatialCount);
      const mixedIds = [...spatialIds, ...nonSpatialIds];

      // Shuffle the array
      for (let i = mixedIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mixedIds[i], mixedIds[j]] = [mixedIds[j], mixedIds[i]];
      }

      // Pre-cache a random subset (e.g., 50% of the models)
      const preCacheCount = Math.floor(mixedIds.length / 2);
      const preCacheIds = mixedIds.slice(0, preCacheCount);
      await iModel.models.queryExtents(preCacheIds);

      // Now query the full mixed list
      let results: ModelExtentsProps[] = [];
      const elapsed = await measureMs(async () => {
        results = await iModel.models.queryExtents(mixedIds);
      });

      // Validate results
      assert.equal(results.length, mixedIds.length);
      for (let i = 0; i < results.length; i++) {
        assert.equal(results[i].id, mixedIds[i], "Result should have a valid model ID");
        assert.isDefined(results[i].extents, `Model at index ${i} should have extents`);
      }
      reporter.addEntry("queryExtents Performance", `Random mixed queryExtents (${spatialCount} spatial + ${nonSpatialCount} non-spatial, ${preCacheCount} cached)`, "Execution time (ms)", elapsed);
      clearExtentsCache();
    });
  });
});
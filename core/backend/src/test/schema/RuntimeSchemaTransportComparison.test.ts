/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, SnapshotDb } from "../../core-backend";
import { expect } from "chai";

/**
 * Performance benchmark for PRAGMA runtime_schemas hydration.
 *
 * Opens a large iModel and measures hydration via the ConcurrentQuery pragma path.
 */
describe("RuntimeSchema PRAGMA benchmark", () => {
  const iModelPath = "/home/rob/code/bentley/testing/XL - Jacobs - Plantsight_dt_AZ.bim";

  let iModel: SnapshotDb;

  before(async function () {
    this.timeout(30_000);
    await IModelHost.startup();
    iModel = SnapshotDb.openFile(iModelPath);
  });

  after(async () => {
    iModel?.close();
    await IModelHost.shutdown();
  });

  it("should measure PRAGMA runtime_schemas performance", async function () {
    this.timeout(120_000);
    const iterations = 5;
    const times: number[] = [];

    const clearCache = () => {
      (iModel as any)._runtimeSchemas = undefined;
      (iModel as any)._runtimeSchemasPromise = undefined;
    };

    const timeRun = async () => {
      clearCache();
      const t0 = performance.now();
      const ctx = await iModel.getRuntimeSchemas();
      return { elapsed: performance.now() - t0, ctx };
    };

    // Warmup: populate SQLite page cache and CQ thread pool
    await timeRun();

    for (let i = 0; i < iterations; i++) {
      const r = await timeRun();
      times.push(r.elapsed);
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = (arr: number[]) => Math.min(...arr);

    console.log("\n=== RuntimeSchema PRAGMA Benchmark ===");
    console.log(`iModel: ${iModelPath}`);
    console.log(`Iterations: ${iterations} (after warmup)`);
    console.log(`Times: ${times.map((t) => `${t.toFixed(1)}ms`).join(", ")}`);
    console.log(`Avg: ${avg(times).toFixed(1)}ms, Min: ${min(times).toFixed(1)}ms`);

    // Sanity: verify we got schemas
    const ctx = (await timeRun()).ctx;
    const schemas = [...ctx.getSchemas()];
    expect(schemas.length).to.be.greaterThan(0);
    console.log(`Schemas: ${schemas.length}, Classes: ${[...schemas].reduce((n, s) => n + [...s.getClasses()].length, 0)}`);
  });
});

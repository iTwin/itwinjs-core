/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { ECSqlStatement, IModelHost, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";

const ITWINJS_CORE_VERSION = version as string;
const CORE_MAJ_MIN = `${ITWINJS_CORE_VERSION.split(".")[0]}.${ITWINJS_CORE_VERSION.split(".")[1]}.x`;

/* eslint-disable @typescript-eslint/naming-convention */

const NUM_ELEMENTS = 100;
const QUERY_ITERATIONS = [1000, 2000, 5000];

function ensureDirectoryExists(dir: string) {
  if (!IModelJsFs.existsSync(dir)) {
    IModelJsFs.mkdirSync(dir);
  }
}

describe.only("RepeatedQueryPerformanceTests", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "RepeatedQueryPerformance");
  const reporter = new Reporter();
  let testIModel: SnapshotDb;
  const elementIds: string[] = [];

  before(async () => {
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);

    await IModelHost.startup();

    // Create a simple iModel with elements
    const fileName = `QueryPerf_seed.bim`;
    const pathname = path.join(outDir, fileName);

    // Always create fresh for consistent testing
    if (IModelJsFs.existsSync(pathname)) {
      IModelJsFs.removeSync(pathname);
    }

    testIModel = SnapshotDb.createEmpty(pathname, { rootSubject: { name: "QueryPerfTest" } });

    // Create a physical model and category
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testIModel, Code.createEmpty(), true);
    let categoryId = SpatialCategory.queryCategoryIdByName(testIModel, IModel.dictionaryId, "TestCategory");
    if (undefined === categoryId) {
      categoryId = SpatialCategory.insert(testIModel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
    }

    // Create simple geometry
    const arc = Arc3d.createXY(Point3d.create(0, 0), 5);
    const geometryStream = [GeomJson.Writer.toIModelJson(arc)];

    // Insert elements and collect their IDs
    for (let i = 0; i < NUM_ELEMENTS; i++) {
      const elementProps = {
        classFullName: "Generic:PhysicalObject",
        model: modelId,
        category: categoryId,
        code: Code.createEmpty(),
        geom: geometryStream,
      };
      const element = testIModel.elements.createElement(elementProps);
      const id = testIModel.elements.insertElement(element.toJSON());
      assert.isTrue(Id64.isValidId64(id), "insert worked");
      elementIds.push(id);
    }

    testIModel.saveChanges();

    // eslint-disable-next-line no-console
    console.log(`Created test iModel with ${NUM_ELEMENTS} elements`);
  });

  after(async () => {
    const csvPath = path.join(outDir, "RepeatedQueryPerformanceResults.csv");
    reporter.exportCSV(csvPath);

    // Print summary to console
    // eslint-disable-next-line no-console
    console.log(`\n${  "=".repeat(70)}`);
    // eslint-disable-next-line no-console
    console.log("PERFORMANCE TEST SUMMARY");
    // eslint-disable-next-line no-console
    console.log("=".repeat(70));
    // eslint-disable-next-line no-console
    console.log(`Core Version: ${CORE_MAJ_MIN}`);
    // eslint-disable-next-line no-console
    console.log(`Elements in test iModel: ${NUM_ELEMENTS}`);
    // eslint-disable-next-line no-console
    console.log(`Query iterations tested: ${QUERY_ITERATIONS.join(", ")}`);
    // eslint-disable-next-line no-console
    console.log("-".repeat(70));
    // eslint-disable-next-line no-console
    console.log(`CSV exported to: ${csvPath}`);
    // eslint-disable-next-line no-console
    console.log(`${"=".repeat(70)  }\n`);

    testIModel.close();
    await IModelHost.shutdown();
  });

  it("withPreparedStatement - repeated element existence queries", async () => {
    for (const iterations of QUERY_ITERATIONS) {
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const elementId = elementIds[i % elementIds.length];
        const ecsql = `SELECT ECInstanceId FROM bis.Element WHERE ECInstanceId = ${elementId}`;

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        testIModel.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
          const result = stmt.step();
          assert.equal(result, DbResult.BE_SQLITE_ROW, "Element should exist");
          stmt.getRow();
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      // eslint-disable-next-line no-console
      console.log(`withPreparedStatement | ${iterations} iterations | total: ${totalTime.toFixed(2)}ms | avg: ${avgTime.toFixed(4)}ms`);

      reporter.addEntry("RepeatedQueryPerformanceTests", "withPreparedStatement - element exists", "Total time (ms)", totalTime, {
        Iterations: iterations, CoreVersion: CORE_MAJ_MIN,
      });
      reporter.addEntry("RepeatedQueryPerformanceTests", "withPreparedStatement - element exists", "Avg time per query (ms)", avgTime, {
        Iterations: iterations, CoreVersion: CORE_MAJ_MIN,
      });
    }
  });

  it("createQueryReader (async) - repeated element existence queries", async () => {
    for (const iterations of QUERY_ITERATIONS) {
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const elementId = elementIds[i % elementIds.length];
        const ecsql = `SELECT ECInstanceId FROM bis.Element WHERE ECInstanceId = ${elementId}`;

        const reader = testIModel.createQueryReader(ecsql, undefined, { usePrimaryConn: true });
        const hasRow = await reader.step();
        assert.isTrue(hasRow, "Element should exist");
        reader.current.toRow();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      // eslint-disable-next-line no-console
      console.log(`createQueryReader (async) | ${iterations} iterations | total: ${totalTime.toFixed(2)}ms | avg: ${avgTime.toFixed(4)}ms`);

      reporter.addEntry("RepeatedQueryPerformanceTests", "createQueryReader (async) - element exists", "Total time (ms)", totalTime, {
        Iterations: iterations, CoreVersion: CORE_MAJ_MIN,
      });
      reporter.addEntry("RepeatedQueryPerformanceTests", "createQueryReader (async) - element exists", "Avg time per query (ms)", avgTime, {
        Iterations: iterations, CoreVersion: CORE_MAJ_MIN,
      });
    }
  });
});

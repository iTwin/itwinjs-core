/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { CsvWriter } from "@itwin/perf-tools";
import { IModelHost, IModelJsFs, StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { ECClass, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

interface Result {
  schemaName: string;
  firstLoad: number;
  averageLoad: number;
  medianLoad: number;
  minLoad: number;
  maxLoad: number;
  firstIterate: number;
  averageIterate: number;
  medianIterate: number;
  minIterate: number;
  maxIterate: number;
}

/*
* This test requires a directory of schema files to import, otherwise it will just run with basic schemas.
* To specify the directory, set the PERF_SCHEMA_DIR environment variable to the path of the directory containing the schema files.
*/
describe("PerformanceSchemaContextIModelDb", () => {
  let imodel: StandaloneDb;
  const csvWriter = new CsvWriter();
  const customSchemaNames: string[] = [];
  let testFileName: string;

  before(async () => {
    await IModelHost.startup();
    testFileName = IModelTestUtils.prepareOutputFile("PerformanceSchemaContextIModelDb", "PerformanceSchemaContextIModelDb.bim");

    if (IModelJsFs.existsSync(testFileName))
      IModelJsFs.removeSync(testFileName);

    imodel = StandaloneDb.createEmpty(testFileName, { rootSubject: { name: "Performance SchemaContext IModelDb Test" } });
    const perfSchemaDir = process.env.PERF_SCHEMA_DIR;
    if (perfSchemaDir && IModelJsFs.existsSync(perfSchemaDir)) {
      // eslint-disable-next-line no-console
      console.log(`PERF_SCHEMA_DIR is set to: ${perfSchemaDir}`);
      const schemaFiles = IModelJsFs.readdirSync(perfSchemaDir).filter((file) => file.endsWith(".ecschema.xml"));
      const schemaFileNames = schemaFiles.map((file) => path.join(perfSchemaDir, file));
      schemaFileNames.forEach((schemaFileName) => {
        const fileName = path.basename(schemaFileName);
        const schemaName = fileName.substring(0, fileName.indexOf('.'));
        customSchemaNames.push(schemaName);
      });
      try {
        await imodel.importSchemas(schemaFileNames);
        imodel.saveChanges("imported schemas");
      } catch (error) {
        assert.fail(`Failed to import schemas from directory ${perfSchemaDir}: ${(error as Error).message}`);
      }
    }
    assert.exists(imodel);
  });

  after(async () => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceSchemaContextIModelDbResults.csv");
    // eslint-disable-next-line no-console
    console.log(`Results are stored in ${csvPath}`);
    csvWriter.exportCSV(csvPath);

    imodel.abandonChanges();
    imodel.close();

    await IModelHost.shutdown();
  });

  function reportGetMetadataPerformance(schemaName: string, perfMeasure: Array<{ load: number; iterate: number }>) {
    const subsequentCalls = perfMeasure.slice(1);
    const loadTimes = subsequentCalls.map(({ load }) => load);
    const iterateTimes = subsequentCalls.map(({ iterate }) => iterate);
    const sortedLoadTimes = [...loadTimes].sort((a, b) => a - b);
    const sortedIterateTimes = [...iterateTimes].sort((a, b) => a - b);

    const result: Result = {
      schemaName,
      firstLoad: parseFloat(perfMeasure[0].load.toFixed(3)),
      averageLoad: parseFloat((loadTimes.reduce((acc, val) => acc + val, 0) / loadTimes.length).toFixed(3)),
      medianLoad: parseFloat((sortedLoadTimes.length % 2 === 0
        ? (sortedLoadTimes[sortedLoadTimes.length / 2 - 1] + sortedLoadTimes[sortedLoadTimes.length / 2]) / 2
        : sortedLoadTimes[Math.floor(sortedLoadTimes.length / 2)]).toFixed(3)),
      minLoad: parseFloat(Math.min(...loadTimes).toFixed(3)),
      maxLoad: parseFloat(Math.max(...loadTimes).toFixed(3)),
      firstIterate: parseFloat(perfMeasure[0].iterate.toFixed(3)),
      averageIterate: parseFloat((iterateTimes.reduce((acc, val) => acc + val, 0) / iterateTimes.length).toFixed(3)),
      medianIterate: parseFloat((sortedIterateTimes.length % 2 === 0
        ? (sortedIterateTimes[sortedIterateTimes.length / 2 - 1] + sortedIterateTimes[sortedIterateTimes.length / 2]) / 2
        : sortedIterateTimes[Math.floor(sortedIterateTimes.length / 2)]).toFixed(3)),
      minIterate: parseFloat(Math.min(...iterateTimes).toFixed(3)),
      maxIterate: parseFloat(Math.max(...iterateTimes).toFixed(3)),
    };

    assert.isTrue(result.averageLoad < result.firstLoad, "Average time for subsequent calls should always be less than the first call");
    csvWriter.addEntry(result);

    /*eslint-disable no-console*/
    console.log(JSON.stringify(result, null, 2));
  }

  it("load and iterate all schemas", async () => {
    const schemaNames = ["BisCore"];
    if (customSchemaNames.length > 0) {
      schemaNames.push(...customSchemaNames);
    }

    for (const schemaName of schemaNames) {
      imodel.close();
      imodel = StandaloneDb.openFile(testFileName);
      const perfMeasure: Array<{ load: number; iterate: number }> = [];

      for (let i = 0; i < 11; i++) {
        const start = performance.now(); // initialize timer
        const schema = await imodel.schemaContext.getSchema(new SchemaKey(schemaName), SchemaMatchType.Latest);
        assert.exists(schema, `Schema ${schemaName} should load`);
        const loadTime = performance.now() - start;

        const iterStart = performance.now();
        for (const item of schema!.getItems()) {
          if (ECClass.isECClass(item)) {
            for (const prop of await item.getProperties()) {
              // do nothing, just iterating
              assert.exists(prop);
            }
          }
        }
        const iterateTime = performance.now() - iterStart;
        perfMeasure.push({ load: loadTime, iterate: iterateTime });
      }

      reportGetMetadataPerformance(schemaName, perfMeasure);
    }
  });
});

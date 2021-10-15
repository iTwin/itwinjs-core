/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Reporter } from "@itwin/perf-tools";
import { IModelJsFs } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { PerfTestDataMgr } from "./PerfTestUtils";

describe("SchemaDesignPerf Schema Import", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ImportPerformance");
  let enumCounts: never[] = [];
  const reporter = new Reporter();

  function createSchema(count: number): string {
    let schemaPath = "";
    schemaPath = path.join(outDir, `TestEnumSchema_${count}.01.00.00.ecschema.xml`);
    if (!IModelJsFs.existsSync(schemaPath)) {
      let schemaXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestEnumSchema" alias="tes" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
            <ECEnumeration typeName="Domain" backingTypeName="string" isStrict="true">`;
      for (let i = 0; i < count; ++i) {
        schemaXml = `${schemaXml}<ECEnumerator name="Dom${i}" value=".dom${i}" />`;
      }
      schemaXml = `${schemaXml}</ECEnumeration>
          <ECEntityClass typeName="TestElement" >
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECProperty propertyName="Domain" typeName="Domain" />
          </ECEntityClass>`;
      schemaXml = `${schemaXml}</ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, schemaXml);
    }
    return schemaPath;
  }
  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    enumCounts = configData.import.enumCounts;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });
  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });
  it("ENum Import", async () => {
    for (const eCount of enumCounts) {
      const st = createSchema(eCount);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `import_${eCount}.bim`);
      if (IModelJsFs.existsSync(seedName)) {
        IModelJsFs.removeSync(seedName);
      }
      const tdm = new PerfTestDataMgr(seedName);
      const startTime = new Date().getTime();
      await tdm.importSchema(st, "TestEnumSchema:TestElement");
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;
      reporter.addEntry("SchemaImportPerfTest", "ENums", "Execution time(s)", elapsedTime, { enumCount: eCount });
      tdm.closeDb();
    }

  });
});

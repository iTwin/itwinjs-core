/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { KnownTestLocations } from "../test/KnownTestLocations";
import { assert } from "chai";
import * as path from "path";
import { IModelJsFs } from "../IModelJsFs";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import { PerfTestDataMgr } from "./PerfTestUtils";

describe("SchemaDesignPerf Schema Import", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ImportPerformance");
  let enumCounts: never[] = [];
  const reporter = new Reporter();

  function createSchema(count: number): string {
    let schemaPath = "";
    schemaPath = path.join(outDir, "TestEnumSchema_" + count.toString() + ".01.00.00.ecschema.xml");
    if (!IModelJsFs.existsSync(schemaPath)) {
      let sxml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestEnumSchema" alias="tes" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
            <ECEnumeration typeName="Domain" backingTypeName="string" isStrict="true">`;
      for (let i = 0; i < count; ++i) {
        sxml = sxml + `<ECEnumerator name="Dom` + i.toString() + `" value=".dom` + i.toString() + `" />`;
      }
      sxml = sxml + `</ECEnumeration>
          <ECEntityClass typeName="TestElement" >
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECProperty propertyName="Domain" typeName="Domain" />
          </ECEntityClass>`;
      sxml = sxml + `</ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, sxml);
    }
    return schemaPath;
  }
  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json"));
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
      const seedName = path.join(outDir, "import_" + eCount + ".bim");
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

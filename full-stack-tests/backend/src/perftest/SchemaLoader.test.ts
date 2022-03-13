/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Reporter } from "@itwin/perf-tools";
import { IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";

describe("SchemaLoaderPerformance", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "SchemaLoaderPerformance");
  const reporter = new Reporter();

  before(() => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });

  after(() => {
    const csvPath = path.join(outDir, "SchemaLoaderPerfResults.csv");
    reporter.exportCSV(csvPath);
  });

  function getSchemaPath(domain: string, schemaFileName: string): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", domain, schemaFileName);
  }

  function getSchemaPathFromPackage(packageName: string, schemaFileName: string): string {
    const schemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", packageName, schemaFileName);
    return schemaFile;
  }

  async function timeBisSchemasLoading(schemaName: string, schemaPath: string): Promise<void> {
    const rootSubject = { name: "Performance tests", description: "Performance tests" };
    const snapshotFile: string = IModelTestUtils.prepareOutputFile("Performance", "Performance.bim");
    const imodel: StandaloneDb = StandaloneDb.createEmpty(snapshotFile, { rootSubject });

    try {
      await imodel.importSchemas([schemaPath]);   // will throw an exception if import fails
    } catch (error) {
      throw new Error(`Failed to import schema ${schemaPath}`);
    }

    imodel.saveChanges();

    const startTime: number = new Date().getTime();
    const schemaResult = imodel.nativeDb.getSchema(schemaName);
    const endTime: number = new Date().getTime();

    if (schemaResult.error !== undefined) {
      throw new Error(schemaResult.error.message);
    }

    if (schemaResult.result === undefined) {
      throw new Error("Schema does not exists");
    }

    const elapsedTime = endTime - startTime;
    reporter.addEntry("SchemaLoaderPerfTest", `Loading schema: ${schemaName}`, "Execution time(ms)", elapsedTime, {});
    imodel.close();
  }

  async function memoryBisSchemasLoading(schemaName: string, schemaPath: string): Promise<void> {
    const rootSubject = { name: "Performance tests", description: "Performance tests" };
    const snapshotFile: string = IModelTestUtils.prepareOutputFile("Performance", "Performance.bim");
    const imodel: StandaloneDb = StandaloneDb.createEmpty(snapshotFile, { rootSubject });

    try {
      await imodel.importSchemas([schemaPath]);   // will throw an exception if import fails
    } catch (error) {
      throw new Error(`Failed to import schema ${schemaPath}`);
    }

    imodel.saveChanges();

    const beforeMemory: NodeJS.MemoryUsage = process.memoryUsage();
    const schemaResult = imodel.nativeDb.getSchema(schemaName);
    const afterMemory: NodeJS.MemoryUsage = process.memoryUsage();

    if (schemaResult.error !== undefined) {
      throw new Error(schemaResult.error.message);
    }

    if (schemaResult.result === undefined) {
      throw new Error("Schema does not exists");
    }

    const memoryUsed = afterMemory.heapUsed - beforeMemory.heapUsed;
    reporter.addEntry("SchemaLoaderPerfTest", `Loading schema: ${schemaName}`, "Memory used(bytes)", memoryUsed, {});
    imodel.close();
  }

  it("Time BisSchemas data read from imodel", async () => {
    await timeBisSchemasLoading("Units", getSchemaPath("Standard", "Units.01.00.07.ecschema.xml"));
    await timeBisSchemasLoading("Formats", getSchemaPath("Standard", "Formats.01.00.00.ecschema.xml"));

    await timeBisSchemasLoading("BisCore", getSchemaPath("Dgn", "BisCore.ecschema.xml"));

    // await timeBisSchemasLoading("ProcessFunctional", getSchemaPathFromPackage("process-functional-schema", "ProcessFunctional.ecschema.xml"));
    // await timeBisSchemasLoading("ProcessPhysical", getSchemaPathFromPackage("process-physical-schema", "ProcessPhysical.ecschema.xml"));

    // await timeBisSchemasLoading("CifBridge", getSchemaPathFromPackage("cif-bridge-schema", "CifBridge.ecschema.xml"));
    // await timeBisSchemasLoading("CifCmmon", getSchemaPathFromPackage("cif-common-schema", "CifCommon.ecschema.xml"));
    // await timeBisSchemasLoading("CifGeometricRules", getSchemaPathFromPackage("cif-geometric-rules-schema", "CifGeometricRules.ecschema.xml"));
    // await timeBisSchemasLoading("CifHydraulicAnalysis", getSchemaPathFromPackage("cif-hydraulic-analysis-schema", "CifHydraulicAnalysis.ecschema.xml"));
    // await timeBisSchemasLoading("CifHydraulicResults", getSchemaPathFromPackage("cif-hydraulic-results-schema", "CifHydraulicResults.ecschema.xml"));
    // await timeBisSchemasLoading("CifQuantityTakeoffs", getSchemaPathFromPackage("cif-quantity-takeoffs-schema", "CifQuantityTakeoffs.ecschema.xml"));
    // await timeBisSchemasLoading("CifRail", getSchemaPathFromPackage("cif-rail-schema", "CifRail.ecschema.xml"));
    // await timeBisSchemasLoading("CifRoads", getSchemaPathFromPackage("cif-roads-schema", "CifRoads.ecschema.xml"));
    // await timeBisSchemasLoading("CifSubsurface", getSchemaPathFromPackage("cif-subsurface-schema", "CifSubsurface.ecschema.xml"));
    // await timeBisSchemasLoading("CifSubsurfaceConflictAnalysis", getSchemaPathFromPackage("cif-subsurface-conflict-analysis-schema", "CifSubsurfaceConflictAnalysis.ecschema.xml"));
    await timeBisSchemasLoading("CifUnits", getSchemaPathFromPackage("cif-units-schema", "CifUnits.ecschema.xml"));
  });

  it("Memory used for BisSchemas data read from imodel", async () => {
    await memoryBisSchemasLoading("Units", getSchemaPath("Standard", "Units.01.00.07.ecschema.xml"));
    await memoryBisSchemasLoading("Formats", getSchemaPath("Standard", "Formats.01.00.00.ecschema.xml"));

    await memoryBisSchemasLoading("BisCore", getSchemaPath("Dgn", "BisCore.ecschema.xml"));

    // await memoryBisSchemasLoading("ProcessFunctional", getSchemaPathFromPackage("process-functional-schema", "ProcessFunctional.ecschema.xml"));
    // await memoryBisSchemasLoading("ProcessPhysical", getSchemaPathFromPackage("process-physical-schema", "ProcessPhysical.ecschema.xml"));

    // await memoryBisSchemasLoading("CifBridge", getSchemaPathFromPackage("cif-bridge-schema", "CifBridge.ecschema.xml"));
    // await memoryBisSchemasLoading("CifCmmon", getSchemaPathFromPackage("cif-common-schema", "CifCommon.ecschema.xml"));
    // await memoryBisSchemasLoading("CifGeometricRules", getSchemaPathFromPackage("cif-geometric-rules-schema", "CifGeometricRules.ecschema.xml"));
    // await memoryBisSchemasLoading("CifHydraulicAnalysis", getSchemaPathFromPackage("cif-hydraulic-analysis-schema", "CifHydraulicAnalysis.ecschema.xml"));
    // await memoryBisSchemasLoading("CifHydraulicResults", getSchemaPathFromPackage("cif-hydraulic-results-schema", "CifHydraulicResults.ecschema.xml"));
    // await memoryBisSchemasLoading("CifQuantityTakeoffs", getSchemaPathFromPackage("cif-quantity-takeoffs-schema", "CifQuantityTakeoffs.ecschema.xml"));
    // await memoryBisSchemasLoading("CifRail", getSchemaPathFromPackage("cif-rail-schema", "CifRail.ecschema.xml"));
    // await memoryBisSchemasLoading("CifRoads", getSchemaPathFromPackage("cif-roads-schema", "CifRoads.ecschema.xml"));
    // await memoryBisSchemasLoading("CifSubsurface", getSchemaPathFromPackage("cif-subsurface-schema", "CifSubsurface.ecschema.xml"));
    // await memoryBisSchemasLoading("CifSubsurfaceConflictAnalysis", getSchemaPathFromPackage("cif-subsurface-conflict-analysis-schema", "CifSubsurfaceConflictAnalysis.ecschema.xml"));
    await memoryBisSchemasLoading("CifUnits", getSchemaPathFromPackage("cif-units-schema", "CifUnits.ecschema.xml"));
  });
});

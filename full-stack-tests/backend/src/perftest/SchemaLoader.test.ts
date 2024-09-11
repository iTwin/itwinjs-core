/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import * as fs from "fs";
import { OpenMode } from "@itwin/core-bentley";

describe("SchemaLoaderPerformance", () => {
  let iModelFilepath: string;
  const outDir: string = path.join(KnownTestLocations.outputDir, "SchemaLoaderPerformance");
  const assetDir: string = path.join(__dirname, "..", "..", "..", "assets");
  const reporter = new Reporter();

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    if (!IModelJsFs.existsSync(assetDir))
      IModelJsFs.mkdirSync(assetDir);

    await IModelHost.startup();

    copyBisSchemasToAssetsDir();

    const rootSubject = { name: "Performance tests", description: "Performance tests" };
    const snapshotFile: string = IModelTestUtils.prepareOutputFile("Performance", "Performance.bim");
    const iModelDb = StandaloneDb.createEmpty(snapshotFile, { rootSubject });
    iModelFilepath = iModelDb.pathName;

    const bisSchemaPaths = getBisSchemaPaths();

    try {
      await iModelDb.importSchemas(bisSchemaPaths);   // will throw an exception if import fails
    } catch (error) {
      throw new Error(`Failed to import schemas`);
    }

    iModelDb.saveChanges();
    iModelDb.close();
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

  function getBisSchemaPaths(): string[] {
    const bisSchemaPaths: string[] = [];

    bisSchemaPaths.push(path.join(assetDir, "Units.01.00.08.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "Formats.01.00.00.ecschema.xml"));

    bisSchemaPaths.push(path.join(assetDir, "BisCore.ecschema.xml"));

    bisSchemaPaths.push(path.join(assetDir, "ProcessFunctional.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "ProcessPhysical.ecschema.xml"));

    bisSchemaPaths.push(path.join(assetDir, "CifBridge.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifCommon.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifGeometricRules.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifHydraulicAnalysis.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifHydraulicResults.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifQuantityTakeoffs.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifRail.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifRoads.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifSubsurface.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifSubsurfaceConflictAnalysis.ecschema.xml"));
    bisSchemaPaths.push(path.join(assetDir, "CifUnits.ecschema.xml"));

    return bisSchemaPaths;
  }

  function copyBisSchemasToAssetsDir() {
    // Copy BisSchemas that we need for performance testing
    fs.copyFileSync(getSchemaPath("Standard", "Units.01.00.08.ecschema.xml"), path.join(assetDir, "Units.01.00.08.ecschema.xml"));
    fs.copyFileSync(getSchemaPath("Standard", "Formats.01.00.00.ecschema.xml"), path.join(assetDir, "Formats.01.00.00.ecschema.xml"));

    fs.copyFileSync(getSchemaPath("Dgn", "BisCore.ecschema.xml"), path.join(assetDir, "BisCore.ecschema.xml"));

    fs.copyFileSync(getSchemaPathFromPackage("process-functional-schema", "ProcessFunctional.ecschema.xml"), path.join(assetDir, "ProcessFunctional.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("process-physical-schema", "ProcessPhysical.ecschema.xml"), path.join(assetDir, "ProcessPhysical.ecschema.xml"));

    fs.copyFileSync(getSchemaPathFromPackage("cif-bridge-schema", "CifBridge.ecschema.xml"), path.join(assetDir, "CifBridge.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-common-schema", "CifCommon.ecschema.xml"), path.join(assetDir, "CifCommon.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-geometric-rules-schema", "CifGeometricRules.ecschema.xml"), path.join(assetDir, "CifGeometricRules.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-hydraulic-analysis-schema", "CifHydraulicAnalysis.ecschema.xml"), path.join(assetDir, "CifHydraulicAnalysis.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-hydraulic-results-schema", "CifHydraulicResults.ecschema.xml"), path.join(assetDir, "CifHydraulicResults.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-quantity-takeoffs-schema", "CifQuantityTakeoffs.ecschema.xml"), path.join(assetDir, "CifQuantityTakeoffs.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-rail-schema", "CifRail.ecschema.xml"), path.join(assetDir, "CifRail.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-roads-schema", "CifRoads.ecschema.xml"), path.join(assetDir, "CifRoads.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-subsurface-schema", "CifSubsurface.ecschema.xml"), path.join(assetDir, "CifSubsurface.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-subsurface-conflict-analysis-schema", "CifSubsurfaceConflictAnalysis.ecschema.xml"), path.join(assetDir, "CifSubsurfaceConflictAnalysis.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("cif-units-schema", "CifUnits.ecschema.xml"), path.join(assetDir, "CifUnits.ecschema.xml"));

    // Copy the required reference schemas
    fs.copyFileSync(getSchemaPath("Domain", "Functional.ecschema.xml"), path.join(assetDir, "Functional.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("plant-custom-attributes-schema", "PlantCustomAttributes.ecschema.xml"), path.join(assetDir, "PlantCustomAttributes.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("quantity-takeoffs-aspects-schema", "QuantityTakeoffsAspects.ecschema.xml"), path.join(assetDir, "QuantityTakeoffsAspects.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("aec-units-schema", "AecUnits.ecschema.xml"), path.join(assetDir, "AecUnits.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("road-rail-units-schema", "RoadRailUnits.ecschema.xml"), path.join(assetDir, "RoadRailUnits.ecschema.xml"));
  }

  function timeBisSchemasLoading(schemaName: string) {
    const imodel: StandaloneDb = StandaloneDb.openFile(iModelFilepath, OpenMode.Readonly);

    const startTime: number = new Date().getTime();
    imodel[_nativeDb].getSchemaProps(schemaName);
    const endTime: number = new Date().getTime();

    const elapsedTime = endTime - startTime;
    reporter.addEntry("SchemaLoaderPerfTest", `Get schema from imodel: ${schemaName}`, "Execution time(ms)", elapsedTime, {});
    imodel.close();
  }

  async function timeBisSchemasLoadingAsync(schemaName: string) {
    const imodel: StandaloneDb = StandaloneDb.openFile(iModelFilepath, OpenMode.Readonly);

    const startTime: number = new Date().getTime();
    const schemaResult =  await imodel[_nativeDb].getSchemaPropsAsync(schemaName);
    const endTime: number = new Date().getTime();

    if (schemaResult === undefined) {
      throw new Error("Schema does not exist");
    }
    const elapsedTime = endTime - startTime;

    reporter.addEntry("SchemaLoaderPerfTest - Async", `Get schema from imodel: ${schemaName}`, "Execution time(ms)", elapsedTime, {});

    imodel.close();
  }

  it("Time BisSchemas data read from imodel", async () => {
    timeBisSchemasLoading("Units");
    timeBisSchemasLoading("Formats");

    timeBisSchemasLoading("BisCore");

    timeBisSchemasLoading("ProcessFunctional");
    timeBisSchemasLoading("ProcessPhysical");

    timeBisSchemasLoading("CifBridge");
    timeBisSchemasLoading("CifCommon");
    timeBisSchemasLoading("CifGeometricRules");
    timeBisSchemasLoading("CifHydraulicAnalysis");
    timeBisSchemasLoading("CifHydraulicResults");
    timeBisSchemasLoading("CifQuantityTakeoffs");
    timeBisSchemasLoading("CifRail");
    timeBisSchemasLoading("CifRoads");
    timeBisSchemasLoading("CifSubsurface");
    timeBisSchemasLoading("CifSubsurfaceConflictAnalysis");
    timeBisSchemasLoading("CifUnits");
  });

  it("Time BisSchemas data read from imodel - Async", async () => {
    await timeBisSchemasLoadingAsync("Units");
    await timeBisSchemasLoadingAsync("Formats");

    await timeBisSchemasLoadingAsync("BisCore");

    await timeBisSchemasLoadingAsync("ProcessFunctional");
    await timeBisSchemasLoadingAsync("ProcessPhysical");

    await timeBisSchemasLoadingAsync("CifBridge");
    await timeBisSchemasLoadingAsync("CifCommon");
    await timeBisSchemasLoadingAsync("CifGeometricRules");
    await timeBisSchemasLoadingAsync("CifHydraulicAnalysis");
    await timeBisSchemasLoadingAsync("CifHydraulicResults");
    await timeBisSchemasLoadingAsync("CifQuantityTakeoffs");
    await timeBisSchemasLoadingAsync("CifRail");
    await timeBisSchemasLoadingAsync("CifRoads");
    await timeBisSchemasLoadingAsync("CifSubsurface");
    await timeBisSchemasLoadingAsync("CifSubsurfaceConflictAnalysis");
    await timeBisSchemasLoadingAsync("CifUnits");
  });
});

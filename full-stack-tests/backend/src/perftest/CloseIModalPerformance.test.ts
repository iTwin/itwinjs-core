/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String, StopWatch } from "@itwin/core-bentley";
import {
  BriefcaseIdValue,
  Code,
  ColorDef,
  GeometricElementProps,
  IModel,
  SubCategoryAppearance,
} from "@itwin/core-common";
import {
  _nativeDb,
  IModelDb,
  IModelHost,
  IModelHostOptions,
  IModelJsFs,
  SnapshotDb,
  SpatialCategory,
} from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import * as path from "path";
import { Reporter } from "@itwin/perf-tools";

interface TestElement extends GeometricElementProps {
  addresses: [null, {city: "Pune", zip: 28}];
}

function initElemProps( _iModelName: IModelDb, modId: Id64String, catId: Id64String, autoHandledProp: any): GeometricElementProps {
  // Create props
  const elementProps: GeometricElementProps = {
    classFullName: "Test:Foo",
    model: modId,
    category: catId,
    code: Code.createEmpty(),
  };
  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);
  return elementProps;
}

describe("CloseIModalTest", () => {
  const reporter = new Reporter();
  const outDir: string = path.join(KnownTestLocations.outputDir, "CloseFilePerformance");

  const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECStructClass typeName="Location" modifier="Sealed">
    <ECProperty propertyName="City" typeName="string"/>
    <ECProperty propertyName="Zip" typeName="int"/>
  </ECStructClass>
  <ECEntityClass typeName="Foo" modifier="Sealed">
  <BaseClass>bis:PhysicalElement</BaseClass>
    <ECArrayProperty propertyName="I_Array" typeName="int"/>
    <ECArrayProperty propertyName="Dt_Array" typeName="dateTime"/>
    <ECStructArrayProperty propertyName="Addresses" typeName="Location"/>
  </ECEntityClass>
  </ECSchema>`;

  const schemaFileName = "CloseIModalTest.01.00.00.xml";
  const iModelFileName = "CloseIModalTest.bim";
  const categoryName = "CloseIModal";
  const subDirName = "CloseIModal";
  const iModelPath = IModelTestUtils.prepareOutputFile(
    subDirName,
    iModelFileName,
  );
  const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "imodel.bim");

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    // Preliminary setup required for the test
    const iModelHost: IModelHostOptions = {};
    const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
    iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);
    iModelHost.cacheDir = path.join(__dirname, ".cache");  // Set local cache dir
    await IModelHost.startup(iModelHost);
    // write schema to disk as we do not have api to import xml directly
    const testSchemaPath = IModelTestUtils.prepareOutputFile(
      subDirName,
      schemaFileName,
    );
    IModelJsFs.writeFileSync(testSchemaPath, testSchema);

    const rootImodel = SnapshotDb.createEmpty(iModelPath, {
      rootSubject: { name: "InsertNullStructArrayTest" },
    });
    await rootImodel.importSchemas([testSchemaPath]);
    rootImodel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      rootImodel,
      Code.createEmpty(),
      true,
    );

    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(
      rootImodel,
      IModel.dictionaryId,
      categoryName,
    );
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(
        rootImodel,
        IModel.dictionaryId,
        categoryName,
        new SubCategoryAppearance({
          color: ColorDef.create("rgb(255,0,0)").toJSON(),
        }),
      );

    rootImodel.saveChanges();
    rootImodel.close();

    // Create IModel in testFile
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    const expectedValue = initElemProps( imodel, newModelId, spatialCategoryId!, {
      addresses: [null, {city: "Pune", zip: 28}],
    }) as TestElement;
    imodel.elements.createElement(expectedValue);
    imodel.close();
  });

  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });

  it("Closing IModel with & without concurrent query initialized", async () => {
    const timeOperation = async (
      db: IModelDb,
      operation: (db: IModelDb) => Promise<void>,
    ) => {
      const sw = new StopWatch(undefined, true);
      await operation(db);
      return sw.elapsedSeconds;
    };
    const withSnapshotDb = async (
      fileName: string,
      operation: (db: IModelDb) => Promise<void>,
    ) => {
      const testModel = SnapshotDb.openFile(fileName);
      const opTime = await timeOperation(testModel, operation);
      const closeTime = await timeOperation(testModel, async (db: IModelDb) =>
        db.close(),
      );
      return { opTime, closeTime };
    };
    const stat = await withSnapshotDb(testFileName, async () => {
      /** do nothing */
    });

    reporter.addEntry("CloseIModalTest", "CloseFileTime", "Execution time when iModal closed with no query executed", stat.closeTime);

    const stat2 = await withSnapshotDb(testFileName, async (db: IModelDb) => {
      const rows = await db
        .createQueryReader("SELECT COUNT(*) FROM BisCore.Element")
        .toArray();
      expect(rows.length).equals(1);
    });

    reporter.addEntry("CloseIModalTest", "CloseFileTime", "Execution time when iModal closed and query is executed", stat2.closeTime);
  });
});

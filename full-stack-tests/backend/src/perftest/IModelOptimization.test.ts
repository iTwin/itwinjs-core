import { assert } from "chai";
import { IModelDb, IModelHost, IModelJsFs, PhysicalObject, SpatialCategory } from "@itwin/core-backend";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { Code, ColorByName, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import * as path from "path";

describe("iModelOptimization", () => {
  const numOfElements = 1000;
  const reportPath = path.join(KnownTestLocations.outputDir, "iModelOptimization.csv");

  before(() => {
    if (IModelJsFs.existsSync(reportPath)) {
      IModelJsFs.removeSync(reportPath);
    }
  });

  beforeEach(async () => {
    await IModelHost.startup();
    HubMock.startup("test", KnownTestLocations.outputDir);
  });

  afterEach(async () => {
    await IModelHost.shutdown();
    HubMock.shutdown();
  });

  function editImodel(testImodel: IModelDb) {
    // Create model and category
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(testImodel, IModel.dictionaryId, "TestCategory");
    if (!spatialCategoryId) {
      spatialCategoryId = SpatialCategory.insert(testImodel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    }
    const initialFileSize = IModelJsFs.lstatSync(testImodel.pathName)!.size;

    const elementIds: Id64String[] = [];

    // Insert a lot of elements
    for (let i = 0; i < numOfElements; i++) {
      const elementProps: GeometricElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: newModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        userLabel: `Element-${i}-${"X".repeat(200)}`,
      };
      const element = testImodel.elements.createElement(elementProps);
      element.setUserProperties("design", {
        version: 1,
        author: "UserA",
        notes: `ElementInserted!`.repeat(10),
        metadata: `Data-${i}`.repeat(20),
        description: `Description for element ${i}`.repeat(5),
      });
      const elementId = testImodel.elements.insertElement(element.toJSON());
      elementIds.push(elementId);
    }
    testImodel.saveChanges();

    // Update the elements in multiple passes to simulate an editing workflow
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < elementIds.length; i++) {
        const element = testImodel.elements.getElement(elementIds[i]);
        element.userLabel = `Updated-Pass${pass}-${i}-${"Y".repeat(i * pass)}`;
        element.setUserProperties("design", {
          version: pass + 2,
          author: `User-${String.fromCharCode(65 + pass)}`,
          notes: `Update-Pass${pass}`.repeat(10),
          metadata: `UpdatedData-${i}-Pass${pass}`.repeat(20),
          description: `Modified in pass ${pass}`.repeat(5),
        });
        testImodel.elements.updateElement(element.toJSON());
      }
      testImodel.saveChanges();
    }

    // Delete 70% of elements to create some fragmentation
    elementIds.sort(() => Math.random() - 0.5);
    for (let i = 0; i < numOfElements * 0.7; i++) {
      testImodel.elements.deleteElement(elementIds[i]);
    }
    testImodel.saveChanges();

    testImodel.performCheckpoint();

    return [initialFileSize, IModelJsFs.lstatSync(testImodel.pathName)!.size];
  }

  function validateAndReport(testImodelPath: string, initialFileSize: number, fileSizeBeforeOptimize: number, testName: string) {
    const fileSizeAfterOptimize = IModelJsFs.lstatSync(testImodelPath)!.size;

    // After optimize, the file should be smaller
    assert.isTrue(fileSizeAfterOptimize < fileSizeBeforeOptimize, `File size should decrease after optimize. Before: ${fileSizeBeforeOptimize}, After: ${fileSizeAfterOptimize}`);

    const reductionPercent = ((fileSizeBeforeOptimize - fileSizeAfterOptimize) / fileSizeBeforeOptimize) * 100;
    const savedBytes = fileSizeBeforeOptimize - fileSizeAfterOptimize;

    assert.isTrue(reductionPercent > 10, `Expected at least 10% reduction from editing workflow fragmentation, got ${reductionPercent.toFixed(2)}%`);

    const reporter = new Reporter();
    reporter.addEntry("IModelOptimization", testName, "Initial file size (bytes)", initialFileSize);
    reporter.addEntry("IModelOptimization", testName, "File size before optimize (bytes)", fileSizeBeforeOptimize);
    reporter.addEntry("IModelOptimization", testName, "File size after optimize (bytes)", fileSizeAfterOptimize);
    reporter.addEntry("IModelOptimization", testName, "Space reclaimed (KB)", savedBytes / 1024);
    reporter.addEntry("IModelOptimization", testName, "Reduction percentage (%)", reductionPercent);
    reporter.addEntry("IModelOptimization", testName, "Elements created", numOfElements);
    reporter.addEntry("IModelOptimization", testName, "Elements deleted", numOfElements * 0.7);
    reporter.addEntry("IModelOptimization", testName, "Elements remaining", numOfElements * 0.3);
    reporter.exportCSV(path.join(KnownTestLocations.outputDir, "iModelOptimization.csv"));
  }

  it("optimize() should reduce file size after large deletions with bulk data", async () => {
    const iModelId = await HubMock.createNewIModel({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelName: "iModelOptimize", noLocks: true });
    const briefcaseDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelId });

    const [initialFileSize, fileSizeBeforeOptimize] = editImodel(briefcaseDb);
    const pathName = briefcaseDb.pathName;

    // Optimize the iModel by resolving fragmentation
    briefcaseDb.optimize();
    briefcaseDb.saveChanges();
    briefcaseDb.performCheckpoint();
    briefcaseDb.close();

    validateAndReport(pathName, initialFileSize, fileSizeBeforeOptimize, "optimize()");
  });

  it("IModelDb.close() should reduce file size after large deletions with bulk data", async () => {
    const iModelId = await HubMock.createNewIModel({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelName: "iModelOptimizeOnClose", noLocks: true });
    const briefcaseDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelId });

    const [initialFileSize, fileSizeBeforeOptimize] = editImodel(briefcaseDb);
    const pathName = briefcaseDb.pathName;

    // Optimize the iModel by resolving fragmentation
    briefcaseDb.performCheckpoint();
    briefcaseDb.close({ optimize: true });

    validateAndReport(pathName, initialFileSize, fileSizeBeforeOptimize, "close()");
  });

  it("IModelDb.close() without optimization", async () => {
    const iModelId = await HubMock.createNewIModel({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelName: "iModelOptimizeOnClose", noLocks: true });
    const briefcaseDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelId });

    const [, fileSizeBeforeOptimize] = editImodel(briefcaseDb);
    const pathName = briefcaseDb.pathName;

    // Don't optimize the iModel during close
    briefcaseDb.performCheckpoint();
    briefcaseDb.close();

    // After closing without optimize, the file size should be the same
    assert.equal(fileSizeBeforeOptimize, IModelJsFs.lstatSync(pathName)!.size);
  });

  it("analyzeIModel() should create SQLite statistics tables", async () => {
    const iModelId = await HubMock.createNewIModel({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelName: "iModelAnalyze", noLocks: true });
    const briefcaseDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "User1", iTwinId: HubMock.iTwinId, iModelId });

    // Create some data for analysis
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(briefcaseDb, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(briefcaseDb, IModel.dictionaryId, "TestCategory");
    if (!spatialCategoryId) {
      spatialCategoryId = SpatialCategory.insert(briefcaseDb, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    }

    // Insert more elements to ensure statistics are meaningful
    for (let i = 0; i < 500; i++) {
      const elementProps: GeometricElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: newModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
        userLabel: `AnalyzeTest-${i}`,
      };
      briefcaseDb.elements.insertElement(elementProps);
    }
    briefcaseDb.performCheckpoint();
    briefcaseDb.saveChanges();

    // Check statistics data before analyze
    const getStatsCount = (): number => {
      return briefcaseDb.withPreparedSqliteStatement("SELECT COUNT(*) FROM sqlite_stat1", (stmt) => {
        if (stmt.step() === DbResult.BE_SQLITE_ROW) {
          return stmt.getValue(0).getInteger();
        }
        return 0;
      });
    };

    const statsBeforeAnalyze = getStatsCount();

    // Run analyze
    briefcaseDb.analyze();
    briefcaseDb.saveChanges();

    // Check statistics after analyze
    const statsAfterAnalyze = getStatsCount();
    assert.isTrue(statsAfterAnalyze > 0, `analyze() should populate statistics. Before: ${statsBeforeAnalyze}, After: ${statsAfterAnalyze}`);
    briefcaseDb.close();
  });
});

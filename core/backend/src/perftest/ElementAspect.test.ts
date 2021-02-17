/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelHubError } from "@bentley/imodelhub-client";
import { ElementAspectProps, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import { DictionaryModel, ElementAspect, IModelDb, SnapshotDb, SpatialCategory } from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { KnownTestLocations } from "../test/KnownTestLocations";

/* eslint-disable @typescript-eslint/naming-convention */

async function createNewModelAndCategory(requestContext: AuthorizedClientRequestContext, rwIModel: IModelDb) {
  // Create a new physical model.
  const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, new SubCategoryAppearance({ color: 0xff0000 }));
  // Reserve all of the codes that are required by the new model and category.
  try {
    if (rwIModel.isBriefcaseDb()) {
      await rwIModel.concurrencyControl.request(requestContext);
      requestContext.enter();
    }
  } catch (err) {
    if (err instanceof IModelHubError) {
      assert.fail(JSON.stringify(err));
    }
  }
  return { modelId, spatialCategoryId };
}

describe("ElementAspectPerformance", () => {
  const reporter = new Reporter();
  let requestContext: AuthorizedClientRequestContext;
  let iModelDbHub: SnapshotDb;

  before(async () => {
    if (!fs.existsSync(KnownTestLocations.outputDir))
      fs.mkdirSync(KnownTestLocations.outputDir);
    const configData = require(path.join(__dirname, "CSPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    const projectId = configData.basicTest.projectId;
    const imodelId = configData.basicTest.aspectIModelId;

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    iModelDbHub = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: projectId, iModelId: imodelId });
    assert.exists(iModelDbHub);
  });

  after(async () => {
    const csvPath = path.join(KnownTestLocations.outputDir, "ElementAspectPerfTests.csv");
    reporter.exportCSV(csvPath);

    iModelDbHub.close();
  });

  it("SimpleElement-Insert-Update-Delete-Read", async () => {
    const snapshotPath = path.join(KnownTestLocations.outputDir, "SimpleELe.bim");
    assert.exists(iModelDbHub);
    const iModelDb = SnapshotDb.createFrom(iModelDbHub, snapshotPath);
    assert.exists(iModelDb);

    let eleId: Id64String;
    const count1 = 10000;
    let totalTimeReadSimpELeGet = 0;
    let totalTimeInsertSimpELeGet = 0;
    let totalTimeUpdateSimpELeGet = 0;
    let totalTimeDeleteSimpELeGet = 0;

    const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, iModelDb);

    for (let m = 0; m < count1; ++m) {
      // insert simple element with no aspect
      const startTime1 = new Date().getTime();
      eleId = iModelDb.elements.insertElement(IModelTestUtils.createPhysicalObject(iModelDb, r.modelId, r.spatialCategoryId));
      const endTime1 = new Date().getTime();
      const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
      totalTimeInsertSimpELeGet = totalTimeInsertSimpELeGet + elapsedTime1;

      // read simple element with no aspect
      const startTime = new Date().getTime();
      const returnEle = iModelDb.elements.getElement(eleId);
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;
      totalTimeReadSimpELeGet = totalTimeReadSimpELeGet + elapsedTime;
      assert.exists(returnEle);

      // update simple element with no aspect
      const startTime2 = new Date().getTime();
      const returnEle1 = iModelDb.elements.getElement(eleId);
      returnEle1.userLabel = `${returnEle1.userLabel}updated`;
      iModelDb.elements.updateElement(returnEle1);
      const endTime2 = new Date().getTime();
      const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
      totalTimeUpdateSimpELeGet = totalTimeUpdateSimpELeGet + elapsedTime2;

      // delete simple element with no aspect
      const startTime3 = new Date().getTime();
      iModelDb.elements.deleteElement(eleId);
      const endTime3 = new Date().getTime();
      const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
      totalTimeDeleteSimpELeGet = totalTimeDeleteSimpELeGet + elapsedTime3;

    }
    iModelDb.close();
    reporter.addEntry("ElementAspectPerformance", "SimpleElement", "Execution time(s)", totalTimeInsertSimpELeGet, { ElementCount: count1, Operation: "Insert" });
    reporter.addEntry("ElementAspectPerformance", "SimpleElement", "Execution time(s)", totalTimeUpdateSimpELeGet, { ElementCount: count1, Operation: "Update" });
    reporter.addEntry("ElementAspectPerformance", "SimpleElement", "Execution time(s)", totalTimeDeleteSimpELeGet, { ElementCount: count1, Operation: "Delete" });
    reporter.addEntry("ElementAspectPerformance", "SimpleElement", "Execution time(s)", totalTimeReadSimpELeGet, { ElementCount: count1, Operation: "Read" });
  });

  it("UniqueAspectElement-Insert-Update-Delete-Read", async () => {
    const snapshotPath = path.join(KnownTestLocations.outputDir, "UniqueAspectELe.bim");
    assert.exists(iModelDbHub);
    const iModelDb = SnapshotDb.createFrom(iModelDbHub, snapshotPath);
    assert.exists(iModelDb);

    interface TestAspectProps extends ElementAspectProps { testUniqueAspectProperty: string }
    class TestAspect extends ElementAspect implements ElementAspectProps { public testUniqueAspectProperty: string = ""; }

    const count1 = 10000;
    let eleId: Id64String;
    let aspectProps: TestAspectProps;
    let totalTimeInsert = 0;
    let totalTimeUpdate = 0;
    let totalTimeDelete = 0;
    let totalTimeRead = 0;

    const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, iModelDb);

    for (let m = 0; m < count1; ++m) {
      // insert element with unique aspect
      const startTime1 = new Date().getTime();
      eleId = iModelDb.elements.insertElement(IModelTestUtils.createPhysicalObject(iModelDb, r.modelId, r.spatialCategoryId));
      aspectProps = {
        classFullName: "DgnPlatformTest:TestUniqueAspectNoHandler",
        element: { id: eleId },
        testUniqueAspectProperty: "UniqueAspectInsertTest1",
      };

      iModelDb.elements.insertAspect(aspectProps);
      const endTime1 = new Date().getTime();
      const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
      totalTimeInsert = totalTimeInsert + elapsedTime1;

      // read element with unique aspect
      const startTime4 = new Date().getTime();
      const returnEle1 = iModelDb.elements.getElement(eleId);
      const aspects4 = iModelDb.elements.getAspects(returnEle1.id, aspectProps.classFullName) as TestAspect[];
      const endTime4 = new Date().getTime();
      const elapsedTime4 = (endTime4 - startTime4) / 1000.0;
      assert.exists(returnEle1);
      totalTimeRead = totalTimeRead + elapsedTime4;
      assert.isTrue(aspects4.length === 1);

      // update element with unique aspect
      const startTime2 = new Date().getTime();
      const returnEle2 = iModelDb.elements.getElement(eleId);
      returnEle1.userLabel = `${returnEle1.userLabel}updated`;
      iModelDb.elements.updateElement(returnEle1);
      const aspects = iModelDb.elements.getAspects(returnEle2.id, aspectProps.classFullName) as TestAspect[];
      aspects[0].testUniqueAspectProperty = "UniqueAspectInsertTest1-Updated";
      iModelDb.elements.updateAspect(aspects[0]);
      const endTime2 = new Date().getTime();
      const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
      const aspectsUpdated = iModelDb.elements.getAspects(eleId, aspectProps.classFullName) as TestAspect[];
      assert.equal(aspectsUpdated.length, 1);
      assert.equal(aspectsUpdated[0].testUniqueAspectProperty, "UniqueAspectInsertTest1-Updated");
      totalTimeUpdate = totalTimeUpdate + elapsedTime2;

      // delete element with unique aspect
      const startTime3 = new Date().getTime();
      iModelDb.elements.deleteElement(eleId);
      const endTime3 = new Date().getTime();
      const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
      totalTimeDelete = totalTimeDelete + elapsedTime3;
    }
    iModelDb.close();
    reporter.addEntry("ElementAspectPerformance", "UniqueAspectElement", "Execution time(s)", totalTimeInsert, { ElementCount: count1, Operation: "Insert" });
    reporter.addEntry("ElementAspectPerformance", "UniqueAspectElement", "Execution time(s)", totalTimeUpdate, { ElementCount: count1, Operation: "Update" });
    reporter.addEntry("ElementAspectPerformance", "UniqueAspectElement", "Execution time(s)", totalTimeDelete, { ElementCount: count1, Operation: "Delete" });
    reporter.addEntry("ElementAspectPerformance", "UniqueAspectElement", "Execution time(s)", totalTimeRead, { ElementCount: count1, Operation: "Read" });
  });

  it("MultiAspectElement-Insert-Update-Delete-Read", async () => {
    const snapshotPath = path.join(KnownTestLocations.outputDir, "MultiApectELe.bim");
    assert.exists(iModelDbHub);
    const iModelDb = SnapshotDb.createFrom(iModelDbHub, snapshotPath);
    assert.exists(iModelDb);

    const count1 = 10000;
    let eleId: Id64String;
    let totalTimeInsert = 0;
    let totalTimeUpdate = 0;
    let totalTimeDelete = 0;
    let totalTimeRead = 0;

    const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, iModelDb);

    for (let m = 0; m < count1; ++m) {
      // insert element with multi aspect
      const startTime1 = new Date().getTime();
      eleId = iModelDb.elements.insertElement(IModelTestUtils.createPhysicalObject(iModelDb, r.modelId, r.spatialCategoryId));
      assert.exists(eleId);
      const aspectProps = {
        classFullName: "DgnPlatformTest:TestMultiAspectNoHandler",
        element: { id: eleId },
        testMultiAspectProperty: "MultiAspectInsertTest1",
      };
      iModelDb.elements.insertAspect(aspectProps);
      const endTime1 = new Date().getTime();
      const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
      totalTimeInsert = totalTimeInsert + elapsedTime1;

      // read element with multi aspect
      const startTime4 = new Date().getTime();
      const returnEle1 = iModelDb.elements.getElement(eleId);
      const aspects: ElementAspect[] = iModelDb.elements.getAspects(returnEle1.id, aspectProps.classFullName);
      const endTime4 = new Date().getTime();
      const elapsedTime4 = (endTime4 - startTime4) / 1000.0;
      assert.exists(returnEle1);
      totalTimeRead = totalTimeRead + elapsedTime4;
      assert.isAtLeast(aspects.length, 1);

      let found: boolean = false;
      let foundIndex: number = -1;
      for (const aspect of aspects) {
        foundIndex++;
        if ((aspect as any).testMultiAspectProperty === aspectProps.testMultiAspectProperty) {
          found = true;
          break;
        }
      }
      assert.isTrue(found);

      // update element with multi aspect
      const startTime2 = new Date().getTime();
      const returnEle2 = iModelDb.elements.getElement(eleId);
      returnEle2.userLabel = `${returnEle2.userLabel}updated`;
      iModelDb.elements.updateElement(returnEle2);
      const aspects1: ElementAspect[] = iModelDb.elements.getAspects(returnEle2.id, aspectProps.classFullName);
      (aspects1[foundIndex] as any).testMultiAspectProperty = "MultiAspectInsertTest1-Updated";
      iModelDb.elements.updateAspect(aspects1[foundIndex]);
      const endTime2 = new Date().getTime();
      const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
      totalTimeUpdate = totalTimeUpdate + elapsedTime2;

      const aspectsUpdated: ElementAspect[] = iModelDb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.equal(aspectsUpdated.length, aspects1.length);
      assert.equal((aspectsUpdated[foundIndex] as any).testMultiAspectProperty, "MultiAspectInsertTest1-Updated");

      // delete element with multi aspect
      const startTime3 = new Date().getTime();
      iModelDb.elements.deleteElement(eleId);
      const endTime3 = new Date().getTime();
      const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
      totalTimeDelete = totalTimeDelete + elapsedTime3;
    }
    iModelDb.close();
    reporter.addEntry("ElementAspectPerformance", "MultiAspectElement", "Execution time(s)", totalTimeInsert, { ElementCount: count1, Operation: "Insert" });
    reporter.addEntry("ElementAspectPerformance", "MultiAspectElement", "Execution time(s)", totalTimeUpdate, { ElementCount: count1, Operation: "Update" });
    reporter.addEntry("ElementAspectPerformance", "MultiAspectElement", "Execution time(s)", totalTimeDelete, { ElementCount: count1, Operation: "Delete" });
    reporter.addEntry("ElementAspectPerformance", "MultiAspectElement", "Execution time(s)", totalTimeRead, { ElementCount: count1, Operation: "Read" });
  });
});

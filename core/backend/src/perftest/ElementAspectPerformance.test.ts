import {
  IModelDb, IModelHost, OpenParams, ElementAspect, DictionaryModel, SpatialCategory,
  ConcurrencyControl, IModelJsFs,
} from "../imodeljs-backend";
import { Config, ImsUserCredentials, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { IModelVersion, ElementAspectProps, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { Id64String } from "@bentley/bentleyjs-core";
import { KnownTestLocations } from "../test/KnownTestLocations";
import * as path from "path";
import * as fs from "fs";

export async function createNewModelAndCategory(requestContext: AuthorizedClientRequestContext, rwIModel: IModelDb) {
  // Create a new physical model.
  let modelId: Id64String;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));
  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(requestContext);
  } catch (err) {
    if (err instanceof ConcurrencyControl.RequestError) {
      assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
    }
  }
  return { modelId, spatialCategoryId };
}

describe("ElementAspectPerfomance", () => {
  if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
    IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
  const csvPath = path.join(KnownTestLocations.outputDir, "ElementAspectPerfTests.csv");
  if (!IModelJsFs.existsSync(csvPath)) {
    fs.appendFileSync(csvPath, "Operation,Description,ExecutionTime,Count\n");
  }
  let requestContext: AuthorizedClientRequestContext;
  let projectId: string;
  let imodelId: string;
  before(async () => {
    const fs1 = require("fs");
    const configData = JSON.parse(fs1.readFileSync("src/perftest/CSPerfConfig.json"));
    projectId = configData.projectId;
    imodelId = configData.aspectIModelId;
    const myAppConfig = {
      imjs_buddi_resolve_url_using_region: 102,
      imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
    };
    Config.App.merge(myAppConfig);
    IModelHost.loadNative(myAppConfig.imjs_buddi_resolve_url_using_region);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const userCredentials: ImsUserCredentials = {
      email: configData.username,
      password: configData.password,
    };
    requestContext = await IModelTestUtils.getTestUserRequestContext(userCredentials);
  });

  it("Element Unique Aspect Insertion, Updation, Deletion", async () => {
    const imodeldb: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(imodeldb);

    const count1 = 10;
    let eleId: Id64String;
    let aspectProps: ElementAspectProps;
    let totalTimeInsert = 0;
    let totalTimeUpdate = 0;
    let totalTimeDelete = 0;

    for (let m = 0; m < count1; ++m) {
      const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, imodeldb);
      eleId = imodeldb.elements.insertElement(IModelTestUtils.createPhysicalObject(imodeldb, r.modelId, r.spatialCategoryId));
      aspectProps = {
        classFullName: "DgnPlatformTest:TestUniqueAspectNoHandler",
        element: { id: eleId },
        testUniqueAspectProperty: "UniqueAspectInsertTest1",
      };

      // insert element unique aspect
      const startTime1 = new Date().getTime();
      imodeldb.elements.insertAspect(aspectProps);
      const endTime1 = new Date().getTime();
      const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
      totalTimeInsert = totalTimeInsert + elapsedTime1;

      const aspects: ElementAspect[] = imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.isTrue(aspects.length === 1);
      assert.equal(aspects[0].testUniqueAspectProperty, aspectProps.testUniqueAspectProperty);

      // update element unique aspect
      aspects[0].testUniqueAspectProperty = "UniqueAspectInsertTest1-Updated";
      const startTime2 = new Date().getTime();
      imodeldb.elements.updateAspect(aspects[0]);
      const endTime2 = new Date().getTime();
      const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
      totalTimeUpdate = totalTimeUpdate + elapsedTime2;

      const aspectsUpdated: ElementAspect[] = imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.equal(aspectsUpdated.length, 1);
      assert.equal(aspectsUpdated[0].testUniqueAspectProperty, "UniqueAspectInsertTest1-Updated");

      // delete element unique aspect
      const startTime3 = new Date().getTime();
      imodeldb.elements.deleteAspect(aspects[0].id);
      const endTime3 = new Date().getTime();
      const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
      totalTimeDelete = totalTimeDelete + elapsedTime3;
      try {
        imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
        assert.isTrue(false, "Expected this line to be skipped");
      } catch (error) {
        assert.isTrue(error instanceof Error);
      }
    }
    fs.appendFileSync(csvPath, "Insert, Unique Aspect," + totalTimeInsert + "," + count1 + "\n");
    fs.appendFileSync(csvPath, "Update, Unique Aspect," + totalTimeUpdate + "," + count1 + "\n");
    fs.appendFileSync(csvPath, "Delete, Unique Aspect," + totalTimeDelete + "," + count1 + "\n");
    imodeldb.close(requestContext).catch();
  });

  it("Element Multi Aspect Insertion, Updation, Deletion", async () => {
    const imodeldb: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(imodeldb);

    const count1 = 10;
    let eleId: Id64String;
    let totalTimeInsert = 0;
    let totalTimeUpdate = 0;
    let totalTimeDelete = 0;

    for (let m = 0; m < count1; ++m) {
      const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, imodeldb);
      eleId = imodeldb.elements.insertElement(IModelTestUtils.createPhysicalObject(imodeldb, r.modelId, r.spatialCategoryId));

      const aspectProps: ElementAspectProps = {
        classFullName: "DgnPlatformTest:TestMultiAspectNoHandler",
        element: { id: eleId },
        testMultiAspectProperty: "MultiAspectInsertTest1",
      };

      // insert element multi aspect
      const startTime1 = new Date().getTime();
      imodeldb.elements.insertAspect(aspectProps);
      const endTime1 = new Date().getTime();
      const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
      totalTimeInsert = totalTimeInsert + elapsedTime1;

      let aspects: ElementAspect[] = imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.isAtLeast(aspects.length, 1);
      const numAspects = aspects.length;

      let found: boolean = false;
      let foundIndex: number = -1;
      for (const aspect of aspects) {
        foundIndex++;
        if (aspect.testMultiAspectProperty === aspectProps.testMultiAspectProperty) {
          found = true;
          break;
        }
      }
      assert.isTrue(found);

      // update element multi aspect
      aspects[foundIndex].testMultiAspectProperty = "MultiAspectInsertTest1-Updated";
      const startTime2 = new Date().getTime();
      imodeldb.elements.updateAspect(aspects[foundIndex]);
      const endTime2 = new Date().getTime();
      const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
      totalTimeUpdate = totalTimeUpdate + elapsedTime2;

      const aspectsUpdated: ElementAspect[] = imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.equal(aspectsUpdated.length, aspects.length);
      assert.equal(aspectsUpdated[foundIndex].testMultiAspectProperty, "MultiAspectInsertTest1-Updated");

      // delete element multi aspect
      const startTime3 = new Date().getTime();
      imodeldb.elements.deleteAspect(aspects[foundIndex].id);
      const endTime3 = new Date().getTime();
      const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
      totalTimeDelete = totalTimeDelete + elapsedTime3;

      aspects = imodeldb.elements.getAspects(eleId, aspectProps.classFullName);
      assert.equal(numAspects, aspects.length + 1);
    }
    fs.appendFileSync(csvPath, "Insert, Multi Aspect," + totalTimeInsert + "," + count1 + "\n");
    fs.appendFileSync(csvPath, "Update, Multi Aspect," + totalTimeUpdate + "," + count1 + "\n");
    fs.appendFileSync(csvPath, "Delete, Multi Aspect," + totalTimeDelete + "," + count1 + "\n");

  });
});

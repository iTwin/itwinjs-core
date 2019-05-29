/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import { assert } from "chai";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelVersion, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { Config, IModelHubClient, ChangeSet, HubIModel, IModelQuery, AuthorizedClientRequestContext, ImsUserCredentials } from "@bentley/imodeljs-clients";
import {
  IModelDb, OpenParams, IModelJsFs, KeepBriefcase, ConcurrencyControl,
  DictionaryModel, SpatialCategory, BriefcaseManager, Element, IModelHost,
} from "../imodeljs-backend";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { IModelTestUtils, TestIModelInfo } from "../test/IModelTestUtils";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";

async function getImodelAfterApplyingCS(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string, imodelId: string, client: IModelHubClient) {
  csvPath = csvPath;
  reporter = reporter;
  const changeSets: ChangeSet[] = await client.changeSets.get(requestContext, imodelId);
  const firstChangeSetId = changeSets[0].wsgId;
  const secondChangeSetId = changeSets[1].wsgId;

  /*  // open imodel from local cache with first revision
   const startTime2 = new Date().getTime();
   const imodeldb2: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.first());
   const endTime2 = new Date().getTime();
   assert.exists(imodeldb2);
   const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
   imodeldb2.close(requestContext).catch();
   fs.appendFileSync(csvPath, "Open, From Cache First CS," + elapsedTime2 + "\n"); */

  // open imodel first time from imodel-hub with first revision
  const startTime = new Date().getTime();
  const imodeldb: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(firstChangeSetId));
  const endTime = new Date().getTime();
  assert.exists(imodeldb);
  const elapsedTime = (endTime - startTime) / 1000.0;
  assert.strictEqual<string>(imodeldb.briefcase.currentChangeSetId, firstChangeSetId);
  imodeldb.close(requestContext).catch();
  fs.appendFileSync(csvPath, "Open, From Hub first cs," + elapsedTime + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime, { Description: "from hub first CS", Operation: "Open" });

  // open imodel from local cache with second revision
  const startTime1 = new Date().getTime();
  const imodeldb1: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(secondChangeSetId));
  const endTime1 = new Date().getTime();
  assert.exists(imodeldb1);
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  assert.strictEqual<string>(imodeldb1.briefcase.currentChangeSetId, secondChangeSetId);
  imodeldb1.close(requestContext).catch();
  fs.appendFileSync(csvPath, "Open, From Cache second cs," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime1, { Description: "from cache second CS", Operation: "Open" });

  // open imodel from local cache with latest revision
  const startTime3 = new Date().getTime();
  const imodeldb3: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.fixedVersion(), IModelVersion.latest());
  const endTime3 = new Date().getTime();
  assert.exists(imodeldb3);
  const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
  imodeldb3.close(requestContext).catch();
  fs.appendFileSync(csvPath, "Open, From Cache Latest CS," + elapsedTime3 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime3, { Description: "from cache latest CS", Operation: "Open" });
}

async function pushImodelAfterMetaChanges(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string, imodelPushId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const iModelPullAndPush: IModelDb = await IModelDb.open(requestContext, projectId, imodelPushId, OpenParams.pullAndPush(), IModelVersion.latest());
  assert.exists(iModelPullAndPush);

  // get the time of applying a meta data change on an imodel
  const startTime = new Date().getTime();
  const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
  rootEl.userLabel = rootEl.userLabel + "changed";
  iModelPullAndPush.elements.updateElement(rootEl);
  iModelPullAndPush.saveChanges("user changes root subject of the imodel");
  const endTime = new Date().getTime();
  const elapsedTime = (endTime - startTime) / 1000.0;
  fs.appendFileSync(csvPath, "Update, Make Meta Changes," + elapsedTime + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "PushMetaChangeToHub", "Execution time(s)", elapsedTime, { Description: "make meta changes", Operation: "Update" });

  try {
    // get the time to push a meta data change of an imodel to imodel hub
    const startTime1 = new Date().getTime();
    await iModelPullAndPush.pushChanges(requestContext);
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    fs.appendFileSync(csvPath, "Push, Meta Changes to Hub," + elapsedTime1 + "\n");
    reporter.addEntry("ImodelChangesetPerformance", "PushMetaChangeToHub", "Execution time(s)", elapsedTime1, { Description: "meta changes to hub", Operation: "Push" });
  } catch (error) { }
  await iModelPullAndPush.close(requestContext, KeepBriefcase.No);
}

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

async function pushImodelAfterDataChanges(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const iModelName = "CodesPushTest";
  // delete any existing imodel with given name
  const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
  for (const iModelTemp of iModels) {
    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelTemp.id!);
  }
  // create new imodel with given name
  const rwIModel: IModelDb = await IModelDb.create(requestContext, projectId, iModelName, { rootSubject: { name: "TestSubject" } });
  const rwIModelId = rwIModel.iModelToken.iModelId;
  assert.isNotEmpty(rwIModelId);

  // create new model, category and physical element, and insert in imodel
  rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");

  // get the time to push a data change of an imodel to imodel hub
  const startTime1 = new Date().getTime();
  await rwIModel.pushChanges(requestContext).catch();
  const endTime1 = new Date().getTime();
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  fs.appendFileSync(csvPath, "Push, Data Changes to Hub," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "PushDataChangeToHub", "Execution time(s)", elapsedTime1, { Description: "data changes to hub", Operation: "Push" });
  await rwIModel.close(requestContext, KeepBriefcase.No);
}

async function pushImodelAfterSchemaChanges(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const iModelName = "SchemaPushTest";
  // delete any existing imodel with given name
  const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
  for (const iModelTemp of iModels) {
    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelTemp.id!);
  }
  // create new imodel with given name
  const rwIModel: IModelDb = await IModelDb.create(requestContext, projectId, iModelName, { rootSubject: { name: "TestSubject" } });
  const rwIModelId = rwIModel.iModelToken.iModelId;
  assert.isNotEmpty(rwIModelId);
  // import schema and push change to hub
  const schemaPathname = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
  rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  await rwIModel.importSchema(requestContext, schemaPathname).catch();
  assert.isDefined(rwIModel.getMetaData("PerfTestDomain:" + "PerfElement"), "PerfElement" + "is present in iModel.");
  await rwIModel.concurrencyControl.request(requestContext);
  rwIModel.saveChanges("schema change pushed");
  await rwIModel.pullAndMergeChanges(requestContext);
  const startTime1 = new Date().getTime();
  await rwIModel.pushChanges(requestContext);
  const endTime1 = new Date().getTime();
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  fs.appendFileSync(csvPath, "Push, Schema Changes to Hub," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "PushSchemaChangeToHub", "Execution time(s)", elapsedTime1, { Description: "schema changes to hub", Operation: "Push" });
  await rwIModel.close(requestContext, KeepBriefcase.No);
}

const getElementCount = (iModel: IModelDb): number => {
  const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
  const count = +(rows[0].cnt);
  return count;
};

async function executeQueryTime(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string, imodelId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const imodeldb: IModelDb = await IModelDb.open(requestContext, projectId, imodelId, OpenParams.fixedVersion(), IModelVersion.latest());
  assert.exists(imodeldb);
  const startTime = new Date().getTime();
  const stat = imodeldb.executeQuery("SELECT * FROM BisCore.LineStyle");
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;
  assert.equal(7, stat.length);
  fs.appendFileSync(csvPath, "ExecuteQuery, Execute a simple ECSQL query," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "ExecuteQuery", "Execution time(s)", elapsedTime1, { Description: "execute a simple ECSQL query", Operation: "ExecuteQuery" });
  imodeldb.close(requestContext).catch();
}

async function reverseChanges(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const iModelName = "reverseChangeTest";
  // delete any existing imodel with given name
  const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
  for (const iModelTemp of iModels) {
    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelTemp.id!);
  }
  // create new imodel with given name
  const rwIModel: IModelDb = await IModelDb.create(requestContext, projectId, iModelName, { rootSubject: { name: "TestSubject" } });
  const rwIModelId = rwIModel.iModelToken.iModelId;
  assert.isNotEmpty(rwIModelId);

  // create new model, category and physical element, and insert in imodel, and push these changes
  rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");
  await rwIModel.pushChanges(requestContext).catch();
  const firstCount = getElementCount(rwIModel);
  assert.equal(firstCount, 7);

  let i = 0;
  while (i < 4) {
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
    i = i + 1;
  }
  rwIModel.saveChanges("added more elements to imodel");
  await rwIModel.pushChanges(requestContext).catch();
  const secondCount = getElementCount(rwIModel);
  assert.equal(secondCount, 11);

  let imodelInfo: TestIModelInfo;
  imodelInfo = await IModelTestUtils.getTestModelInfo(requestContext, projectId, "reverseChangeTest");
  const firstChangeSetId = imodelInfo.changeSets[0].wsgId;
  const startTime = new Date().getTime();
  await rwIModel.reverseChanges(requestContext, IModelVersion.asOfChangeSet(firstChangeSetId));
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;

  const reverseCount = getElementCount(rwIModel);
  assert.equal(reverseCount, firstCount);

  fs.appendFileSync(csvPath, "ReverseChanges, Reverse the imodel to first CS from latest," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "ReverseChanges", "Execution time(s)", elapsedTime1, { Description: "reverse the imodel to first CS from latest", Operation: "ReverseChanges" });
  await rwIModel.close(requestContext, KeepBriefcase.No);
}

async function reinstateChanges(requestContext: AuthorizedClientRequestContext, reporter: Reporter, csvPath: string, projectId: string) {
  csvPath = csvPath;
  reporter = reporter;
  const iModelName = "reinstateChangeTest";
  // delete any existing imodel with given name
  const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
  for (const iModelTemp of iModels) {
    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelTemp.id!);
  }
  // create new imodel with given name
  const rwIModel: IModelDb = await IModelDb.create(requestContext, projectId, iModelName, { rootSubject: { name: "TestSubject" } });
  const rwIModelId = rwIModel.iModelToken.iModelId;
  assert.isNotEmpty(rwIModelId);

  // create new model, category and physical element, and insert in imodel, and push these changes
  rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(requestContext, rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");
  await rwIModel.pushChanges(requestContext).catch();
  const firstCount = getElementCount(rwIModel);
  assert.equal(firstCount, 7);

  let i = 0;
  while (i < 4) {
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
    i = i + 1;
  }
  rwIModel.saveChanges("added more elements to imodel");
  await rwIModel.pushChanges(requestContext).catch();
  const secondCount = getElementCount(rwIModel);
  assert.equal(secondCount, 11);

  let imodelInfo: TestIModelInfo;
  imodelInfo = await IModelTestUtils.getTestModelInfo(requestContext, projectId, iModelName);
  const firstChangeSetId = imodelInfo.changeSets[0].wsgId;
  await rwIModel.reverseChanges(requestContext, IModelVersion.asOfChangeSet(firstChangeSetId));
  const reverseCount = getElementCount(rwIModel);
  assert.equal(reverseCount, firstCount);

  const startTime = new Date().getTime();
  await rwIModel.reinstateChanges(requestContext, IModelVersion.latest());
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;
  const reinstateCount = getElementCount(rwIModel);
  assert.equal(reinstateCount, secondCount);

  fs.appendFileSync(csvPath, "ReinstateChanges, Reinstate the imodel to latest CS from first," + elapsedTime1 + "\n");
  reporter.addEntry("ImodelChangesetPerformance", "ReinstateChanges", "Execution time(s)", elapsedTime1, { Description: "reinstate the imodel to latest CS from first", Operation: "ReinstateChanges" });
  await rwIModel.close(requestContext, KeepBriefcase.No);
}

describe("ImodelChangesetPerformance", async () => {
  if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
    IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
  const csvPath = path.join(KnownTestLocations.outputDir, "ImodelPerformance.csv");
  if (!IModelJsFs.existsSync(csvPath)) {
    fs.appendFileSync(csvPath, "Operation,Description,ExecutionTime\n");
  }
  const reporter = new Reporter();
  let projectId: string;
  let imodelId: string;
  let imodelPushId: string;
  let client: IModelHubClient;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    const fs1 = require("fs");
    const configData = JSON.parse(fs1.readFileSync("src/perftest/CSPerfConfig.json"));
    projectId = configData.projectId;
    imodelId = configData.imodelId;
    imodelPushId = configData.imodelPushId;
    const myAppConfig = {
      imjs_buddi_resolve_url_using_region: 102,
      imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
    };
    Config.App.merge(myAppConfig);
    client = new IModelHubClient();
    IModelHost.loadNative(myAppConfig.imjs_buddi_resolve_url_using_region);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const userCredentials: ImsUserCredentials = {
      email: configData.username,
      password: configData.password,
    };
    requestContext = await IModelTestUtils.getTestUserRequestContext(userCredentials);
  });

  after(() => {
    const csvPath1 = path.join(KnownTestLocations.outputDir, "BackendOnlyPerfTest.csv");
    reporter.exportCSV(csvPath1);
  });

  it("GetImodel", async () => {
    await getImodelAfterApplyingCS(requestContext, reporter, csvPath, projectId, imodelId, client).catch();
  });

  it("PushMetaChangeToHub", async () => {
    await pushImodelAfterMetaChanges(requestContext, reporter, csvPath, projectId, imodelPushId).catch();
  });

  it("PushDataChangeToHub", async () => {
    await pushImodelAfterDataChanges(requestContext, reporter, csvPath, projectId).catch();
  });

  it("PushSchemaChangeToHub", async () => {
    await pushImodelAfterSchemaChanges(requestContext, reporter, csvPath, projectId).catch();
  });

  it("ExecuteQuery", async () => {
    await executeQueryTime(requestContext, reporter, csvPath, projectId, imodelId).catch();
  });

  it("ReverseChanges", async () => {
    await reverseChanges(requestContext, reporter, csvPath, projectId).catch();
  });

  it("ReinstateChanges", async () => {
    await reinstateChanges(requestContext, reporter, csvPath, projectId).catch();
  });

});

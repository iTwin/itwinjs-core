/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, OpenParams, IModelJsFs, KeepBriefcase, ConcurrencyControl, DictionaryModel, SpatialCategory, BriefcaseManager } from "../imodeljs-backend";
import { Config, IModelHubClient, ImsActiveSecureTokenClient, AuthorizationToken, AccessToken, ChangeSet, HubIModel, IModelQuery } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid, Id64String } from "@bentley/bentleyjs-core";
import { IModelVersion, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { KnownTestLocations } from "../test/KnownTestLocations";
import * as path from "path";
import * as fs from "fs";
import { assert } from "chai";
import { Element } from "../Element";
import { IModelHost } from "../IModelHost";
import { IModelTestUtils } from "../test/IModelTestUtils";

async function getImodelAfterApplyingCS(csvPath: string) {
  csvPath = csvPath;
  const fs1 = require("fs");
  const configData = JSON.parse(fs1.readFileSync("src/perftest/CSPerfConfig.json"));
  const uname = configData.username;
  const pass = configData.password;
  const projectId = configData.projectId;
  const imodelId = configData.imodelId;
  const myAppConfig = {
    imjs_buddi_resolve_url_using_region: 102,
    imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
  };
  Config.App.merge(myAppConfig);
  const client: IModelHubClient = new IModelHubClient();
  IModelHost.loadNative(myAppConfig.imjs_buddi_resolve_url_using_region);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const actLogCtx = new ActivityLoggingContext(Guid.createValue());
  const imsClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const authToken: AuthorizationToken = await imsClient.getToken(actLogCtx, uname, pass);
  const accessToken: AccessToken = await client.getAccessToken(actLogCtx, authToken);

  const changeSets: ChangeSet[] = await client.changeSets.get(actLogCtx, accessToken, imodelId);
  const firstChangeSetId = changeSets[0].wsgId;
  const secondChangeSetId = changeSets[1].wsgId;

  // open imodel first time from imodel-hub with first revision
  const startTime = new Date().getTime();
  const imodeldb: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.asOfChangeSet(firstChangeSetId));
  const endTime = new Date().getTime();
  assert.exists(imodeldb);
  const elapsedTime = (endTime - startTime) / 1000.0;
  assert.strictEqual<string>(imodeldb.briefcase.currentChangeSetId, firstChangeSetId);
  imodeldb.close(actLogCtx, accessToken).catch();
  fs.appendFileSync(csvPath, "Open, From Hub first cs," + elapsedTime + "\n");

  // open imodel from local cache with second revision
  const startTime1 = new Date().getTime();
  const imodeldb1: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.asOfChangeSet(secondChangeSetId));
  const endTime1 = new Date().getTime();
  assert.exists(imodeldb1);
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  assert.strictEqual<string>(imodeldb1.briefcase.currentChangeSetId, secondChangeSetId);
  imodeldb1.close(actLogCtx, accessToken).catch();
  fs.appendFileSync(csvPath, "Open, From Cache second cs," + elapsedTime1 + "\n");
}

async function pushImodelAfterMetaChanges(csvPath: string) {
  csvPath = csvPath;
  const fs1 = require("fs");
  const configData = JSON.parse(fs1.readFileSync("src/perftest/CSPerfConfig.json"));
  const uname = configData.username;
  const pass = configData.password;
  const projectId = configData.projectId;
  const imodelPushId = configData.imodelPushId;
  const myAppConfig = {
    imjs_buddi_resolve_url_using_region: 102,
    imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
  };
  Config.App.merge(myAppConfig);
  const client: IModelHubClient = new IModelHubClient();
  IModelHost.loadNative(myAppConfig.imjs_buddi_resolve_url_using_region);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const actLogCtx = new ActivityLoggingContext(Guid.createValue());
  const imsClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const authToken: AuthorizationToken = await imsClient.getToken(actLogCtx, uname, pass);
  const accessToken: AccessToken = await client.getAccessToken(actLogCtx, authToken);

  const iModelPullAndPush: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelPushId, OpenParams.pullAndPush(), IModelVersion.latest());
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

  try {
    // get the time to push a meta data change of an imodel to imodel hub
    const startTime1 = new Date().getTime();
    await iModelPullAndPush.pushChanges(actLogCtx, accessToken);
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    fs.appendFileSync(csvPath, "Push, Meta Changes to Hub," + elapsedTime1 + "\n");
  } catch (error) { }
  await iModelPullAndPush.close(actLogCtx, accessToken, KeepBriefcase.No);
}

export async function createNewModelAndCategory(rwIModel: IModelDb, accessToken: AccessToken, actx: ActivityLoggingContext) {
  // Create a new physical model.
  let modelId: Id64String;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(actx, accessToken);
  } catch (err) {
    if (err instanceof ConcurrencyControl.RequestError) {
      assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
    }
  }

  return { modelId, spatialCategoryId };
}

async function pushImodelAfterDataChanges(csvPath: string) {
  csvPath = csvPath;
  const fs1 = require("fs");
  const configData = JSON.parse(fs1.readFileSync("src/perftest/CSPerfConfig.json"));
  const uname = configData.username;
  const pass = configData.password;
  const projectId = configData.projectId;
  const myAppConfig = {
    imjs_buddi_resolve_url_using_region: 102,
    imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
  };
  Config.App.merge(myAppConfig);
  const client: IModelHubClient = new IModelHubClient();
  IModelHost.loadNative(myAppConfig.imjs_buddi_resolve_url_using_region);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const actLogCtx = new ActivityLoggingContext(Guid.createValue());
  const imsClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const authToken: AuthorizationToken = await imsClient.getToken(actLogCtx, uname, pass);
  const accessToken: AccessToken = await client.getAccessToken(actLogCtx, authToken);

  const iModelName = "CodesPushTest";
  // delete any existing imodel with given name
  const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(actLogCtx, accessToken, projectId, new IModelQuery().byName(iModelName));
  for (const iModelTemp of iModels) {
    await BriefcaseManager.imodelClient.iModels.delete(actLogCtx, accessToken, projectId, iModelTemp.id!);
  }
  // create new imodel with given name
  const rwIModel: IModelDb = await IModelDb.create(actLogCtx, accessToken, projectId, iModelName, { rootSubject: { name: "TestSubject" } });
  const rwIModelId = rwIModel.iModelToken.iModelId;
  assert.isNotEmpty(rwIModelId);

  // create new model, category and physical element, and insert in imodel
  rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(rwIModel, accessToken, actLogCtx);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");

  // get the time to push a data change of an imodel to imodel hub
  const startTime1 = new Date().getTime();
  await rwIModel.pushChanges(actLogCtx, accessToken).catch();
  const endTime1 = new Date().getTime();
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  fs.appendFileSync(csvPath, "Push, Data(Element model category inserted) Changes to Hub," + elapsedTime1 + "\n");
  await rwIModel.close(actLogCtx, accessToken, KeepBriefcase.No);
}

describe("ImodelChangesetPerformance", async () => {
  if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
    IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
  const csvPath = path.join(KnownTestLocations.outputDir, "ImodelPerformance.csv");
  if (!IModelJsFs.existsSync(csvPath)) {
    fs.appendFileSync(csvPath, "Operation,Description,ExecutionTime\n");
  }

  before(async () => {

  });

  it("GetImodelFromHubAFterCSApplied", async () => {
    await getImodelAfterApplyingCS(csvPath);
  });

  it("PushImodelMetaChangeToImodelHUb", async () => {
    pushImodelAfterMetaChanges(csvPath).catch();
  });

  it("PushImodelDataChangeToImodelHUb", async () => {
    pushImodelAfterDataChanges(csvPath).catch();
  });
});

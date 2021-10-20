/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import { AccessToken, GuidString, Id64, Id64String, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { ChangesetProps, ChangesetType, Code, ColorDef, GeometryStreamProps, IModel, IModelVersion, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { Reporter } from "@itwin/perf-tools";
import { BriefcaseManager, DictionaryModel, Element, IModelDb, IModelHost, IModelJsNative, SpatialCategory, StandaloneDb } from "@itwin/core-backend";
import { HubWrappers, IModelTestUtils, KnownTestLocations, RevisionUtility } from "@itwin/core-backend/lib/cjs/test/index";
import { HubUtility } from "../HubUtility";
import { PerfTestUtility } from "./PerfTestUtils";
import { ChangeSet, ChangeSetQuery, ChangesType, CheckpointQuery, IModelHubClient, VersionQuery } from "@bentley/imodelhub-client";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";

/* eslint-disable @typescript-eslint/naming-convention */

async function getIModelAfterApplyingCS(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString, iModelId: string) {
  const changeSets = await IModelHost.hubAccess.queryChangesets({ iModelId });
  const firstChangeSetId = changeSets[0].id;
  const secondChangeSetId = changeSets[1].id;

  const args = { accessToken, iTwinId, iModelId };
  // open imodel first time from imodel-hub with first revision
  const startTime = new Date().getTime();
  const iModelDb = await HubWrappers.downloadAndOpenCheckpoint({ ...args, asOf: IModelVersion.asOfChangeSet(firstChangeSetId).toJSON() });
  const endTime = new Date().getTime();
  assert.exists(iModelDb);
  const elapsedTime = (endTime - startTime) / 1000.0;
  assert.strictEqual(iModelDb.changeset.id, firstChangeSetId);
  assert.strictEqual(iModelDb.changeset.index, changeSets[0].index);
  iModelDb.close();
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime, { Description: "from hub first CS", Operation: "Open" });

  // open imodel from local cache with second revision
  const startTime1 = new Date().getTime();
  const iModelDb1 = await HubWrappers.downloadAndOpenCheckpoint({ ...args, asOf: IModelVersion.asOfChangeSet(secondChangeSetId).toJSON() });
  const endTime1 = new Date().getTime();
  assert.exists(iModelDb1);
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  assert.strictEqual(iModelDb1.changeset.id, secondChangeSetId);
  assert.strictEqual(iModelDb.changeset.index, changeSets[1].index);
  iModelDb1.close();
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime1, { Description: "from cache second CS", Operation: "Open" });

  // open imodel from local cache with first revision
  const startTime2 = new Date().getTime();
  const iModelDb2 = await HubWrappers.downloadAndOpenCheckpoint({ ...args, asOf: IModelVersion.first().toJSON() });
  const endTime2 = new Date().getTime();
  assert.exists(iModelDb2);
  const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
  iModelDb2.close();
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime2, { Description: "from cache first CS", Operation: "Open" });

  // open imodel from local cache with latest revision
  const startTime3 = new Date().getTime();
  const iModelDb3 = await HubWrappers.downloadAndOpenCheckpoint({ ...args, asOf: IModelVersion.named("latest").toJSON() });
  const endTime3 = new Date().getTime();
  assert.exists(iModelDb3);
  const elapsedTime3 = (endTime3 - startTime3) / 1000.0;
  iModelDb3.close();
  reporter.addEntry("ImodelChangesetPerformance", "GetImodel", "Execution time(s)", elapsedTime3, { Description: "from cache latest CS", Operation: "Open" });
}

async function pushIModelAfterMetaChanges(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString, imodelPushId: string) {
  const iModelPullAndPush = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: imodelPushId });
  assert.exists(iModelPullAndPush);

  // get the time of applying a meta data change on an imodel
  const startTime = new Date().getTime();
  const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
  rootEl.userLabel = `${rootEl.userLabel}changed`;
  iModelPullAndPush.elements.updateElement(rootEl);
  iModelPullAndPush.saveChanges("user changes root subject of the imodel");
  const endTime = new Date().getTime();
  const elapsedTime = (endTime - startTime) / 1000.0;
  reporter.addEntry("ImodelChangesetPerformance", "PushMetaChangeToHub", "Execution time(s)", elapsedTime, { Description: "make meta changes", Operation: "Update" });

  try {
    // get the time to push a meta data change of an imodel to imodel hub
    const startTime1 = new Date().getTime();
    await iModelPullAndPush.pushChanges({ accessToken, description: "test change" });
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    reporter.addEntry("ImodelChangesetPerformance", "PushMetaChangeToHub", "Execution time(s)", elapsedTime1, { Description: "meta changes to hub", Operation: "Push" });
  } catch (error) { }

  await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModelPullAndPush);
}

async function createNewModelAndCategory(rwIModel: IModelDb) {
  // Create a new physical model.
  const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

async function pushIModelAfterDataChanges(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString) {
  const iModelName = "CodesPushTest";
  // delete any existing imodel with given name
  const iModelId = await IModelHost.hubAccess.queryIModelByName({ iTwinId, iModelName, accessToken });
  if (iModelId)
    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
  // create new imodel with given name
  const rwIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: "TestSubject" });
  assert.isNotEmpty(rwIModelId);
  const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: rwIModelId });

  // create new model, category and physical element, and insert in imodel
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");

  // get the time to push a data change of an imodel to imodel hub
  const startTime1 = new Date().getTime();
  await rwIModel.pushChanges({ accessToken, description: "test change" }).catch(() => { });
  const endTime1 = new Date().getTime();
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  reporter.addEntry("ImodelChangesetPerformance", "PushDataChangeToHub", "Execution time(s)", elapsedTime1, { Description: "data changes to hub", Operation: "Push" });
  await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, rwIModel);
}

async function pushIModelAfterSchemaChanges(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString) {
  const iModelName = "SchemaPushTest";
  // delete any existing imodel with given name
  const iModelId = await IModelHost.hubAccess.queryIModelByName({ iTwinId, iModelName, accessToken });
  if (iModelId)
    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
  // create new imodel with given name
  const rwIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: "TestSubject" });
  assert.isNotEmpty(rwIModelId);
  const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: rwIModelId });

  assert.isNotEmpty(rwIModelId);
  // import schema and push change to hub
  const schemaPathname = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
  await rwIModel.importSchemas([schemaPathname]).catch(() => { });
  assert.isDefined(rwIModel.getMetaData("PerfTestDomain:" + "PerfElement"), "PerfElement" + "is present in iModel.");
  rwIModel.saveChanges("schema change pushed");
  await rwIModel.pullChanges({ accessToken });
  const startTime1 = new Date().getTime();
  await rwIModel.pushChanges({ accessToken, description: "test change" });
  const endTime1 = new Date().getTime();
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  reporter.addEntry("ImodelChangesetPerformance", "PushSchemaChangeToHub", "Execution time(s)", elapsedTime1, { Description: "schema changes to hub", Operation: "Push" });
  await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, rwIModel);
}

const getElementCount = (iModel: IModelDb): number => {
  const rows: any[] = IModelTestUtils.executeQuery(iModel, "SELECT COUNT(*) AS cnt FROM bis.Element");
  const count = + rows[0].cnt;
  return count;
};

async function executeQueryTime(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString, imodelId: string) {
  const iModelDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: imodelId, asOf: IModelVersion.named("latest").toJSON() });
  assert.exists(iModelDb);
  const startTime = new Date().getTime();
  const stat = IModelTestUtils.executeQuery(iModelDb, "SELECT * FROM BisCore.LineStyle");
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;
  assert.equal(7, stat.length);
  reporter.addEntry("ImodelChangesetPerformance", "ExecuteQuery", "Execution time(s)", elapsedTime1, { Description: "execute a simple ECSQL query", Operation: "ExecuteQuery" });
  iModelDb.close();
}

async function reverseChanges(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString) {
  const iModelName = "reverseChangeTest";
  // delete any existing imodel with given name
  const iModelId = await IModelHost.hubAccess.queryIModelByName({ iModelName, iTwinId, accessToken });
  if (iModelId)
    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });

  // create new imodel with given name
  const rwIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: "TestSubject" });
  assert.isNotEmpty(rwIModelId);
  const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: rwIModelId });

  // create new model, category and physical element, and insert in imodel, and push these changes
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");
  await rwIModel.pushChanges({ accessToken, description: "test change" }).catch(() => { });
  const firstCount = getElementCount(rwIModel);
  assert.equal(firstCount, 7);

  let i = 0;
  while (i < 4) {
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
    i = i + 1;
  }
  rwIModel.saveChanges("added more elements to imodel");
  await rwIModel.pushChanges({ accessToken, description: "test change" }).catch(() => { });
  const secondCount = getElementCount(rwIModel);
  assert.equal(secondCount, 11);

  const startTime = new Date().getTime();
  await rwIModel.pullChanges({ accessToken, toIndex: 0 }); // reverses changes.
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;

  const reverseCount = getElementCount(rwIModel);
  assert.equal(reverseCount, firstCount);

  reporter.addEntry("ImodelChangesetPerformance", "ReverseChanges", "Execution time(s)", elapsedTime1, { Description: "reverse the imodel to first CS from latest", Operation: "ReverseChanges" });
  rwIModel.close();
}

async function reinstateChanges(accessToken: AccessToken, reporter: Reporter, iTwinId: GuidString) {
  const iModelName = "reinstateChangeTest";
  // delete any existing imodel with given name
  const iModelId = await IModelHost.hubAccess.queryIModelByName({ iModelName, iTwinId, accessToken });
  if (iModelId)
    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });

  // create new imodel with given name
  const rwIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: "TestSubject" });
  assert.isNotEmpty(rwIModelId);
  const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: rwIModelId });

  // create new model, category and physical element, and insert in imodel, and push these changes
  const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(rwIModel);
  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
  rwIModel.saveChanges("User created model, category and one physical element");
  await rwIModel.pushChanges({ accessToken, description: "test change" }).catch(() => { });
  const firstCount = getElementCount(rwIModel);
  assert.equal(firstCount, 7);

  let i = 0;
  while (i < 4) {
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, r.modelId, r.spatialCategoryId));
    i = i + 1;
  }
  rwIModel.saveChanges("added more elements to imodel");
  await rwIModel.pushChanges({ accessToken, description: "test change" }).catch(() => { });
  const secondCount = getElementCount(rwIModel);
  assert.equal(secondCount, 11);

  await rwIModel.pullChanges({ accessToken, toIndex: 0 });
  const reverseCount = getElementCount(rwIModel);
  assert.equal(reverseCount, firstCount);

  const startTime = new Date().getTime();
  await rwIModel.pullChanges({ accessToken });
  const endTime = new Date().getTime();
  const elapsedTime1 = (endTime - startTime) / 1000.0;
  const reinstateCount = getElementCount(rwIModel);
  assert.equal(reinstateCount, secondCount);

  reporter.addEntry("ImodelChangesetPerformance", "ReinstateChanges", "Execution time(s)", elapsedTime1, { Description: "reinstate the imodel to latest CS from first", Operation: "ReinstateChanges" });
  rwIModel.close();
}

describe("ImodelChangesetPerformance", () => {
  const reporter = new Reporter();
  let iTwinId: GuidString;
  let imodelId: string;
  let imodelPushId: string;
  let requestContext: AccessToken;

  before(async () => {
    if (!fs.existsSync(KnownTestLocations.outputDir))
      fs.mkdirSync(KnownTestLocations.outputDir);
    // TODO: Update config to use iTwin terminology
    const configData = require(path.join(__dirname, "CSPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    iTwinId = configData.basicTest.projectId;
    imodelId = configData.basicTest.imodelId;
    imodelPushId = configData.basicTest.imodelPushId;

    requestContext = await TestUtility.getAccessToken(TestUsers.regular);
  });

  after(() => {
    const csvPath1 = path.join(KnownTestLocations.outputDir, "BackendOnlyPerfTest.csv");
    reporter.exportCSV(csvPath1);
  });

  it("GetImodel", async () => {
    await getIModelAfterApplyingCS(requestContext, reporter, iTwinId, imodelId).catch(() => { });
  });

  it("PushMetaChangeToHub", async () => {
    await pushIModelAfterMetaChanges(requestContext, reporter, iTwinId, imodelPushId).catch(() => { });
  });

  it("PushDataChangeToHub", async () => {
    await pushIModelAfterDataChanges(requestContext, reporter, iTwinId).catch(() => { });
  });

  it("PushSchemaChangeToHub", async () => {
    await pushIModelAfterSchemaChanges(requestContext, reporter, iTwinId).catch(() => { });
  });

  it("ExecuteQuery", async () => {
    await executeQueryTime(requestContext, reporter, iTwinId, imodelId).catch(() => { });
  });

  it("ReverseChanges", async () => {
    await reverseChanges(requestContext, reporter, iTwinId).catch(() => { });
  });

  it("ReinstateChanges", async () => {
    await reinstateChanges(requestContext, reporter, iTwinId).catch(() => { });
  });

});

describe("ImodelChangesetPerformance big datasets", () => {
  let iModelRootDir: string;
  // TODO: Update config to use iTwin terminology
  const configData = require(path.join(__dirname, "CSPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
  const csvPath = path.join(KnownTestLocations.outputDir, "ApplyCSLocalPerf.csv");
  const hubBackend = new IModelHubBackend();

  before(async () => {
    iModelRootDir = configData.rootDir;
    if (!fs.existsSync(KnownTestLocations.outputDir))
      fs.mkdirSync(KnownTestLocations.outputDir);
  });
  function getChangesetSummary(changesets: ChangesetProps[]): {} {
    const schemaChanges = changesets.filter((obj) => obj.changesType === ChangesetType.Schema);
    const dataChanges = changesets.filter((obj) => obj.changesType !== ChangesetType.Schema);
    const csSummary = {
      count: changesets.length,
      fileSizeKB: Math.round(changesets.reduce((prev, cs: ChangesetProps) => prev + Number(cs.size), 0) / 1024),
      schemaChanges: {
        count: schemaChanges.length,
        fileSizeKB: Math.round(schemaChanges.reduce((prev, cs) => prev + Number(cs.size), 0) / 1024),
      },
      nonSchemaChanges: {
        count: dataChanges.length,
        fileSizeKB: Math.round(dataChanges.reduce((prev, cs) => prev + Number(cs.size), 0) / 1024),
      },
    };
    return csSummary;
  }

  async function downloadChangesets(accessToken: AccessToken, imodelId: string, changesets: ChangesetProps[], downloadDir: string) {
    if (fs.existsSync(downloadDir))
      fs.removeSync(downloadDir);
    // get first changeset as betweenChangeSets skips the first entry
    const csQuery1 = new ChangeSetQuery();
    csQuery1.byId(changesets[0].id);
    await hubBackend.iModelClient.changeSets.download(accessToken, imodelId, csQuery1, downloadDir);
    const incr: number = 100;
    for (let j = 0; j <= changesets.length; j = j + incr) {
      const csQuery = new ChangeSetQuery();
      if ((j + incr) < changesets.length)
        csQuery.betweenChangeSets(changesets[j].id, changesets[j + incr].id);
      else
        csQuery.betweenChangeSets(changesets[j].id, changesets[changesets.length - 1].id);
      csQuery.selectDownloadUrl();

      await hubBackend.iModelClient.changeSets.download(accessToken, imodelId, csQuery, downloadDir);
    }
  }
  async function setupIModel(iModelInfo: any) {
    const downloadDir: string = path.join(iModelRootDir, iModelInfo.modelName);
    // if folder exists, we'll just use the local copy
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    const accessToken = await TestUtility.getAccessToken(TestUsers.regular);

    // first get all info and save it
    const iModel = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId: iModelInfo.projId, iModelName: iModelInfo.modelName });
    if (!iModel)
      throw new Error(`IModel with id ${iModelInfo.iModelId} not found`);

    fs.writeFileSync(path.join(downloadDir, "imodel.json"), JSON.stringify(iModel, undefined, 4));

    const changesets = await IModelHost.hubAccess.queryChangesets({
      accessToken,
      iModelId: iModelInfo.modelId,
    });
    fs.writeFileSync(path.join(downloadDir, "changeSets.json"), JSON.stringify(changesets, undefined, 4));

    const query = new VersionQuery();
    query.orderBy("createdDate");
    const namedVers = await hubBackend.iModelClient.versions.get(accessToken, iModelInfo.modelId, query);
    fs.writeFileSync(path.join(downloadDir, "namedVersions.json"), JSON.stringify(namedVers, undefined, 4));

    const query2 = new CheckpointQuery();
    const checkpoints = await hubBackend.iModelClient.checkpoints.get(accessToken, iModelInfo.modelId, query2);
    fs.writeFileSync(path.join(downloadDir, "checkPoints.json"), JSON.stringify(checkpoints, undefined, 4));

    const modelSummary = {
      iModelInfo,
      changesetSummary: getChangesetSummary(changesets),
      namedVersions: {
        count: namedVers.length,
        latest: namedVers[0],
      },
      checkPoints: {
        count: checkpoints.length,
        latest: checkpoints[0],
      },
    };
    fs.writeFileSync(path.join(downloadDir, "summary.json"), JSON.stringify(modelSummary, undefined, 4));

    // now download the seed file, if not there
    const seedPathname = path.join(downloadDir, "seed", iModelInfo.modelName!.concat(".bim"));
    if (!fs.existsSync(seedPathname))
      await hubBackend.iModelClient.iModels.download(accessToken, iModelInfo.modelId, seedPathname);

    // now download changesets. first check if there are some, then download only newer ones
    const csDir = path.join(downloadDir, "changeSets");
    if (!fs.existsSync(csDir)) {
      await downloadChangesets(accessToken, iModelInfo.modelId, changesets, csDir);
    } else {
      // delete the temp files
      const tempFiles = fs.readdirSync(csDir).filter((fileName) => !fileName.endsWith(".cs"));
      for (const tempFile of tempFiles) {
        fs.removeSync(path.join(csDir, tempFile));
      }

      const csFiles = fs.readdirSync(csDir).filter((fileName) => fileName.endsWith(".cs"));
      // if more than 80% files are there, download the missing ones
      if ((csFiles.length / changesets.length) > 0.8) {
        // download missing changeset files
        const missingChangesets = changesets.filter((el) => {
          return !csFiles.find((obj) => obj === el.id);
        });
        for (const cs of missingChangesets) {
          const csQuery = new ChangeSetQuery();
          csQuery.byId(cs.id);
          await hubBackend.iModelClient.changeSets.download(accessToken, iModelInfo.modelId, csQuery, csDir);
        }
      } else {
        // download all again
        await downloadChangesets(accessToken, iModelInfo.modelId, changesets, csDir);
      }
    }
  }

  function getStats(changesetFilePath: string) {
    const stats = RevisionUtility.computeStatistics(changesetFilePath, true);
    const details = {
      rowsDeleted: stats.statistics.byOp.rowDeleted,
      rowsInserted: stats.statistics.byOp.rowInserted,
      rowsUpdated: stats.statistics.byOp.rowsUpdated,
      rowsChanged: stats.statistics.rowsChanged,
      tablesChanged: stats.statistics.tablesChanged,
      schemaChangesTable: 0,
      schemaChangesIndex: 0,
    };
    if (stats.hasSchemaChanges) {
      const parts: string[] = stats.schemaChanges.toString().split(";");
      const indexParts = parts.filter((obj) => obj.includes("INDEX"));
      const tableParts = parts.filter((obj) => obj.includes("TABLE"));

      details.schemaChangesTable = tableParts.length;
      details.schemaChangesIndex = indexParts.length;
    }
    return details;
  }

  it.skip("ApplyChangeset Get from iModelHub", async () => {
    const csvPath1 = path.join(KnownTestLocations.outputDir, "ApplyCSPerf.csv");
    const reporter = new Reporter();
    const batchSize: number = 50;
    for (const ds of configData.bigDatasets) {
      const iTwinId: GuidString = ds.projId;
      const imodelId: string = ds.modelId;

      const client: IModelHubClient = new IModelHubClient();
      let accessToken = await TestUtility.getAccessToken(TestUsers.regular);
      const changeSets = await client.changeSets.get(accessToken, imodelId);
      const startNum: number = ds.csStart ? ds.csStart : 0;
      const endNum: number = ds.csEnd ? ds.csEnd : changeSets.length;
      const modelInfo = {
        iTwinId,
        iTwinName: ds.projName,
        modelId: imodelId,
        modelName: ds.modelName,
      };

      const firstChangeSetId = changeSets[startNum].wsgId;
      const iModelDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: imodelId, asOf: IModelVersion.asOfChangeSet(firstChangeSetId).toJSON() });

      for (let j = startNum; j < endNum; ++j) {
        const cs: ChangeSet = changeSets[j];
        let apply: boolean = false;
        if (ds.csType === "All") {
          apply = true;
        } else {
          if (ds.csType === cs.changesType) {
            apply = true;
          }
        }
        if (apply) {
          // eslint-disable-next-line no-console
          console.log(`For iModel: ${ds.modelName}: Applying changeset: ${(j + 1).toString()} / ${endNum.toString()}`);
          accessToken = await TestUtility.getAccessToken(TestUsers.regular);
          const startTime = new Date().getTime();
          await iModelDb.pullChanges({ accessToken }); // needs work - get index IModelVersion.asOfChangeSet(cs.wsgId));
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;

          const csInfo = {
            GUID: cs.wsgId,
            fileSize: cs.fileSize,
            type: cs.changesType,
            desc: cs.description,
          };
          reporter.addEntry("ImodelChangesetPerformance", "ApplyChangeset", "Time(s)", elapsedTime, { csNum: j, csDetail: csInfo, modelDetail: modelInfo });
        }
        if (j % batchSize === 0) { // After few runs write results in case test fails
          reporter.exportCSV(csvPath1);
          reporter.clearEntries();
        }
      }
      iModelDb.close();
      reporter.exportCSV(csvPath1);
      reporter.clearEntries();
    }
  });

  it("ApplyChangeset Local", async () => {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel("HubUtility", LogLevel.Info);
    Logger.setLevel("Performance", LogLevel.Info);

    for (const ds of configData.bigDatasets) {
      const iModelInfo = {
        iTwinId: ds.projId,
        iTwinName: ds.projName,
        iModelId: ds.modelId,
        iModelName: ds.modelName,
      };
      const csStart = ds.csStart;
      const csEnd = ds.csEnd;
      const iModelDir: string = path.join(iModelRootDir, iModelInfo.iModelName);
      if (ds.setup)
        await setupIModel(iModelInfo);
      const results = HubUtility.getApplyChangeSetTime(iModelDir, csStart, csEnd);

      const changeSetJsonPathname = path.join(iModelDir, "changeSets.json");
      const jsonStr = fs.readFileSync(changeSetJsonPathname).toString();
      const changeSetsJson = JSON.parse(jsonStr);

      const changesetsInfo = [];
      for (const changeSetJson of changeSetsJson) {
        changesetsInfo.push(changeSetJson);
      }

      const reporter = new Reporter();
      for (const result of results) {
        const csDetail = changesetsInfo.filter((obj) => obj.id === result.csId);
        const csInfo = {
          GUID: result.csId,
          fileSize: csDetail[0].fileSize,
          type: ChangesType[csDetail[0].changesType],
          desc: csDetail[0].description,
        };
        const stats = getStats(path.join(iModelDir, "changeSets", `${result.csId}.cs`));
        reporter.addEntry("ImodelChangesetPerformance", "ApplyChangesetLocal", "Time(s)", result.time, { csNum: result.csNum, csDetail: csInfo, csStats: stats, modelDetail: iModelInfo });
      }
      reporter.exportCSV(csvPath);
    }
  });
});

describe("ImodelChangesetPerformance own data", () => {
  const seedVersionName: string = "Seed data";
  let accessToken: AccessToken;
  const outDir: string = path.join(KnownTestLocations.outputDir, "ChangesetPerfOwn");
  const csvPath = path.join(KnownTestLocations.outputDir, "ApplyCSPerfOwnData.csv");
  const reporter = new Reporter();
  // TODO: Update config to use iTwin terminology
  const configData = require(path.join(__dirname, "CSPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
  const dbSize: number = configData.ownDataTest.dbSize;
  const iModelNameBase: string = `CS_Lg3d_PElSub3_${dbSize}_`;
  const opSizes: number[] = configData.ownDataTest.opSizes;
  const baseNames: string[] = configData.ownDataTest.baseNames;
  const iTwinId: string = configData.ownDataTest.projectId;
  const schemaDetail = configData.ownDataTest.schema;
  const schemaName: string = schemaDetail.name;
  const baseClassName: string = schemaDetail.baseName;
  const hier: number = schemaDetail.hierarchy;
  const className: string = `${baseClassName}Sub${(hier - 1).toString()}`;

  async function setupLocalIModel(projId: string, modelId: string, localPath: string) {
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    const iModelDb = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: projId, iModelId: modelId, asOf: IModelVersion.named(seedVersionName).toJSON() });
    const pathName = iModelDb.pathName;
    iModelDb.close();
    if (fs.existsSync(localPath))
      fs.copySync(pathName, localPath);

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(localPath, OpenMode.ReadWrite);
    nativeDb.saveLocalValue("StandaloneEdit", "");
    nativeDb.saveChanges();
    nativeDb.closeIModel();
  }

  async function lastChangesetToken(iModelId: string): Promise<IModelJsNative.ChangesetFileProps> {
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId });
    const changeset = changesets[changesets.length - 1];
    const downloadDir = BriefcaseManager.getChangeSetsPath(iModelId);
    const changesetProps = await IModelHost.hubAccess.downloadChangeset({ accessToken, iModelId, targetDir: downloadDir, changeset: { id: changeset.id } });
    return { id: changeset.id, parentId: changeset.parentId, pathname: changesetProps.pathname, changesType: changeset.changesType, index: +changeset.index, pushDate: "", userCreated: "", briefcaseId: 0, description: "" };
  }

  before(async () => {
    Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel("HubUtility", LogLevel.Info);
    // Logger.setLevel("Performance", LogLevel.Info);

    if (!fs.existsSync(KnownTestLocations.outputDir))
      fs.mkdirSync(KnownTestLocations.outputDir);
    if (!fs.existsSync(outDir))
      fs.mkdirSync(outDir);

    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    const hubBackend = new IModelHubBackend();
    for (const opSize of opSizes) {
      for (const baseName of baseNames) {
        const iModelName = `${iModelNameBase + baseName}_${opSize.toString()}`;
        let iModelId = await IModelHost.hubAccess.queryIModelByName({
          iTwinId,
          iModelName,
          accessToken,
        });
        if (undefined === iModelId) {
          // create iModel and push changesets 1) with schema 2) with 1M records of PerfElementSub3 3) insert of opSize for actual testing
          // eslint-disable-next-line no-console
          console.log(`iModel ${iModelName} does not exist on iModelHub. Creating with changesets...`);
          iModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: "TestSubject" });
          const iModelDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId });

          const schemaPathname = path.join(outDir, `${schemaName}.01.00.00.ecschema.xml`);
          const sxml = PerfTestUtility.genSchemaXML(schemaName, baseClassName, hier, true, true, []);
          fs.writeFileSync(schemaPathname, sxml);

          await iModelDb.importSchemas([schemaPathname]).catch(() => { });
          assert.isDefined(iModelDb.getMetaData(`${schemaName}:${baseClassName}`), `${baseClassName} is not present in iModel.`);
          iModelDb.saveChanges("schema changes");
          await iModelDb.pullChanges({ accessToken });
          await iModelDb.pushChanges({ accessToken, description: "perf schema import" });

          // seed with existing elements
          const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModelDb, Code.createEmpty(), true);
          let spatialCategoryId = SpatialCategory.queryCategoryIdByName(iModelDb, IModel.dictionaryId, "MySpatialCategory");
          if (undefined === spatialCategoryId)
            spatialCategoryId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

          for (let m = 0; m < dbSize; ++m) {
            const elementProps = PerfTestUtility.initElemProps(`${schemaName}:${className}`, iModelDb, newModelId, spatialCategoryId);
            const geomElement = iModelDb.elements.createElement(elementProps);
            const id = iModelDb.elements.insertElement(geomElement);
            assert.isTrue(Id64.isValidId64(id), "insert failed");
          }
          accessToken = await TestUtility.getAccessToken(TestUsers.regular);
          iModelDb.saveChanges();
          await iModelDb.pushChanges({ accessToken, description: `Seed data for ${className}` });

          // create named version here
          const changeSets = await hubBackend.iModelClient.changeSets.get(accessToken, iModelId);
          const lastCSId = changeSets[changeSets.length - 1].wsgId;
          const seedData = await hubBackend.iModelClient.versions.create(accessToken, iModelId, lastCSId, seedVersionName);
          assert.equal(seedData.name, seedVersionName);

          const minId: number = PerfTestUtility.getMinId(iModelDb, "bis.PhysicalElement");
          const elementIdIncrement = Math.floor(dbSize / opSize);

          switch (baseName) {
            case "I": // create changeset with insert operation
              for (let m = 0; m < opSize; ++m) {
                const elementProps = PerfTestUtility.initElemProps(`${schemaName}:${className}`, iModelDb, newModelId, spatialCategoryId);
                const geomElement = iModelDb.elements.createElement(elementProps);
                const id = iModelDb.elements.insertElement(geomElement);
                assert.isTrue(Id64.isValidId64(id), "insert failed");
              }
              iModelDb.saveChanges();
              await iModelDb.pushChanges({ accessToken, description: `${className} inserts: ${opSize}` });
              break;
            case "D": // create changeset with Delete operation
              for (let i = 0; i < opSize; ++i) {
                try {
                  const elId = minId + elementIdIncrement * i;
                  iModelDb.elements.deleteElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
                } catch (err) {
                  assert.isTrue(false);
                }
              }
              iModelDb.saveChanges();
              await iModelDb.pushChanges({ accessToken, description: `${className} deletes: ${opSize}` });
              break;
            case "U": // create changeset with Update operation
              const geomArray: Arc3d[] = [
                Arc3d.createXY(Point3d.create(0, 0), 2),
                Arc3d.createXY(Point3d.create(5, 5), 5),
                Arc3d.createXY(Point3d.create(-5, -5), 10),
              ];

              const geometryStream: GeometryStreamProps = [];
              for (const geom of geomArray) {
                const arcData = GeomJson.Writer.toIModelJson(geom);
                geometryStream.push(arcData);
              }
              for (let i = 0; i < opSize; ++i) {
                const elId = minId + elementIdIncrement * i;
                const editElem: Element = iModelDb.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
                (editElem as any).baseStr = "PerfElement - UpdatedValue";
                editElem.setUserProperties("geom", geometryStream);
                try {
                  iModelDb.elements.updateElement(editElem);
                } catch (_err) {
                  assert.fail("Element.update failed");
                }
              }
              iModelDb.saveChanges();
              await iModelDb.pushChanges({ accessToken, description: `${className} updates: ${opSize}` });
              break;
            default:
              break;
          }

          iModelDb.close();
        } else {
          // eslint-disable-next-line no-console
          console.log(`iModel ${iModelName} exists on iModelHub`);
        }
      }
    }
  });
  it("InsertChangeset", async () => {
    for (const opSize of opSizes) {
      const iModelName = `${iModelNameBase}I_${opSize.toString()}`;
      const iModelId = await IModelHost.hubAccess.queryIModelByName({ iTwinId, iModelName, accessToken });
      if (iModelId) {
        // eslint-disable-next-line no-console
        console.log(`Downloading iModel ${iModelName} from iModelHub.`);
        const iModelPathname = path.join(BriefcaseManager.cacheDir, iModelId, `${iModelName}_insert.bim`);
        await setupLocalIModel(iTwinId, iModelId, iModelPathname);
        const saIModel: StandaloneDb = StandaloneDb.openFile(iModelPathname, OpenMode.ReadWrite);
        // download last changeset file
        const csToken = await lastChangesetToken(iModelId);
        // eslint-disable-next-line no-console
        console.log(`Applying Insert changeset to iModel ${iModelName}.`);
        accessToken = await TestUtility.getAccessToken(TestUsers.regular);
        try {
          const startTime = new Date().getTime();
          saIModel.nativeDb.applyChangeset(csToken);
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("ImodelChangesetPerformance", "ChangesetInsert", "Time(s)", elapsedTime, { ElementClassName: "PerfElementSub3", InitialCount: dbSize, opCount: opSize });
        } catch (error) {
          assert.isTrue(false, "Apply changeset failed");
        }
        saIModel.saveChanges();
        saIModel.close();
      }
    }
    reporter.exportCSV(csvPath);
  });
  it("DeleteChangeset", async () => {
    for (const opSize of opSizes) {
      const iModelName = `${iModelNameBase}D_${opSize.toString()}`;
      const iModelId = await IModelHost.hubAccess.queryIModelByName({ iTwinId, iModelName, accessToken });
      if (iModelId) {
        // eslint-disable-next-line no-console
        console.log(`Downloading iModel ${iModelName} from iModelHub.`);
        const iModelPathname = path.join(BriefcaseManager.cacheDir, iModelId, `${iModelName}_delete.bim`);
        await setupLocalIModel(iTwinId, iModelId, iModelPathname);
        const saIModel: StandaloneDb = StandaloneDb.openFile(iModelPathname, OpenMode.ReadWrite);
        // download last changeset file
        const csToken = await lastChangesetToken(iModelId);
        // eslint-disable-next-line no-console
        console.log(`Applying Delete changeset to iModel ${iModelName}.`);
        try {
          const startTime = new Date().getTime();
          saIModel.nativeDb.applyChangeset(csToken);
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("ImodelChangesetPerformance", "ChangesetDelete", "Time(s)", elapsedTime, { ElementClassName: "PerfElementSub3", InitialCount: dbSize, opCount: opSize });
        } catch (err) {
          assert.isTrue(false, "Apply changeset failed");
        }
        saIModel.saveChanges();
        saIModel.close();
      }
    }
    reporter.exportCSV(csvPath);
  });
  it("UpdateChangeset", async () => {
    for (const opSize of opSizes) {
      const iModelName = `${iModelNameBase}U_${opSize.toString()}`;
      const iModelId = await IModelHost.hubAccess.queryIModelByName({ iTwinId, iModelName, accessToken });
      if (iModelId) {
        // eslint-disable-next-line no-console
        console.log(`Downloading iModel ${iModelName} from iModelHub.`);
        const iModelPathname = path.join(BriefcaseManager.cacheDir, iModelId, `${iModelName}_update.bim`);
        await setupLocalIModel(iTwinId, iModelId, iModelPathname);
        const saIModel: StandaloneDb = StandaloneDb.openFile(iModelPathname, OpenMode.ReadWrite);
        // download last changeset file
        const csToken = await lastChangesetToken(iModelId);
        // eslint-disable-next-line no-console
        console.log(`Applying Update changeset to iModel ${iModelName}.`);
        try {
          const startTime = new Date().getTime();
          saIModel.nativeDb.applyChangeset(csToken);
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("ImodelChangesetPerformance", "ChangesetUpdate", "Time(s)", elapsedTime, { ElementClassName: "PerfElementSub3", InitialCount: dbSize, opCount: opSize });
        } catch (err) {
          assert.isTrue(false, "Apply changeset failed");
        }
        saIModel.saveChanges();
        saIModel.close();
      }
    }
    reporter.exportCSV(csvPath);
  });
});

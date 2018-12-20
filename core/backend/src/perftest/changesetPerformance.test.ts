import { IModelDb, NativePlatformRegistry, OpenParams, IModelJsFs, KeepBriefcase } from "../imodeljs-backend";
import { Config, IModelHubClient, ImsActiveSecureTokenClient, AuthorizationToken, AccessToken, ChangeSet } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { KnownTestLocations } from "../test/KnownTestLocations";
import * as path from "path";
import * as fs from "fs";
import { assert } from "chai";
import { Element } from "../Element";

async function getImodelAfterApplyingCS(csvPath: string) {
  csvPath = csvPath;
  const fs1 = require('fs');
  let configData = JSON.parse(fs1.readFileSync('src/perftest/CSPerfConfig.json'));
  let uname = configData.username;
  let pass = configData.password;
  let projectId = configData.projectId;
  let imodelId = configData.imodelId;

  // tslint:disable-next-line:typedef
  const myAppConfig = {
    imjs_buddi_resolve_url_using_region: 102,
    imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
  };
  Config.App.merge(myAppConfig);
  const client: IModelHubClient = new IModelHubClient();
  NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const actLogCtx = new ActivityLoggingContext(Guid.createValue());
  const imsClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const authToken: AuthorizationToken = await imsClient.getToken(actLogCtx, uname, pass);
  const accessToken: AccessToken = await client.getAccessToken(actLogCtx, authToken);

  const changeSets: ChangeSet[] = await client.changeSets.get(actLogCtx, accessToken, imodelId);
  const firstChangeSetId = changeSets[0].wsgId;
  const secondChangeSetId = changeSets[1].wsgId;
  const thirdChangeSetId = changeSets[2].wsgId;

  //open imodel first time from imodel-hub with first revision
  const startTime = new Date().getTime();
  const imodeldb: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.asOfChangeSet(firstChangeSetId));
  const endTime = new Date().getTime();
  assert.exists(imodeldb);
  const elapsedTime = (endTime - startTime) / 1000.0;
  assert.strictEqual<string>(imodeldb.briefcase.currentChangeSetId, firstChangeSetId);
  imodeldb.close(actLogCtx, accessToken);
  fs.appendFileSync(csvPath, "ImodelPerformance, GetImodelFromHubAFterCSApplied," + elapsedTime + ",Time to get an imodel with first version from imodel hub\n");

  //open imodel from local cache with second revision
  const startTime1 = new Date().getTime();
  const imodeldb1: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.asOfChangeSet(secondChangeSetId));
  const endTime1 = new Date().getTime();
  assert.exists(imodeldb1);
  const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
  assert.strictEqual<string>(imodeldb1.briefcase.currentChangeSetId, secondChangeSetId);
  imodeldb1.close(actLogCtx, accessToken);
  fs.appendFileSync(csvPath, "ImodelPerformance, GetImodelFromHubAFterCSApplied," + elapsedTime1 + ",Time to get an imodel with second version from local cache\n");

  //open imodel from local cache with third revision
  const startTime2 = new Date().getTime();
  const imodeldb2: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelId, OpenParams.pullOnly(), IModelVersion.asOfChangeSet(thirdChangeSetId));
  const endTime2 = new Date().getTime();
  assert.exists(imodeldb2);
  const elapsedTime2 = (endTime2 - startTime2) / 1000.0;
  assert.strictEqual<string>(imodeldb2.briefcase.currentChangeSetId, thirdChangeSetId);
  imodeldb2.close(actLogCtx, accessToken);
  fs.appendFileSync(csvPath, "ImodelChangesetPerformance, GetImodelFromHubAFterCSApplied," + elapsedTime2 + ",Time to get an imodel with third version from local cache\n");
}

async function pushImodelAfterMetaChanges(csvPath: string) {
  csvPath = csvPath;
  const fs1 = require('fs');
  let configData = JSON.parse(fs1.readFileSync('src/perftest/CSPerfConfig.json'));
  let uname = configData.username;
  let pass = configData.password;
  let projectId = configData.projectId;
  let imodelPushId = configData.imodelPushId;

  // tslint:disable-next-line:typedef
  const myAppConfig = {
    imjs_buddi_resolve_url_using_region: 102,
    imjs_default_relying_party_uri: "https://connect-wsg20.bentley.com",
  };
  Config.App.merge(myAppConfig);
  const client: IModelHubClient = new IModelHubClient();
  NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const actLogCtx = new ActivityLoggingContext(Guid.createValue());
  const imsClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const authToken: AuthorizationToken = await imsClient.getToken(actLogCtx, uname, pass);
  const accessToken: AccessToken = await client.getAccessToken(actLogCtx, authToken);

  const iModelPullAndPush: IModelDb = await IModelDb.open(actLogCtx, accessToken, projectId, imodelPushId, OpenParams.pullAndPush(), IModelVersion.latest());
  assert.exists(iModelPullAndPush);

  //get the time of applying a meta data change on an imodel
  const startTime = new Date().getTime();
  let rootEl: Element = iModelPullAndPush.elements.getRootSubject();
  rootEl.userLabel = rootEl.userLabel + "changed";
  iModelPullAndPush.elements.updateElement(rootEl);
  iModelPullAndPush.saveChanges();
  const endTime = new Date().getTime();
  const elapsedTime = (endTime - startTime) / 1000.0;
  fs.appendFileSync(csvPath, "ImodelChangesetPerformance, PushImodelMetaChangeToImodelHUb," + elapsedTime + ",Time to make a meta data change in an imodel\n");

  try {
    //get the time to push a meta data change of an imodel to imodel hub
    const startTime1 = new Date().getTime();
    await iModelPullAndPush.pushChanges(actLogCtx, accessToken);
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    fs.appendFileSync(csvPath, "ImodelChangesetPerformance, PushImodelMetaChangeToImodelHUb," + elapsedTime1 + ",Time to push a meta data change in an imodel to imodel hub\n");
  }
  catch (error) {
    console.log("error " + error);
  }
  await iModelPullAndPush.close(actLogCtx, accessToken, KeepBriefcase.No);
}

describe("ImodelChangesetPerformance", async () => {
  if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
    IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
  const csvPath = path.join(KnownTestLocations.outputDir, "ImodelPerformance.csv");
  if (!IModelJsFs.existsSync(csvPath)) {
    fs.appendFileSync(csvPath, "TestCaseName,TestName,ExecutionTime,TestDescription\n");
  }

  before(async () => {

  });

  it("GetImodelFromHubAFterCSApplied", async () => {
    await getImodelAfterApplyingCS(csvPath);
  });

  it("PushImodelMetaChangeToImodelHUb", async () => {
    pushImodelAfterMetaChanges(csvPath);
  });
});
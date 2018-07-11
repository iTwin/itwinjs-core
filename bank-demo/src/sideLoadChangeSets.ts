/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, IModelHubError } from "@bentley/imodeljs-clients";
import { BriefcaseManager, IModelAccessContext, IModelHost, IModelDb, OpenParams } from "@bentley/imodeljs-backend";
import { IModelHubStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import * as fs from "fs";
import * as path from "path";
import { NonBentleyProject } from "./NonBentleyProject";

async function pushChangeSet(iModelId: string, accessToken: AccessToken, changeSet: ChangeSet, csfilename: string): Promise<void> {

  // let postedChangeSet: ChangeSet | undefined;
  try {
    /* postedChangeSet = */ await BriefcaseManager.imodelClient.ChangeSets().create(accessToken, iModelId, changeSet, csfilename);
  } catch (error) {
    // If ChangeSet already exists, updating codes and locks might have timed out.
    if (!(error instanceof IModelHubError) || error.errorNumber !== IModelHubStatus.ChangeSetAlreadyExists) {
      Promise.reject(error);
    }
  }
}

function makeChangeSet(cs: any, csfilepath: string): ChangeSet {
  const changeSet = new ChangeSet();
  changeSet.briefcaseId = cs.briefcaseId;
  changeSet.id = cs.id;
  changeSet.parentId = cs.parentId;
  changeSet.containsSchemaChanges = cs.containsSchemaChanges;
  changeSet.seedFileId = cs.seedFileId;
  changeSet.fileSize = fs.lstatSync(csfilepath)!.size.toString();
  changeSet.description = cs.description;
  return changeSet;
}

function getAssetFilePath(filename: string): string {
  return path.join(__dirname, "..", "assets", filename);
}

async function pushCS(iModelId: string, accessToken: AccessToken, cs: any) {
  const csfilepath = getAssetFilePath(cs.fileName);
  const changeSet = makeChangeSet(cs, csfilepath);
  return pushChangeSet(iModelId, accessToken, changeSet, csfilepath);
}

async function sideLoadChangeSets(context: IModelAccessContext, iModelId: string, accessToken: AccessToken) {
  BriefcaseManager.setContext(context);
  const bc = await IModelDb.open(accessToken, "", iModelId, OpenParams.pullAndPush()); // must create a briefcase in order to upload changesets
  const timeline = require(getAssetFilePath("changeSets.json"));
  for (const cs of timeline) {
    cs.briefcaseId = bc.briefcase.briefcaseId;
    await pushCS(context.iModelId, accessToken, cs);
  }
}

Logger.initializeToConsole();
Logger.setLevel("imodeljs-clients", LogLevel.Trace);

IModelHost.startup();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

// tslint:disable-next-line:no-var-requires
const iModelInfo = require("../assets/imodel.json");
const theAccessToken = NonBentleyProject.getAccessToken();
NonBentleyProject.getIModelAccessContext(iModelInfo.wsgId, "")
  .then((context: IModelAccessContext) => sideLoadChangeSets(context, iModelInfo.wsgId, theAccessToken))
  .then(() => process.exit(0));

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, IModelHubError } from "@bentley/imodeljs-clients";
import { BriefcaseManager, IModelAccessContext } from "@bentley/imodeljs-backend";
import { IModelHubStatus } from "@bentley/bentleyjs-core";
import * as fs from "fs";
import * as path from "path";

async function pushChangeSet(iModelId: string, accessToken: AccessToken, changeSet: ChangeSet, csfilename: string): Promise<void> {

  // let postedChangeSet: ChangeSet | undefined;
  try {
    /* postedChangeSet = */ await BriefcaseManager.hubClient.ChangeSets().create(accessToken, iModelId, changeSet, csfilename);
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

export async function sideLoadChangeSets(context: IModelAccessContext, accessToken: AccessToken) {
  BriefcaseManager.setContext(context);
  const timeline = require(getAssetFilePath("changeSets.json"));
  for (const cs of timeline) {
    await pushCS(context.iModelId, accessToken, cs);
  }
}

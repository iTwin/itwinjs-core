/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { IModelHost, IModelJsFs, IModelJsNative } from "@itwin/core-backend";
import { AccessToken, ChangeSetStatus, GuidString, Logger, OpenMode, PerfLogger } from "@itwin/core-bentley";
import { ChangesetFileProps, ChangesetType } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { HubUtility } from "../HubUtility";

// Useful utilities to download/upload test cases from/to iModelHub
describe("ApplyChangesets", () => {
  const testAllChangeSetOperations = async (accessToken: AccessToken, iTwinId: string, iModelId: GuidString) => {
    const iModelDir = path.join(IModelHost.cacheDir, iModelId.toString());
    await validateAllChangesetOperations(accessToken, iTwinId, iModelId, iModelDir);
    IModelJsFs.purgeDirSync(iModelDir);
  };

  it.only("should test all changeset operations after downloading iModel from the hub (#integration)", async () => {
    const accessToken = await TestUtility.getAccessToken(TestUsers.regular);

    const iTwinId = await HubUtility.getTestITwinId(accessToken);
    let iModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    await testAllChangeSetOperations(accessToken, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readWrite);
    await testAllChangeSetOperations(accessToken, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.noVersions);
    await testAllChangeSetOperations(accessToken, iTwinId, iModelId);
  });
});

/** Validate all change set operations by downloading seed files & change sets, creating a standalone iModel,
 * merging the change sets, reversing them, and finally reinstating them. The method also logs the necessary performance
 * metrics with these operations.
 */
async function validateAllChangesetOperations(accessToken: AccessToken, iTwinId: string, iModelId: GuidString, iModelDir: string) {
  Logger.logInfo(HubUtility.logCategory, "Downloading seed file and all available change sets");
  await HubUtility.downloadIModelById(accessToken, iTwinId, iModelId, iModelDir, true /* =reDownload */);

  return validateAllChangesetOperationsOnDisk(iModelDir);
}

/** Validate all change set operations on an iModel on disk - the supplied directory contains a sub folder
 * with the seed files, change sets, etc. in a standard format. This tests merging the change sets, reversing them,
 * and finally reinstating them. The method also logs the necessary performance
 * metrics with these operations
 */
async function validateAllChangesetOperationsOnDisk(iModelDir: string) {
  const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

  Logger.logInfo(HubUtility.logCategory, "Making a local copy of the seed");
  HubUtility.copyIModelFromSeed(briefcasePathname, iModelDir, true /* =overwrite */);

  const nativeDb = new IModelHost.platform.DgnDb();
  nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
  const changeSets = HubUtility.readChangesets(iModelDir);

  let status: ChangeSetStatus;

  Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
  status = applyChangeSetsToNativeDb(nativeDb, changeSets);

  // Reverse changes until there's a schema change set (note that schema change sets cannot be reversed)
  const reverseChangeSets = changeSets.reverse();
  const schemaChangeIndex = reverseChangeSets.findIndex((token) => token.changesType === ChangesetType.Schema);
  const filteredChangeSets = reverseChangeSets.slice(0, schemaChangeIndex); // exclusive of element at schemaChangeIndex
  if (status === ChangeSetStatus.Success) {
    Logger.logInfo(HubUtility.logCategory, "Reversing all available change sets");
    status = applyChangeSetsToNativeDb(nativeDb, filteredChangeSets);
  }

  if (status === ChangeSetStatus.Success) {
    Logger.logInfo(HubUtility.logCategory, "Reinstating all available change sets");
    filteredChangeSets.reverse();
    status = applyChangeSetsToNativeDb(nativeDb, filteredChangeSets);
  }

  nativeDb.closeIModel();
  assert.isTrue(status === ChangeSetStatus.Success, "Error applying change sets");
}

/** Applies change sets one by one (for debugging) */
function applyChangeSetsToNativeDb(nativeDb: IModelJsNative.DgnDb, changeSets: ChangesetFileProps[]): ChangeSetStatus {
  const perfLogger = new PerfLogger(`Applying change sets]}`);

  // Apply change sets one by one to debug any issues
  let count = 0;
  for (const changeSet of changeSets) {
    ++count;
    Logger.logInfo(HubUtility.logCategory, `Started applying change set: ${count} of ${changeSets.length} (${new Date(Date.now()).toString()})`, () => ({ ...changeSet }));
    try {
      nativeDb.applyChangeset(changeSet);
      Logger.logInfo(HubUtility.logCategory, "Successfully applied ChangeSet", () => ({ ...changeSet, status }));
    } catch (err: any) {
      Logger.logError(HubUtility.logCategory, `Error applying ChangeSet ${err.errorNumber}`, () => ({ ...changeSet }));
      perfLogger.dispose();
      return err.errorNumber;
    }
  }

  perfLogger.dispose();
  return ChangeSetStatus.Success;
}

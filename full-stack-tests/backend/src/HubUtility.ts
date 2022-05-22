/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { IModelHost, IModelJsFs, V1CheckpointManager } from "@itwin/core-backend";
import { AccessToken, ChangeSetStatus, GuidString, Logger, OpenMode, PerfLogger } from "@itwin/core-bentley";
import { BriefcaseIdValue, ChangesetFileProps, ChangesetProps } from "@itwin/core-common";
import { TestUserCredentials, TestUsers, TestUtility } from "@itwin/oidc-signin-tool";

/** the types of users available for tests */
export enum TestUserType {
  Regular,
  Manager,
  Super,
  SuperManager
}

/** Utility to work with test iModels in the iModelHub */
export class HubUtility {
  public static logCategory = "HubUtility";

  public static testITwinName = "iModelJsIntegrationTest";
  public static testIModelNames = {
    noVersions: "NoVersionsTest",
    stadium: "Stadium Dataset 1",
    readOnly: "ReadOnlyTest",
    readWrite: "ReadWriteTest",
  };

  /** get an AuthorizedClientRequestContext for a [[TestUserType]].
   * @note if the current test is using [[HubMock]], calling this method multiple times with the same type will return users from the same organization,
   * but with different credentials. This can be useful for simulating more than one user of the same type on the same iTwin.
   * However, if a real IModelHub is used, the credentials are supplied externally and will always return the same value (because otherwise they would not be valid.)
   */
  public static async getAccessToken(user: TestUserType): Promise<AccessToken> {
    let credentials: TestUserCredentials;
    switch (user) {
      case TestUserType.Regular:
        credentials = TestUsers.regular;
        break;
      case TestUserType.Manager:
        credentials = TestUsers.manager;
        break;
      case TestUserType.Super:
        credentials = TestUsers.super;
        break;
      case TestUserType.SuperManager:
        credentials = TestUsers.superManager;
        break;
    }
    return TestUtility.getAccessToken(credentials);
  }

  public static iTwinId: GuidString | undefined;
  /** Returns the iTwinId if an iTwin with the name exists. Otherwise, returns undefined. */
  public static async getTestITwinId(accessToken: AccessToken): Promise<GuidString> {
    if (undefined !== HubUtility.iTwinId)
      return HubUtility.iTwinId;
    return HubUtility.getITwinIdByName(accessToken, HubUtility.testITwinName);
  }

  private static imodelCache = new Map<string, GuidString>();
  /** Returns the iModelId if the iModel exists. Otherwise, returns undefined. */
  public static async getTestIModelId(accessToken: AccessToken, name: string): Promise<GuidString> {
    if (HubUtility.imodelCache.has(name))
      return HubUtility.imodelCache.get(name)!;

    const iTwinId = await HubUtility.getTestITwinId(accessToken);
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName: name });
    if (undefined === iModelId)
      throw new Error(`Cannot find iModel with ${name} in ${iTwinId}`);
    HubUtility.imodelCache.set(name, iModelId);
    return iModelId;
  }

  /**
   * Queries the iTwin id by its name
   * @param accessToken The client request context
   * @param name Name of iTwin
   * @throws If the iTwin is not found, or there is more than one iTwin with the supplied name
   */
  public static async getITwinIdByName(accessToken: AccessToken, name: string): Promise<string> {
    if (undefined !== HubUtility.iTwinId)
      return HubUtility.iTwinId;

    const iTwin = await getITwinAbstraction().getITwinByName(accessToken, name);
    if (iTwin === undefined || !iTwin.id)
      throw new Error(`ITwin ${name} was not found for the user.`);

    return iTwin.id;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangesets(accessToken: AccessToken, changesetsPath: string, iModelId: GuidString): Promise<ChangesetProps[]> {
    // Determine the range of changesets that remain to be downloaded
    const changesets: ChangesetProps[] = await IModelHost.hubAccess.queryChangesets({ iModelId, accessToken }); // oldest to newest
    if (changesets.length === 0)
      return changesets;
    const latestIndex = changesets.length;
    let earliestIndex = 0; // Earliest index that doesn't exist
    while (earliestIndex <= latestIndex) {
      const pathname = path.join(changesetsPath, changesets[earliestIndex].id);
      if (!IModelJsFs.existsSync(pathname))
        break;
      ++earliestIndex;
    }
    if (earliestIndex > latestIndex) // All change sets have already been downloaded
      return changesets;

    const earliestChangesetIndex = earliestIndex > 0 ? earliestIndex - 1 : 0; // Query results exclude earliest specified changeset
    const latestChangesetIndex = latestIndex; // Query results include latest specified change set

    const perfLogger = new PerfLogger("HubUtility.downloadChangesets -> Download Changesets");
    await IModelHost.hubAccess.downloadChangesets({ accessToken, iModelId, range: { first: earliestChangesetIndex, end: latestChangesetIndex }, targetDir: changesetsPath });
    perfLogger.dispose();
    return changesets;
  }

  /** Download an iModel's seed file and changesets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelById(accessToken: AccessToken, iTwinId: string, iModelId: GuidString, downloadDir: string, reDownload: boolean): Promise<void> {
    // Recreate the download folder if necessary
    if (reDownload) {
      if (IModelJsFs.existsSync(downloadDir))
        IModelJsFs.purgeDirSync(downloadDir);
      IModelJsFs.recursiveMkDirSync(downloadDir);
    }

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModelId.concat(".bim"));
    if (!IModelJsFs.existsSync(seedPathname)) {
      const perfLogger = new PerfLogger("HubUtility.downloadIModelById -> Download Seed File");
      await V1CheckpointManager.downloadCheckpoint({
        localFile: seedPathname,
        checkpoint: {
          accessToken,
          iTwinId,
          iModelId,
          changeset: {
            id: "0",
            index: 0,
          },
        },
      });
      perfLogger.dispose();
    }

    // Download the change sets
    const changesetDir = path.join(downloadDir, "changesets");
    const changesets = await HubUtility.downloadChangesets(accessToken, changesetDir, iModelId);

    const changesetsJsonStr = JSON.stringify(changesets, undefined, 4);
    const changesetsJsonPathname = path.join(downloadDir, "changesets.json");
    IModelJsFs.writeFileSync(changesetsJsonPathname, changesetsJsonStr);
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelByName(accessToken: AccessToken, iTwinName: string, iModelName: string, downloadDir: string, reDownload: boolean): Promise<void> {
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);

    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
    if (!iModelId)
      throw new Error(`IModel ${iModelName} not found`);

    await HubUtility.downloadIModelById(accessToken, iTwinId, iModelId, downloadDir, reDownload);
  }

  /** Delete an IModel from the hub */
  public static async deleteIModel(accessToken: AccessToken, iTwinName: string, iModelName: string): Promise<void> {
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });

    if (!iModelId)
      return;
    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
  }

  /** Get the pathname of the briefcase in the supplied directory - assumes a standard layout of the supplied directory */
  public static getBriefcasePathname(iModelDir: string): string {
    const seedPathname = HubUtility.getSeedPathname(iModelDir);
    return path.join(iModelDir, path.basename(seedPathname));
  }

  /** Apply change set with Merge operation on an iModel on disk - the supplied directory contains a sub folder
   * with the seed files, change sets, etc. in a standard format.
   * Returns time taken for each changeset. Returns on first apply changeset error.
   */
  public static getApplyChangeSetTime(iModelDir: string, startCS: number = 0, endCS: number = 0): any[] {
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

    Logger.logInfo(HubUtility.logCategory, "Making a local copy of the seed");
    HubUtility.copyIModelFromSeed(briefcasePathname, iModelDir, true /* =overwrite */);

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    const changesets = HubUtility.readChangesets(iModelDir);
    const endNum: number = endCS ? endCS : changesets.length;
    const filteredCS = changesets.filter((obj) => obj.index >= startCS && obj.index <= endNum);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    const perfLogger = new PerfLogger(`Applying change sets }`);

    const results = [];
    // Apply change sets one by one to debug any issues
    for (const changeSet of filteredCS) {
      const startTime = new Date().getTime();
      let csResult = ChangeSetStatus.Success;
      try {
        nativeDb.applyChangeset(changeSet);
      } catch (err: any) {
        csResult = err.errorNumber;
      }
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;
      results.push({
        csNum: changeSet.index,
        csId: changeSet.id,
        csResult,
        time: elapsedTime,
      });
    }

    perfLogger.dispose();
    nativeDb.closeIModel();

    return results;
  }

  private static getSeedPathname(iModelDir: string) {
    const seedFileDir = path.join(iModelDir, "seed");
    const seedFileNames = IModelJsFs.readdirSync(seedFileDir);
    if (seedFileNames.length !== 1) {
      throw new Error(`Expected to find one and only one seed file in: ${seedFileDir}`);
    }
    const seedFileName = seedFileNames[0];
    const seedPathname = path.join(seedFileDir, seedFileName);
    return seedPathname;
  }

  /** Reads change sets from disk and expects a standard structure of how the folder is organized */
  public static readChangesets(iModelDir: string): ChangesetFileProps[] {
    const props: ChangesetFileProps[] = [];

    const changeSetJsonPathname = path.join(iModelDir, "changesets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return props;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changesets = JSON.parse(jsonStr);

    for (const changeset of changesets) {
      changeset.index = parseInt(changeset.index, 10); // it's a string from iModelHub
      const pathname = path.join(iModelDir, "changesets", `${changeset.id}.cs`);
      if (!IModelJsFs.existsSync(pathname))
        throw new Error(`Cannot find the ChangeSet file: ${pathname}`);
      props.push({ ...changeset, pathname });
    }
    return props;
  }

  /** Creates a standalone iModel from the seed file (version 0) */
  public static copyIModelFromSeed(iModelPathname: string, iModelDir: string, overwrite: boolean) {
    const seedPathname = HubUtility.getSeedPathname(iModelDir);

    if (!IModelJsFs.existsSync(iModelPathname)) {
      IModelJsFs.copySync(seedPathname, iModelPathname);
    } else if (overwrite) {
      IModelJsFs.unlinkSync(iModelPathname);
      IModelJsFs.copySync(seedPathname, iModelPathname);
    }

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(iModelPathname, OpenMode.ReadWrite);
    nativeDb.deleteAllTxns();
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    if (nativeDb.queryLocalValue("StandaloneEdit"))
      nativeDb.deleteLocalValue("StandaloneEdit");
    nativeDb.saveChanges();
    nativeDb.closeIModel();

    return iModelPathname;
  }

}

/** An implementation of TestITwin backed by an iTwin */
class TestITwin {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  private static _iTwinAccessClient?: ProjectsAccessClient;

  private static get iTwinClient(): ProjectsAccessClient {
    if (this._iTwinAccessClient === undefined)
      this._iTwinAccessClient = new ProjectsAccessClient();
    return this._iTwinAccessClient;
  }

  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const client = TestITwin.iTwinClient;
    const iTwinList: ITwin[] = await client.getAll(accessToken, {
      search: {
        searchString: name,
        propertyName: ProjectsSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }
}

let iTwinAbstraction: TestITwin;
export function getITwinAbstraction(): TestITwin {
  if (iTwinAbstraction !== undefined)
    return iTwinAbstraction;

  return iTwinAbstraction = new TestITwin();
}

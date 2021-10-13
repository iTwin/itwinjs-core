/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { AccessToken, BentleyStatus, ChangeSetStatus, Guid, GuidString, Logger, OpenMode, PerfLogger } from "@itwin/core-bentley";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { Briefcase, ChangeSet, ChangeSetQuery, HubIModel, IModelHubClient, IModelQuery, Version, VersionQuery } from "@bentley/imodelhub-client";
import { BriefcaseIdValue, ChangesetFileProps, ChangesetType } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { IModelHubBackend } from "../../IModelHubBackend";
import { IModelJsFs } from "../../IModelJsFs";
import { HubMock } from "../HubMock";

/** Utility to work with test iModels in the iModelHub */
export class HubUtility {
  public static logCategory = "HubUtility";
  public static allowHubBriefcases = false;

  public static testITwinName = "iModelJsIntegrationTest";
  public static testIModelNames = {
    noVersions: "NoVersionsTest",
    stadium: "Stadium Dataset 1",
    readOnly: "ReadOnlyTest",
    readWrite: "ReadWriteTest",
  };

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
    const iModelId = await HubUtility.queryIModelIdByName(accessToken, iTwinId, name);
    HubUtility.imodelCache.set(name, iModelId);
    return iModelId;
  }

  public static async queryIModelByName(accessToken: AccessToken, iTwinId: string, iModelName: string): Promise<GuidString | undefined> {
    return IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
  }

  private static async queryIModelById(accessToken: AccessToken, iTwinId: string, iModelId: GuidString): Promise<HubIModel | undefined> {
    const iModels = await getITwinAbstraction().queryIModels(accessToken, iTwinId, new IModelQuery().byId(iModelId));
    if (iModels.length === 0)
      return undefined;
    return iModels[0];
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

  /** Queries the iModel id by its name
   * @param accessToken The client request context
   * @param iTwinId Id of the parent iTwin
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(accessToken: AccessToken, iTwinId: GuidString, iModelName: string): Promise<GuidString> {
    const iModelId = await HubUtility.queryIModelByName(accessToken, iTwinId, iModelName);
    if (!iModelId)
      throw new Error(`IModel ${iModelName} not found`);
    return iModelId;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangesets(accessToken: AccessToken, changeSetsPath: string, iModelId: GuidString): Promise<ChangeSet[]> {
    // Determine the range of changesets that remain to be downloaded
    const changeSets = await IModelHubBackend.iModelClient.changeSets.get(accessToken, iModelId, new ChangeSetQuery()); // oldest to newest
    if (changeSets.length === 0)
      return changeSets;
    const latestIndex = changeSets.length - 1;
    let earliestIndex = 0; // Earliest index that doesn't exist
    while (earliestIndex <= latestIndex) {
      const pathname = path.join(changeSetsPath, changeSets[earliestIndex].fileName!);
      if (!IModelJsFs.existsSync(pathname))
        break;
      ++earliestIndex;
    }
    if (earliestIndex > latestIndex) // All change sets have already been downloaded
      return changeSets;

    const earliestChangeSetId = earliestIndex > 0 ? changeSets[earliestIndex - 1].id! : undefined; // Query results exclude earliest specified change set
    const latestChangeSetId = changeSets[latestIndex].id!; // Query results include latest specified change set
    const query = earliestChangeSetId ? new ChangeSetQuery().betweenChangeSets(earliestChangeSetId, latestChangeSetId) : new ChangeSetQuery();

    const perfLogger = new PerfLogger("HubUtility.downloadChangesets -> Download ChangeSets");
    await IModelHubBackend.iModelClient.changeSets.download(accessToken, iModelId, query, changeSetsPath);
    perfLogger.dispose();
    return changeSets;
  }

  /** Download all named versions of the specified iModel */
  private static async downloadNamedVersions(accessToken: AccessToken, iModelId: GuidString): Promise<Version[]> {
    const query = new VersionQuery();
    query.orderBy("createdDate");

    const perfLogger = new PerfLogger("HubUtility.downloadNamedVersions -> Get Version Infos");
    const versions = await IModelHubBackend.iModelClient.versions.get(accessToken, iModelId, query);
    perfLogger.dispose();
    if (versions.length === 0)
      return new Array<ChangeSet>();
    return versions;
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelById(accessToken: AccessToken, iTwinId: string, iModelId: GuidString, downloadDir: string, reDownload: boolean): Promise<void> {
    // Recreate the download folder if necessary
    if (reDownload) {
      if (IModelJsFs.existsSync(downloadDir))
        IModelJsFs.purgeDirSync(downloadDir);
      IModelJsFs.recursiveMkDirSync(downloadDir);
    }

    const iModel = await HubUtility.queryIModelById(accessToken, iTwinId, iModelId);
    if (!iModel)
      throw new Error(`IModel with id ${iModelId} not found`);

    // Write the JSON representing the iModel
    const iModelJsonStr = JSON.stringify(iModel, undefined, 4);
    const iModelJsonPathname = path.join(downloadDir, "imodel.json");
    IModelJsFs.writeFileSync(iModelJsonPathname, iModelJsonStr);

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModel.name!.concat(".bim"));
    if (!IModelJsFs.existsSync(seedPathname)) {
      const perfLogger = new PerfLogger("HubUtility.downloadIModelById -> Download Seed File");
      await IModelHubBackend.iModelClient.iModels.download(accessToken, iModelId, seedPathname);
      perfLogger.dispose();
    }

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets = await HubUtility.downloadChangesets(accessToken, changeSetDir, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);

    // Download the version information
    const namedVersions = await HubUtility.downloadNamedVersions(accessToken, iModelId);
    const namedVersionsJsonStr = JSON.stringify(namedVersions, undefined, 4);
    const namedVersionsJsonPathname = path.join(downloadDir, "namedVersions.json");
    IModelJsFs.writeFileSync(namedVersionsJsonPathname, namedVersionsJsonStr);
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelByName(accessToken: AccessToken, iTwinName: string, iModelName: string, downloadDir: string, reDownload: boolean): Promise<void> {
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);

    const iModelId = await HubUtility.queryIModelByName(accessToken, iTwinId, iModelName);
    if (!iModelId)
      throw new Error(`IModel ${iModelName} not found`);

    await HubUtility.downloadIModelById(accessToken, iTwinId, iModelId, downloadDir, reDownload);
  }

  /** Delete an IModel from the hub */
  public static async deleteIModel(accessToken: AccessToken, iTwinName: string, iModelName: string): Promise<void> {
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);
    const iModelId = await HubUtility.queryIModelIdByName(accessToken, iTwinId, iModelName);

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
    const changeSets = HubUtility.readChangeSets(iModelDir);
    const endNum: number = endCS ? endCS : changeSets.length;
    const filteredCS = changeSets.filter((obj) => obj.index >= startCS && obj.index <= endNum);

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

  /** Validate apply with briefcase on disk */
  public static validateApplyChangeSetsOnDisk(iModelDir: string) {
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

    Logger.logInfo(HubUtility.logCategory, "Making a local copy of the seed");
    HubUtility.copyIModelFromSeed(briefcasePathname, iModelDir, false /* =overwrite */);

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    const lastAppliedChangeset = nativeDb.getCurrentChangeset();

    const changeSets = HubUtility.readChangeSets(iModelDir);
    const lastMergedChangeSet = changeSets.find((value) => value.id === lastAppliedChangeset.id);
    const filteredChangeSets = lastMergedChangeSet ? changeSets.filter((value) => value.index > lastMergedChangeSet.index) : changeSets;

    // Logger.logInfo(HubUtility.logCategory, "Dumping all available change sets");
    // HubUtility.dumpChangeSetsToLog(iModel, changeSets);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    const status = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets);
    nativeDb.closeIModel();
    assert.isTrue(status === ChangeSetStatus.Success, "Error applying change sets");
  }

  /** Validate all change set operations on an iModel on disk - the supplied directory contains a sub folder
   * with the seed files, change sets, etc. in a standard format. This tests merging the change sets, reversing them,
   * and finally reinstating them. The method also logs the necessary performance
   * metrics with these operations
   */
  public static validateAllChangeSetOperationsOnDisk(iModelDir: string) {
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

    Logger.logInfo(HubUtility.logCategory, "Making a local copy of the seed");
    HubUtility.copyIModelFromSeed(briefcasePathname, iModelDir, true /* =overwrite */);

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    const changeSets = HubUtility.readChangeSets(iModelDir);

    let status: ChangeSetStatus;

    // Logger.logInfo(HubUtility.logCategory, "Dumping all available change sets");
    // HubUtility.dumpChangeSetsToLog(iModel, changeSets);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    status = HubUtility.applyChangeSetsToNativeDb(nativeDb, changeSets);

    // Reverse changes until there's a schema change set (note that schema change sets cannot be reversed)
    const reverseChangeSets = changeSets.reverse();
    const schemaChangeIndex = reverseChangeSets.findIndex((token) => token.changesType === ChangesetType.Schema);
    const filteredChangeSets = reverseChangeSets.slice(0, schemaChangeIndex); // exclusive of element at schemaChangeIndex
    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reversing all available change sets");
      status = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets);
    }

    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reinstating all available change sets");
      filteredChangeSets.reverse();
      status = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets);
    }

    nativeDb.closeIModel();
    assert.isTrue(status === ChangeSetStatus.Success, "Error applying change sets");
  }

  /** Validate all change set operations by downloading seed files & change sets, creating a standalone iModel,
   * merging the change sets, reversing them, and finally reinstating them. The method also logs the necessary performance
   * metrics with these operations.
   */
  public static async validateAllChangeSetOperations(accessToken: AccessToken, iTwinId: string, iModelId: GuidString, iModelDir: string) {
    Logger.logInfo(HubUtility.logCategory, "Downloading seed file and all available change sets");
    await HubUtility.downloadIModelById(accessToken, iTwinId, iModelId, iModelDir, true /* =reDownload */);

    this.validateAllChangeSetOperationsOnDisk(iModelDir);
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

  /** Push an iModel to the Hub */
  public static async pushIModel(accessToken: AccessToken, iTwinId: string, pathname: string, iModelName?: string, overwrite?: boolean): Promise<GuidString> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that create iModels");
    // Delete any existing iModels with the same name as the required iModel
    const locIModelName = iModelName || path.basename(pathname, ".bim");
    const iModelId = await HubUtility.queryIModelByName(accessToken, iTwinId, locIModelName);
    if (iModelId) {
      if (!overwrite)
        return iModelId;
      await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
    }

    // Upload a new iModel
    return IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName: locIModelName, revision0: pathname });
  }

  /** Upload an IModel's seed files and change sets to the hub
   * It's assumed that the uploadDir contains a standard hierarchy of seed files and change sets.
   */
  public static async pushIModelAndChangeSets(accessToken: AccessToken, iTwinName: string, uploadDir: string, iModelName?: string, overwrite?: boolean): Promise<GuidString> {
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);
    const seedPathname = HubUtility.getSeedPathname(uploadDir);
    const iModelId = await HubUtility.pushIModel(accessToken, iTwinId, seedPathname, iModelName, overwrite);

    let briefcase: Briefcase;
    const hubBriefcases = await IModelHubBackend.iModelClient.briefcases.get(accessToken, iModelId);
    if (hubBriefcases.length > 0)
      briefcase = hubBriefcases[0];
    else
      briefcase = await IModelHubBackend.iModelClient.briefcases.create(accessToken, iModelId);
    if (!briefcase) {
      throw new Error(`Could not acquire a briefcase for the iModel ${iModelId}`);
    }
    briefcase.iModelId = iModelId;

    await HubUtility.pushChangeSets(accessToken, briefcase, uploadDir);
    await HubUtility.pushNamedVersions(accessToken, briefcase, uploadDir, overwrite);
    return iModelId;
  }

  private static async pushChangeSets(accessToken: AccessToken, briefcase: Briefcase, uploadDir: string): Promise<void> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests push changesets");
    const changeSetJsonPathname = path.join(uploadDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    // Find the last change set that was already uploaded
    const lastCs = await IModelHost.hubAccess.getLatestChangeset({ accessToken, iModelId: briefcase.iModelId! });
    const filteredChangeSetsJson = (lastCs.index === 0) ? changeSetsJson.slice(lastCs.index + 1) : changeSetsJson;

    // Upload change sets
    const count = filteredChangeSetsJson.length;
    let ii = 0;
    for (const changeSetJson of filteredChangeSetsJson) {
      const changeSetPathname = path.join(uploadDir, "changeSets", changeSetJson.fileName);
      if (!IModelJsFs.existsSync(changeSetPathname)) {
        throw new Error(`Cannot find the ChangeSet file: ${changeSetPathname}`);
      }

      const changeSet = new ChangeSet();
      changeSet.id = changeSetJson.id;
      changeSet.parentId = changeSetJson.parentId;
      changeSet.fileSize = changeSetJson.fileSize;
      changeSet.changesType = changeSetJson.changesType;
      changeSet.briefcaseId = briefcase.briefcaseId;

      await IModelHubBackend.iModelClient.changeSets.create(accessToken, briefcase.iModelId!, changeSet, changeSetPathname);
      ii++;
      Logger.logInfo(HubUtility.logCategory, `Uploaded Change Set ${ii} of ${count}`, () => ({ ...changeSet }));
    }
  }

  private static async pushNamedVersions(requestContext: AccessToken, briefcase: Briefcase, uploadDir: string, overwrite?: boolean): Promise<void> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const namedVersionsJsonPathname = path.join(uploadDir, "namedVersions.json");
    if (!IModelJsFs.existsSync(namedVersionsJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(namedVersionsJsonPathname) as string;
    const namedVersionsJson = JSON.parse(jsonStr);

    for (const namedVersionJson of namedVersionsJson) {
      const query = (new VersionQuery()).byChangeSet(namedVersionJson.changeSetId);

      const versions = await IModelHubBackend.iModelClient.versions.get(requestContext, briefcase.iModelId!, query);
      if (versions.length > 0 && !overwrite)
        continue;
      await IModelHubBackend.iModelClient.versions.create(requestContext, briefcase.iModelId!, namedVersionJson.changeSetId, namedVersionJson.name, namedVersionJson.description);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcasesById(accessToken: AccessToken, iModelId: GuidString, onReachThreshold: () => void = () => { }, acquireThreshold: number = 16): Promise<void> {
    assert.isTrue(this.allowHubBriefcases || HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const briefcases = await IModelHost.hubAccess.getMyBriefcaseIds({ accessToken, iModelId });
    if (briefcases.length > acquireThreshold) {
      if (undefined !== onReachThreshold)
        onReachThreshold();

      const promises: Promise<void>[] = [];
      briefcases.forEach((briefcaseId) => {
        promises.push(IModelHost.hubAccess.releaseBriefcase({ accessToken, iModelId, briefcaseId }));
      });
      await Promise.all(promises);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(accessToken: AccessToken, iTwinName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    assert.isTrue(this.allowHubBriefcases || HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const iTwinId = await HubUtility.getITwinIdByName(accessToken, iTwinName);
    const iModelId = await HubUtility.queryIModelIdByName(accessToken, iTwinId, iModelName);

    return this.purgeAcquiredBriefcasesById(accessToken, iModelId, () => {
      Logger.logInfo(HubUtility.logCategory, `Reached limit of maximum number of briefcases for ${iTwinName}:${iModelName}. Purging all briefcases.`);
    }, acquireThreshold);
  }

  /** Reads change sets from disk and expects a standard structure of how the folder is organized */
  public static readChangeSets(iModelDir: string): ChangesetFileProps[] {
    const props: ChangesetFileProps[] = [];

    const changeSetJsonPathname = path.join(iModelDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return props;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changesets = JSON.parse(jsonStr);

    for (const changeset of changesets) {
      changeset.index = parseInt(changeset.index, 10); // it's a string from iModelHub
      const pathname = path.join(iModelDir, "changeSets", changeset.fileName);
      if (!IModelJsFs.existsSync(pathname))
        throw new Error(`Cannot find the ChangeSet file: ${pathname}`);
      props.push({ ...changeset, pathname });
    }
    return props;
  }

  /** Creates a standalone iModel from the seed file (version 0) */
  private static copyIModelFromSeed(iModelPathname: string, iModelDir: string, overwrite: boolean) {
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

  /** Applies change sets one by one (for debugging) */
  public static applyChangeSetsToNativeDb(nativeDb: IModelJsNative.DgnDb, changeSets: ChangesetFileProps[]): ChangeSetStatus {
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

  public static dumpChangeSet(iModel: IModelDb, changeSet: ChangesetFileProps) {
    iModel.nativeDb.dumpChangeset(changeSet);
  }

  /** Dumps change sets to the log */
  public static dumpChangeSetsToLog(iModelDb: IModelDb, changeSets: ChangesetFileProps[]) {
    let count = 0;
    changeSets.forEach((changeSet) => {
      count++;
      Logger.logInfo(HubUtility.logCategory, `Dumping change set: ${count} of ${changeSets.length}`, () => ({ ...changeSet }));
      HubUtility.dumpChangeSet(iModelDb, changeSet);
    });
  }

  /** Dumps change sets to Db */
  public static dumpChangeSetsToDb(changeSetDbPathname: string, changeSets: ChangesetFileProps[], dumpColumns: boolean = true) {
    let count = 0;
    changeSets.forEach((changeSet) => {
      count++;
      Logger.logInfo(HubUtility.logCategory, `Dumping change set: ${count} of ${changeSets.length}`, () => ({ ...changeSet }));
      HubUtility.dumpChangeSetToDb(changeSet.pathname, changeSetDbPathname, dumpColumns);
    });
  }

  public static dumpChangeSetToDb(changeSetPathname: string, changeSetDbPathname: string, dumpColumns: boolean = true): BentleyStatus {
    if (!IModelJsFs.existsSync(changeSetPathname))
      throw new Error("Changeset file does not exists");
    return IModelHost.platform.RevisionUtility.dumpChangesetToDb(changeSetPathname, changeSetDbPathname, dumpColumns);
  }

  /** Generate a name (for an iModel) that's unique for the user + host */
  public static generateUniqueName(baseName: string) {
    return `${baseName} - ${Guid.createValue()}`;
  }

  /** Deletes and re-creates an iModel with the provided name in the iTwin.
   * @returns the iModelId of the newly created iModel.
  */
  public static async recreateIModel(arg: { accessToken: AccessToken, iTwinId: GuidString, iModelName: string, noLocks?: true }): Promise<GuidString> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const deleteIModel = await HubUtility.queryIModelByName(arg.accessToken, arg.iTwinId, arg.iModelName);
    if (undefined !== deleteIModel)
      await IModelHost.hubAccess.deleteIModel({ accessToken: arg.accessToken, iTwinId: arg.iTwinId, iModelId: deleteIModel });

    // Create a new iModel
    return IModelHost.hubAccess.createNewIModel({ ...arg, description: `Description for ${arg.iModelName}` });
  }

  /** Create an iModel with the name provided if it does not already exist. If it does exist, the iModelId is returned. */
  public static async createIModel(accessToken: AccessToken, iTwinId: GuidString, iModelName: string): Promise<GuidString> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that modify iModels");
    let iModelId = await HubUtility.queryIModelByName(accessToken, iTwinId, iModelName);
    if (!iModelId)
      iModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: `Description for iModel` });
    return iModelId;
  }
}

/** An implementation of TestITwin backed by an iTwin */
class TestITwin {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  public get iModelHubClient(): IModelHubClient {
    return IModelHubBackend.iModelClient as IModelHubClient;
  }

  private static _iTwinAccessClient?: ITwinAccessClient;

  private static get iTwinClient(): ITwinAccessClient {
    if (this._iTwinAccessClient === undefined)
      this._iTwinAccessClient = new ITwinAccessClient();
    return this._iTwinAccessClient;
  }

  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const client = TestITwin.iTwinClient;
    const iTwinList: ITwin[] = await client.getAll(accessToken, {
      search: {
        searchString: name,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }

  public async queryIModels(accessToken: AccessToken, iTwinId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = this.iModelHubClient;
    return client.iModels.get(accessToken, iTwinId, query);
  }
}

let iTwinAbstraction: TestITwin;
export function getITwinAbstraction(): TestITwin {
  if (iTwinAbstraction !== undefined)
    return iTwinAbstraction;

  return iTwinAbstraction = new TestITwin();
}

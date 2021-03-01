/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, BentleyStatus, ChangeSetApplyOption, ChangeSetStatus, DbResult, GuidString, Logger, OpenMode, PerfLogger } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { BriefcaseQuery, ChangeSet, ChangeSetQuery, ChangesType, Briefcase as HubBriefcase, HubIModel, IModelHubClient, IModelQuery, Version, VersionQuery } from "@bentley/imodelhub-client";
import { IModelError } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import * as os from "os";
import * as path from "path";
import { BriefcaseIdValue, ChangeSetToken, IModelDb, IModelHost, IModelJsFs } from "../../imodeljs-backend";

/** Utility to work with iModelHub */
export class HubUtility {

  public static logCategory = "HubUtility";

  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    HubUtility.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  private static deleteDirectoryRecursive(dirPath: string) {
    if (!IModelJsFs.existsSync(dirPath))
      return;
    try {
      IModelJsFs.readdirSync(dirPath).forEach((file) => {
        const curPath = `${dirPath}/${file}`;
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          HubUtility.deleteDirectoryRecursive(curPath);
        } else {
          // delete file
          IModelJsFs.unlinkSync(curPath);
        }
      });
      IModelJsFs.rmdirSync(dirPath);
    } catch (err) {
      return; // todo: This seems to fail sometimes for no reason
    }
  }

  private static async queryProjectByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project | undefined> {
    const project = await getIModelProjectAbstraction().queryProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    return project;
  }

  public static async queryIModelByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(requestContext, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      return undefined;
    if (iModels.length > 1)
      throw new Error(`Too many iModels with name ${iModelName} found`);
    return iModels[0];
  }

  private static async queryIModelById(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(requestContext, projectId, new IModelQuery().byId(iModelId));
    if (iModels.length === 0)
      return undefined;
    return iModels[0];
  }

  /**
   * Queries the project id by its name
   * @param requestContext The client request context
   * @param projectName Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async queryProjectIdByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const project = await HubUtility.queryProjectByName(requestContext, projectName);
    if (!project)
      throw new Error(`Project ${projectName} not found`);
    return project.wsgId;
  }

  /**
   * Queries the iModel id by its name
   * @param requestContext The client request context
   * @param projectId Id of the project
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<GuidString> {
    const iModel = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (!iModel || !iModel.id)
      throw new Error(`IModel ${iModelName} not found`);
    return iModel.id;
  }

  /** Query the latest change set (id) of the specified iModel */
  public static async queryLatestChangeSet(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<ChangeSet | undefined> {
    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? undefined : changeSets[changeSets.length - 1];
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangeSets(requestContext: AuthorizedClientRequestContext, changeSetsPath: string, _projectId: string, iModelId: GuidString): Promise<ChangeSet[]> {
    // Determine the range of changesets that remain to be downloaded
    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery()); // oldest to newest
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

    const perfLogger = new PerfLogger("HubUtility.downloadChangeSets -> Download ChangeSets");
    await IModelHost.iModelClient.changeSets.download(requestContext, iModelId, query, changeSetsPath);
    perfLogger.dispose();
    return changeSets;
  }

  /** Download all named versions of the specified iModel */
  private static async downloadNamedVersions(requestContext: AuthorizedClientRequestContext, _projectId: string, iModelId: GuidString): Promise<Version[]> {
    const query = new VersionQuery();
    query.orderBy("createdDate");

    const perfLogger = new PerfLogger("HubUtility.downloadNamedVersions -> Get Version Infos");
    const versions = await IModelHost.iModelClient.versions.get(requestContext, iModelId, query);
    perfLogger.dispose();
    if (versions.length === 0)
      return new Array<ChangeSet>();
    return versions;
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelById(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString, downloadDir: string, reDownload: boolean): Promise<void> {
    // Recreate the download folder if necessary
    if (reDownload) {
      if (IModelJsFs.existsSync(downloadDir))
        HubUtility.deleteDirectoryRecursive(downloadDir);
      HubUtility.makeDirectoryRecursive(downloadDir);
    }

    const iModel = await HubUtility.queryIModelById(requestContext, projectId, iModelId);
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
      await IModelHost.iModelClient.iModels.download(requestContext, iModelId, seedPathname);
      perfLogger.dispose();
    }

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets = await HubUtility.downloadChangeSets(requestContext, changeSetDir, projectId, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);

    // Download the version information
    const namedVersions = await HubUtility.downloadNamedVersions(requestContext, projectId, iModelId);
    const namedVersionsJsonStr = JSON.stringify(namedVersions, undefined, 4);
    const namedVersionsJsonPathname = path.join(downloadDir, "namedVersions.json");
    IModelJsFs.writeFileSync(namedVersionsJsonPathname, namedVersionsJsonStr);
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelByName(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string, downloadDir: string, reDownload: boolean): Promise<void> {
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);

    const iModel = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (!iModel)
      throw new Error(`IModel ${iModelName} not found`);
    const iModelId = iModel.id!;

    await HubUtility.downloadIModelById(requestContext, projectId, iModelId, downloadDir, reDownload);
  }

  /** Delete an IModel from the hub
   * @internal
   */
  public static async deleteIModel(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string): Promise<void> {
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);

    await IModelHost.iModelClient.iModels.delete(requestContext, projectId, iModelId);
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
    const result = nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Could not open iModel");

    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);
    const endNum: number = endCS ? endCS : changeSets.length;
    const filteredCS = changeSets.filter((obj) => obj.index >= startCS && obj.index <= endNum);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    const applyOption = ChangeSetApplyOption.Merge;
    const perfLogger = new PerfLogger(`Applying change sets for operation ${ChangeSetApplyOption[applyOption]}`);

    const results = [];
    // Apply change sets one by one to debug any issues
    for (const changeSet of filteredCS) {
      const tempChangeSets = [changeSet];

      const startTime = new Date().getTime();
      const status: ChangeSetStatus = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(nativeDb, JSON.stringify(tempChangeSets), applyOption);
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;

      if (status === ChangeSetStatus.Success) {
        Logger.logInfo(HubUtility.logCategory, "Successfully applied ChangeSet", () => ({ ...changeSet, status, applyOption }));
      } else {
        Logger.logError(HubUtility.logCategory, "Error applying ChangeSet", () => ({ ...changeSet, status, applyOption }));
      }
      results.push({
        csNum: changeSet.index,
        csId: changeSet.id,
        csApplyOption: ChangeSetApplyOption[applyOption],
        csResult: ChangeSetStatus[status],
        time: elapsedTime,
      });
      if (status !== ChangeSetStatus.Success)
        return results;
    }

    perfLogger.dispose();
    nativeDb.closeIModel();

    return results;
  }

  /** Validate apply with briefcase on disk
   */
  public static validateApplyChangeSetsOnDisk(iModelDir: string) {
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

    Logger.logInfo(HubUtility.logCategory, "Making a local copy of the seed");
    HubUtility.copyIModelFromSeed(briefcasePathname, iModelDir, false /* =overwrite */);

    const nativeDb = new IModelHost.platform.DgnDb();
    const result = nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Could not open iModel");

    const lastAppliedChangeSetId = nativeDb.getParentChangeSetId();
    assert(!nativeDb.getReversedChangeSetId());

    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);
    const lastMergedChangeSet = changeSets.find((value: ChangeSetToken) => value.id === lastAppliedChangeSetId);
    const filteredChangeSets = lastMergedChangeSet ? changeSets.filter((value: ChangeSetToken) => value.index > lastMergedChangeSet.index) : changeSets;

    // Logger.logInfo(HubUtility.logCategory, "Dumping all available change sets");
    // HubUtility.dumpChangeSetsToLog(iModel, changeSets);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    const status: ChangeSetStatus = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets, ChangeSetApplyOption.Merge);

    nativeDb.closeIModel();
    assert(status === ChangeSetStatus.Success, "Error applying change sets");
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
    const result = nativeDb.openIModel(briefcasePathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Could not open iModel");

    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);

    let status: ChangeSetStatus;

    // Logger.logInfo(HubUtility.logCategory, "Dumping all available change sets");
    // HubUtility.dumpChangeSetsToLog(iModel, changeSets);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    status = HubUtility.applyChangeSetsToNativeDb(nativeDb, changeSets, ChangeSetApplyOption.Merge);

    // Reverse changes until there's a schema change set (note that schema change sets cannot be reversed)
    const reverseChangeSets = changeSets.reverse();
    const schemaChangeIndex = reverseChangeSets.findIndex((token: ChangeSetToken) => token.changeType === ChangesType.Schema);
    const filteredChangeSets = reverseChangeSets.slice(0, schemaChangeIndex); // exclusive of element at schemaChangeIndex
    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reversing all available change sets");
      status = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets, ChangeSetApplyOption.Reverse);
    }

    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reinstating all available change sets");
      filteredChangeSets.reverse();
      status = HubUtility.applyChangeSetsToNativeDb(nativeDb, filteredChangeSets, ChangeSetApplyOption.Reinstate);
    }

    nativeDb.closeIModel();
    assert(status === ChangeSetStatus.Success, "Error applying change sets");
  }

  /** Validate all change set operations by downloading seed files & change sets, creating a standalone iModel,
   * merging the change sets, reversing them, and finally reinstating them. The method also logs the necessary performance
   * metrics with these operations.
   */
  public static async validateAllChangeSetOperations(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString, iModelDir: string) {
    Logger.logInfo(HubUtility.logCategory, "Downloading seed file and all available change sets");
    await HubUtility.downloadIModelById(requestContext, projectId, iModelId, iModelDir, true /* =reDownload */);

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
  public static async pushIModel(requestContext: AuthorizedClientRequestContext, projectId: string, pathname: string, iModelName?: string, overwrite?: boolean): Promise<GuidString> {
    // Delete any existing iModels with the same name as the required iModel
    const locIModelName = iModelName || path.basename(pathname, ".bim");
    let iModel = await HubUtility.queryIModelByName(requestContext, projectId, locIModelName);
    if (iModel) {
      if (!overwrite)
        return iModel.id!;
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, iModel.id!);
    }

    // Upload a new iModel
    iModel = await IModelHost.iModelClient.iModels.create(requestContext, projectId, locIModelName, { path: pathname });
    return iModel.id!;
  }

  /** Upload an IModel's seed files and change sets to the hub
   * It's assumed that the uploadDir contains a standard hierarchy of seed files and change sets.
   */
  public static async pushIModelAndChangeSets(requestContext: AuthorizedClientRequestContext, projectName: string, uploadDir: string, iModelName?: string, overwrite?: boolean): Promise<GuidString> {
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const seedPathname = HubUtility.getSeedPathname(uploadDir);
    const iModelId = await HubUtility.pushIModel(requestContext, projectId, seedPathname, iModelName, overwrite);

    let briefcase: HubBriefcase;
    const hubBriefcases = await IModelHost.iModelClient.briefcases.get(requestContext, iModelId);
    if (hubBriefcases.length > 0)
      briefcase = hubBriefcases[0];
    else
      briefcase = await IModelHost.iModelClient.briefcases.create(requestContext, iModelId);
    if (!briefcase) {
      throw new Error(`Could not acquire a briefcase for the iModel ${iModelId}`);
    }
    briefcase.iModelId = iModelId;

    await HubUtility.pushChangeSets(requestContext, briefcase, uploadDir);
    await HubUtility.pushNamedVersions(requestContext, briefcase, uploadDir, overwrite);
    return iModelId;
  }

  private static async pushChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: HubBriefcase, uploadDir: string): Promise<void> {
    const changeSetJsonPathname = path.join(uploadDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    // Find the last change set that was already uploaded
    const lastUploadedChangeSet = await HubUtility.queryLatestChangeSet(requestContext, briefcase.iModelId!);
    const lastIndex = lastUploadedChangeSet ? changeSetsJson.findIndex((changeSetJson: any) => changeSetJson.id === lastUploadedChangeSet.id) : -1;
    const filteredChangeSetsJson = lastUploadedChangeSet ? changeSetsJson.slice(lastIndex + 1) : changeSetsJson;

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

      await IModelHost.iModelClient.changeSets.create(requestContext, briefcase.iModelId!, changeSet, changeSetPathname);
      ii++;
      Logger.logInfo(HubUtility.logCategory, `Uploaded Change Set ${ii} of ${count}`, () => ({ ...changeSet }));
    }
  }

  private static async pushNamedVersions(requestContext: AuthorizedClientRequestContext, briefcase: HubBriefcase, uploadDir: string, overwrite?: boolean): Promise<void> {
    const namedVersionsJsonPathname = path.join(uploadDir, "namedVersions.json");
    if (!IModelJsFs.existsSync(namedVersionsJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(namedVersionsJsonPathname) as string;
    const namedVersionsJson = JSON.parse(jsonStr);

    for (const namedVersionJson of namedVersionsJson) {
      const query = (new VersionQuery()).byChangeSet(namedVersionJson.changeSetId);

      const versions = await IModelHost.iModelClient.versions.get(requestContext, briefcase.iModelId!, query);
      if (versions.length > 0 && !overwrite)
        continue;
      await IModelHost.iModelClient.versions.create(requestContext, briefcase.iModelId!, namedVersionJson.changeSetId, namedVersionJson.name, namedVersionJson.description);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcasesById(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, onReachThreshold: () => void, acquireThreshold: number = 16): Promise<void> {
    const briefcases = await IModelHost.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe());
    if (briefcases.length > acquireThreshold) {
      onReachThreshold();

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(IModelHost.iModelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);

    return this.purgeAcquiredBriefcasesById(requestContext, iModelId, () => {
      Logger.logInfo(HubUtility.logCategory, `Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`);
    }, acquireThreshold);
  }

  /** Reads change sets from disk and expects a standard structure of how the folder is organized */
  public static readChangeSets(iModelDir: string): ChangeSetToken[] {
    const tokens = new Array<ChangeSetToken>();

    const changeSetJsonPathname = path.join(iModelDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return tokens;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    for (const changeSetJson of changeSetsJson) {
      const changeSetPathname = path.join(iModelDir, "changeSets", changeSetJson.fileName);
      if (!IModelJsFs.existsSync(changeSetPathname)) {
        throw new Error(`Cannot find the ChangeSet file: ${changeSetPathname}`);
      }
      tokens.push(new ChangeSetToken(changeSetJson.id, changeSetJson.parentId, +changeSetJson.index, changeSetPathname, changeSetJson.changesType!));
    }

    return tokens;
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
    const status = nativeDb.openIModel(iModelPathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== status)
      throw new IModelError(status, "Could not open iModel");
    nativeDb.deleteAllTxns();
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
    if (nativeDb.queryLocalValue("StandaloneEdit"))
      nativeDb.deleteLocalValue("StandaloneEdit");
    nativeDb.saveChanges();
    nativeDb.closeIModel();

    return iModelPathname;
  }

  /** Applies change sets one by one (for debugging) */
  public static applyChangeSetsToNativeDb(nativeDb: IModelJsNative.DgnDb, changeSets: ChangeSetToken[], applyOption: ChangeSetApplyOption): ChangeSetStatus {
    const perfLogger = new PerfLogger(`Applying change sets for operation ${ChangeSetApplyOption[applyOption]}`);

    // Apply change sets one by one to debug any issues
    let count = 0;
    for (const changeSet of changeSets) {
      const tempChangeSets = [changeSet];
      ++count;
      Logger.logInfo(HubUtility.logCategory, `Started applying change set: ${count} of ${changeSets.length} (${new Date(Date.now()).toString()})`, () => ({ ...changeSet }));
      const status: ChangeSetStatus = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(nativeDb, JSON.stringify(tempChangeSets), applyOption);
      if (status === ChangeSetStatus.Success) {
        Logger.logInfo(HubUtility.logCategory, "Successfully applied ChangeSet", () => ({ ...changeSet, status }));
      } else {
        Logger.logError(HubUtility.logCategory, "Error applying ChangeSet", () => ({ ...changeSet, status }));
      }
      if (status !== ChangeSetStatus.Success)
        return status;
    }

    perfLogger.dispose();
    return ChangeSetStatus.Success;
  }

  public static dumpChangeSet(iModel: IModelDb, changeSetToken: ChangeSetToken) {
    iModel.nativeDb.dumpChangeSet(JSON.stringify(changeSetToken));
  }

  /** Dumps change sets to the log */
  public static dumpChangeSetsToLog(iModelDb: IModelDb, changeSets: ChangeSetToken[]) {
    let count = 0;
    changeSets.forEach((changeSet) => {
      count++;
      Logger.logInfo(HubUtility.logCategory, `Dumping change set: ${count} of ${changeSets.length}`, () => ({ ...changeSet }));
      HubUtility.dumpChangeSet(iModelDb, changeSet);
    });
  }

  /** Dumps change sets to Db */
  public static dumpChangeSetsToDb(changeSetDbPathname: string, changeSets: ChangeSetToken[], dumpColumns: boolean = true) {
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
    let username = "AnonymousUser";
    let hostname = "AnonymousHost";
    try {
      hostname = os.hostname();
      username = os.userInfo().username;
    } catch (err) {
    }
    return `${baseName}_${username}_${hostname}`;
  }

  /** Create  */
  public static async recreateIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString, iModelName: string): Promise<GuidString> {
    // Delete any existing iModel
    try {
      const deleteIModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, deleteIModelId);
    } catch (err) {
    }

    // Create a new iModel
    const iModel = await IModelHost.iModelClient.iModels.create(requestContext, projectId, iModelName, { description: `Description for ${iModelName}` });
    return iModel.wsgId;
  }
}

/** An implementation of IModelProjectAbstraction backed by an iTwin project */
class TestIModelHubProject {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  public get iModelHubClient(): IModelHubClient {
    return IModelHost.iModelClient as IModelHubClient;
  }

  private static _contextRegistryClient?: ContextRegistryClient;

  private static get connectClient(): ContextRegistryClient {
    if (this._contextRegistryClient === undefined)
      this._contextRegistryClient = new ContextRegistryClient();
    return this._contextRegistryClient;
  }

  public async queryProject(requestContext: AuthorizedClientRequestContext, query: any | undefined): Promise<Project> {
    const client = TestIModelHubProject.connectClient;
    return client.getProject(requestContext, query);
  }

  public async createIModel(requestContext: AuthorizedClientRequestContext, projectId: string, params: any): Promise<HubIModel> {
    const client = this.iModelHubClient;
    return client.iModels.create(requestContext, projectId, params.name, { path: params.seedFile, description: params.description, progressCallback: params.tracker });
  }
  public async deleteIModel(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString): Promise<void> {
    const client = this.iModelHubClient;
    return client.iModels.delete(requestContext, projectId, iModelId);
  }
  public async queryIModels(requestContext: AuthorizedClientRequestContext, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = this.iModelHubClient;
    return client.iModels.get(requestContext, projectId, query);
  }
}

let projectAbstraction: any;
let authorizationAbstraction: any;
const usingMocks = false;

export function getIModelPermissionAbstraction(): any {
  if (authorizationAbstraction !== undefined)
    return authorizationAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return authorizationAbstraction = {};
  }

  throw new Error("WIP");
}

export function getIModelProjectAbstraction(): any {
  if (projectAbstraction !== undefined)
    return projectAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return projectAbstraction = new TestIModelHubProject();
  }

  throw new Error("WIP");
}

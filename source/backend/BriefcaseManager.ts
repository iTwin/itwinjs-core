/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, Briefcase as HubBriefcase, IModelHubClient, ChangeSet, IModel as HubIModel, ContainsSchemaChanges, SeedFile, SeedFileInitState, Briefcase } from "@bentley/imodeljs-clients";
import { ChangeSetProcessOption, BeEvent, DbResult, OpenMode, assert, Logger } from "@bentley/bentleyjs-core";
import { BriefcaseStatus, IModelError, IModelVersion, IModelToken } from "@bentley/imodeljs-common";
import { AddonRegistry } from "./AddonRegistry";
import { AddonDgnDb, ErrorStatusOrResult } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { IModelDb } from "./IModelDb";
import { iModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import * as path from "path";
import * as fs from "fs";

const loggingCategory = "imodeljs-backend.BriefcaseManager";

/** The ID assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels */
export class BriefcaseId {
  private value: number;
  public static get Illegal(): number { return 0xffffffff; }
  public static get Master(): number { return 0; }
  public static get Standalone(): number { return 1; }
  constructor(value?: number) {
    if (value === undefined)
      this.value = BriefcaseId.Illegal;
    else this.value = value;
  }
  public isValid(): boolean { return this.value !== BriefcaseId.Illegal; }
  public isMaster(): boolean { return this.value !== BriefcaseId.Master; }
  public isStandaloneId(): boolean { return this.value !== BriefcaseId.Standalone; }
  public getValue(): number { return this.value; }
  public toString(): string { return this.value.toString(); }
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  No = 0,
  Yes = 1,
}

/** A token that represents a ChangeSet */
class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public containsSchemaChanges: ContainsSchemaChanges) { }
}

/** Entry in the briefcase cache */
export class BriefcaseEntry {
  /** Id of the iModel - set to the DbGuid field in the BIM, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId: string;

  /** Id of the last change set that was applied to the BIM.
   * Set to an empty string if it's the initial version, or a standalone briefcase
   */
  public changeSetId: string;

  /** Index of the last change set that was applied to the BI.
   * Only specified if the briefcase was acquired from the Hub.
   * Set to 0 if it's the initial version.
   */
  public changeSetIndex?: number;

  /** Id of the last change set that was applied to the BIM after it was reversed.
   * Undefined if no change sets have been reversed.
   * Set to empty string if reversed to the first version.
   */
  public reversedChangeSetId?: string;

  /** Index of the last change set that was applied to the BIM after it was reversed.
   * Undefined if no change sets have been reversed
   * Set to 0 if the briefcase has been reversed to the first version
   */
  public reversedChangeSetIndex?: number;

  /** Briefcase Id  */
  public briefcaseId: number;

  /** Absolute path where the briefcase is cached/stored */
  public pathname: string;

  /** Flag indicating if the briefcase is standalone or from the iModelHub */
  public isStandalone?: boolean;

  /** Mode used to open the iModel */
  public openMode: OpenMode;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen: boolean;

  /** Id of the user that acquired the briefcase. This is not set if it's standalone briefcase */
  public userId?: string;

  /** In-memory handle of the native Db */
  public nativeDb: AddonDgnDb;

  /** In-memory handle fo the IModelDb that corresponds with this briefcase. This is only set if an IModelDb wrapper has been created for this briefcase */
  public iModelDb?: IModelDb;

  /** File Id used to upload change sets for this briefcase (only setup in Read-Write cases) */
  public fileId?: string;

  /** Event called when the briefcase is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Event called when the version of the briefcase has been updated */
  public readonly onBeforeVersionUpdate = new BeEvent<() => void>();

  /** Gets the path key to be used in the cache and iModelToken */
  public getPathKey(): string {
    if (this.isStandalone)
      return this.pathname;

    const cacheDir = iModelHost.configuration.briefcaseCacheDir;
    assert(this.pathname.startsWith(cacheDir));
    return this.pathname.substr(cacheDir.length);
  }
}

/** In-memory cache of briefcases */
class BriefcaseCache {
  private readonly briefcases = new Map<string, BriefcaseEntry>(); // Indexed by (relative) path

  /** Find a briefcase in the cache by token */
  public findBriefcaseByToken({ pathKey }: IModelToken): BriefcaseEntry | undefined {
    assert(!!pathKey);
    return this.briefcases.get(pathKey!);
  }

  /** Find a briefcase in the cache */
  public findBriefcase(briefcase: BriefcaseEntry): BriefcaseEntry | undefined {
    return this.briefcases.get(briefcase.getPathKey());
  }

  /** Add a briefcase to the cache */
  public addBriefcase(briefcase: BriefcaseEntry) {
    const pathKey = briefcase.getPathKey();

    if (this.briefcases.get(pathKey)) {
      const msg = `Briefcase ${pathKey} already exists in the cache.`;
      Logger.logError(loggingCategory, msg);
      throw new IModelError(DbResult.BE_SQLITE_ERROR, msg);
    }

    this.briefcases.set(pathKey, briefcase);
  }

  /** Remove a briefcase from the cache */
  public deleteBriefcase(briefcase: BriefcaseEntry) {
    const pathKey = briefcase.getPathKey();

    if (!this.briefcases.get(pathKey)) {
      const msg = `Briefcase ${pathKey} not found in cache`;
      Logger.logError(loggingCategory, msg);
      throw new IModelError(DbResult.BE_SQLITE_ERROR, msg);
    }

    this.briefcases.delete(pathKey);
  }

  /** Get all entries in the cache */
  public getFilteredBriefcases(filterFn: (value: BriefcaseEntry) => boolean): BriefcaseEntry[] {
    const filteredBriefcases = new Array<BriefcaseEntry>();
    this.briefcases.forEach((value: BriefcaseEntry) => {
      if (filterFn(value))
        filteredBriefcases.push(value);
    });
    return filteredBriefcases;
  }

  /** Checks if the cache is empty */
  public isEmpty(): boolean {
    return this.briefcases.size === 0;
  }

  /** Clears all entries in the cache */
  public clear() {
    this.briefcases.clear();
  }
}

/** Utility to manage briefcases
 * @description
 * Folder structure for cached imodels:
 *  /assets/imodels/                => cachePath (can be specified)
 *    iModelId1/                    => iModelPath
 *      csets/                      => csetPath
 *        csetId1.cs
 *        csetid2.cs
 *        ...
 *      readOnly/
 *        0/IModelName.bim
 *        1/IModelName.bim
 *        ...
 *      readWrite/
 *        briefcaseId1/IModelName.bim
 *        briefcaseId2/IModelName.bim
 *        ...
 *    iModelId2/
 *      ...
 */
export class BriefcaseManager {
  private static hubClient?: IModelHubClient;
  private static cache: BriefcaseCache = new BriefcaseCache();
  private static standaloneCache: BriefcaseCache = new BriefcaseCache();

  /** Get the local path of the root folder storing the imodel seed file, change sets and briefcases */
  private static getIModelPath(iModelId: string): string {
    assert(!!iModelHost);
    const pathname = path.join(iModelHost.configuration.briefcaseCacheDir, iModelId, "/");
    return path.normalize(pathname);
  }

  public static getChangeSetsPath(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "csets");
  }

  public static getChangeSummaryPathname(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges"));
  }

  private static buildReadOnlyPath(iModelId: string, iModelName: string): string {
    const briefcases = BriefcaseManager.cache.getFilteredBriefcases((entry: BriefcaseEntry) => {
      return entry.iModelId === iModelId && entry.openMode === OpenMode.Readonly;
    });

    let pathname: string | undefined;
    for (let ii = briefcases.length; !pathname || IModelJsFs.existsSync(pathname); ii++) {
      pathname = path.join(BriefcaseManager.getIModelPath(iModelId), "readOnly", ii.toString(), iModelName.concat(".bim"));
    }

    return pathname;
  }

  private static buildReadWritePath(iModelId: string, briefcaseId: number, iModelName: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "readWrite", briefcaseId.toString(), iModelName.concat(".bim"));
  }

  private static buildScratchPath(): string {
    return path.join(iModelHost.configuration.briefcaseCacheDir, "scratch");
  }

  /** Get information on the briefcases that have been cached on disk
   * @description Format of returned JSON:
   *  {
   *    "iModelId1": [
   *      {
   *        "pathname": "path to imodel",
   *        "parentChangeSetId": "Id of parent change set",
   *        "reversedChangeSetId": "Id of change set Db was reversed to, if any",
   *        "briefcaseId": "Id of brief case. Standalone if it's a readonly standalone briefcase.",
   *        "readOnly": true or false
   *      },
   *      {
   *        ...
   *      },
   *    ],
   *    "iModelId2": [
   *      ...
   *    ]
   * }
   */
  private static getCachedBriefcaseInfos(cacheDir: string): any {
    const nativeDb: AddonDgnDb = new (AddonRegistry.getAddon()).AddonDgnDb();
    const res: ErrorStatusOrResult<DbResult, string> = nativeDb.getCachedBriefcaseInfos(cacheDir);
    if (res.error)
      Promise.reject(new IModelError(res.error.status));

    return JSON.parse(res.result!);
  }

  /** Clear the briefcase manager cache of in-memory briefcases */
  private static clearCache() {
    BriefcaseManager.cache.clear();
  }

  private static onIModelHostShutdown() {
    BriefcaseManager.clearCache();
  }

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    BriefcaseManager.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  /** Initialize the briefcase manager cache of in-memory briefcases (if necessary). */
  private static async initCache(accessToken?: AccessToken): Promise<void> {
    if (!BriefcaseManager.cache.isEmpty())
      return;

    if (!iModelHost)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "IModelHost.startup() should be called before any backend operations");

    // TODO: call BriefcaseManager.deleteAllBriefcasesIfNewInstance here?

    iModelHost.onAfterStartup.addListener(BriefcaseManager.onIModelHostShutdown);

    const startTime = new Date().getTime();

    BriefcaseManager.hubClient = new IModelHubClient(iModelHost.configuration.iModelHubDeployConfig);
    if (!accessToken)
      return;

    const cacheDir = iModelHost.configuration.briefcaseCacheDir;
    if (!IModelJsFs.existsSync(cacheDir)) {
      BriefcaseManager.makeDirectoryRecursive(cacheDir);
      return;
    }

    const briefcaseInfos = BriefcaseManager.getCachedBriefcaseInfos(cacheDir);
    const iModelIds = Object.getOwnPropertyNames(briefcaseInfos);
    for (const iModelId of iModelIds) {
      const localBriefcases = briefcaseInfos[iModelId];

      let hubBriefcases: HubBriefcase[] | undefined;

      for (const localBriefcase of localBriefcases) {
        const briefcase = new BriefcaseEntry();
        briefcase.iModelId = iModelId;
        briefcase.changeSetId = localBriefcase.parentChangeSetId;
        briefcase.pathname = localBriefcase.pathname;
        briefcase.openMode = localBriefcase.readOnly ? OpenMode.Readonly : OpenMode.ReadWrite;

        briefcase.briefcaseId = localBriefcase.briefcaseId;
        assert(!localBriefcase.readOnly || localBriefcase.briefcaseId === BriefcaseId.Standalone);
        assert(localBriefcase.readOnly || localBriefcase.briefcaseId !== BriefcaseId.Standalone);

        briefcase.isOpen = false;
        if (localBriefcase.reversedChangeSetId !== undefined)
          briefcase.reversedChangeSetId = localBriefcase.reversedChangeSetId;

        try {
          if (!localBriefcase.readOnly) {
            if (!hubBriefcases)
              hubBriefcases = await BriefcaseManager.hubClient.getBriefcases(accessToken, iModelId);

            const hubBriefcase = hubBriefcases ? hubBriefcases.find((bc: HubBriefcase) => bc.briefcaseId === localBriefcase.briefcaseId) : undefined;
            if (!hubBriefcase) {
              throw new IModelError(DbResult.BE_SQLITE_ERROR);
            }
            briefcase.userId = hubBriefcase.userId;
            briefcase.fileId = hubBriefcase.fileId;
          }

          briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.changeSetId);
          if (briefcase.reversedChangeSetId !== undefined)
            briefcase.reversedChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.reversedChangeSetId);
        } catch (error) {
          // The iModel is unreachable on the hub - deployment configuration is different, imodel was removed, the current user does not have access
          Logger.logWarning(loggingCategory, `Unable to find briefcase ${briefcase.iModelId}:${briefcase.briefcaseId} on the Hub. Deleting it`);
          await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
          continue;
        }

        try {
          // briefcase.nativeDb = undefined;
          BriefcaseManager.cache.addBriefcase(briefcase);
        } catch (error) {
          Logger.logWarning(loggingCategory, `Briefcase ${briefcase.iModelId}:${briefcase.briefcaseId} already exists in cache! Deleting duplicate at path ${briefcase.pathname} from disk.`);
          await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
          continue;
        }
      }
    }

    // TODO: Temporary logging for resolving potential performance issue with briefcase manager initialization
    console.log(`    ...initialization of briefcase cache: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
  }

  /** Get the index of the change set from it's id */
  private static async getChangeSetIndexFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<number> {
    if (changeSetId === "")
      return 0; // the first version
    try {
      const changeSet: ChangeSet = await BriefcaseManager.hubClient!.getChangeSet(accessToken, iModelId, changeSetId, false);
      return +changeSet.index!;
    } catch (err) {
      assert(false, "Could not determine index of change set");
      return -1;
    }
  }

  /** Open a briefcase */
  public static async open(accessToken: AccessToken, projectId: string, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<BriefcaseEntry> {
    await BriefcaseManager.initCache(accessToken);
    assert(!!BriefcaseManager.hubClient);

    const changeSetId: string = await version.evaluateChangeSet(accessToken, iModelId, BriefcaseManager.hubClient!);

    let changeSetIndex: number;
    if (changeSetId === "") {
      changeSetIndex = 0; // First version
    } else {
      const changeSet: ChangeSet = await BriefcaseManager.getChangeSetFromId(accessToken, iModelId, changeSetId);
      changeSetIndex = changeSet ? +changeSet.index! : 0;
    }

    let briefcase = BriefcaseManager.findCachedBriefcaseToOpen(accessToken, iModelId, openMode, changeSetIndex);
    if (briefcase && briefcase.isOpen) {
      assert(briefcase.changeSetIndex === changeSetIndex);
      return briefcase;
    }

    const isNewBriefcase: boolean = !briefcase;
    if (!briefcase)
      briefcase = await BriefcaseManager.createBriefcase(accessToken, projectId, iModelId, openMode);
    else if (!briefcase.isOpen)
      BriefcaseManager.openBriefcase(briefcase);

    await BriefcaseManager.pullAndMergeChanges(accessToken, briefcase, IModelVersion.asOfChangeSet(changeSetId));

    if (isNewBriefcase)
      BriefcaseManager.cache.addBriefcase(briefcase);

    return briefcase;
  }

  /** Close a briefcase */
  public static async close(accessToken: AccessToken, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void> {
    briefcase.onBeforeClose.raiseEvent(briefcase);
    briefcase.nativeDb!.closeDgnDb();
    briefcase.isOpen = false;
    if (keepBriefcase === KeepBriefcase.No)
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
  }

  /** Get the change set from the specified id */
  private static async getChangeSetFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient!.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
    // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    for (const changeSet of changeSets) {
      if (changeSet.wsgId === changeSetId)
        return changeSet;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound, changeSetId));
  }

  /** Finds any existing briefcase for the specified parameters. Pass null for the requiredChangeSet if the first version is to be retrieved */
  private static findCachedBriefcaseToOpen(accessToken: AccessToken, iModelId: string, openMode: OpenMode, requiredChangeSetIndex: number): BriefcaseEntry | undefined {

    // Narrow the cache down to the entries for the specified imodel, openMode and those that don't have any change sets reversed
    const briefcases = this.cache.getFilteredBriefcases((entry: BriefcaseEntry) => entry.iModelId === iModelId && entry.openMode === openMode && !entry.reversedChangeSetId);
    if (!briefcases || briefcases.length === 0)
      return undefined;

    // For read-only cases...
    let briefcase: BriefcaseEntry | undefined;
    if (openMode === OpenMode.Readonly) {

      // first prefer any standalone briefcase that's open, and with changeSetIndex = requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex && entry.briefcaseId === BriefcaseId.Standalone;
      });
      if (briefcase)
        return briefcase;

      // next prefer any standalone briefcase that's closed, and with changeSetIndex = requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && !entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any standalone briefcase that's closed, and with changeSetIndex < requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      return undefined;
    }

    // For read-write cases...

    // first prefer any briefcase that's been acquired by the user, and with changeSetIndex = requiredChangeSetIndex
    const requiredUserId = accessToken.getUserProfile()!.userId;
    briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
      return entry.userId === requiredUserId && entry.changeSetIndex === requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    // next prefer any briefcase that's been acquired by the user, is currently closed, and with changeSetIndex < requiredChangeSetIndex
    briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
      return entry.userId === requiredUserId && !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    return undefined;
  }

  /** Create a briefcase */
  private static async createBriefcase(accessToken: AccessToken, projectId: string, iModelId: string, openMode: OpenMode): Promise<BriefcaseEntry> {
    const iModel: HubIModel = await BriefcaseManager.hubClient!.getIModel(accessToken, projectId, iModelId);

    const seedFiles: SeedFile[] = (await BriefcaseManager.hubClient!.getSeedFiles(accessToken, iModelId, true, {$orderby: "Index+desc", $top: 1}));
    const downloadUrl = seedFiles[0].downloadUrl!;

    const briefcase = new BriefcaseEntry();
    briefcase.changeSetId = seedFiles[0].mergedChangeSetId!;
    briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.changeSetId);
    briefcase.iModelId = iModelId;
    briefcase.isOpen = false;
    briefcase.openMode = openMode;
    briefcase.userId = accessToken.getUserProfile()!.userId;

    let downloadToPathname: string;
    if (openMode === OpenMode.Readonly) {
      downloadToPathname = BriefcaseManager.buildReadOnlyPath(iModelId, iModel.name!);
      briefcase.briefcaseId = BriefcaseId.Standalone;
    } else {
      const hubBriefcase: HubBriefcase = await BriefcaseManager.acquireBriefcase(accessToken, iModelId);
      downloadToPathname = BriefcaseManager.buildReadWritePath(iModelId, +hubBriefcase.briefcaseId!, iModel.name!);
      briefcase.briefcaseId = hubBriefcase.briefcaseId!;
      briefcase.fileId = hubBriefcase.fileId;
    }
    briefcase.pathname = downloadToPathname;

    await BriefcaseManager.downloadSeedFile(downloadUrl, downloadToPathname);

    briefcase.openMode = OpenMode.ReadWrite; // Setup briefcase as ReadWrite to allow pull and merge of changes (irrespective of the real openMode)

    const nativeDb: AddonDgnDb = new (AddonRegistry.getAddon()).AddonDgnDb();
    const res: DbResult = nativeDb.setupBriefcase(JSON.stringify(briefcase));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, briefcase.pathname);

    briefcase.openMode = openMode; // Restore briefcase's openMode
    briefcase.nativeDb = nativeDb;
    briefcase.isOpen = true;

    return briefcase;
  }

  /** Acquire a briefcase */
  private static async acquireBriefcase(accessToken: AccessToken, iModelId: string): Promise<HubBriefcase> {
    const briefcaseId: number = await BriefcaseManager.hubClient!.acquireBriefcase(accessToken, iModelId);
    if (!briefcaseId) {
      Logger.logError(loggingCategory, "Could not acquire briefcase"); // Could well be that the current user does not have the appropriate access
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire));
    }

    const briefcase: HubBriefcase = await BriefcaseManager.hubClient!.getBriefcase(accessToken, iModelId, briefcaseId, true /*=getDownloadUrl*/);
    if (!briefcase) {
      await BriefcaseManager.hubClient!.deleteBriefcase(accessToken, iModelId, briefcaseId)
        .catch(() => {
          assert(false, "Could not delete acquired briefcase");
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDelete));
        });
    }

    return briefcase;
  }

  /** Downloads the briefcase seed file */
  private static async downloadSeedFile(seedUrl: string, seedPathname: string): Promise<void> {
    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.hubClient!.downloadFile(seedUrl, seedPathname)
      .catch(() => {
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
  }

  /** Deletes a briefcase from the local disk (if it exists) */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseEntry) {
    const dirName = path.dirname(briefcase.pathname);
    BriefcaseManager.deleteFolderRecursive(dirName);
  }

  /** Deletes a briefcase from the hub (if it exists) */
  private static async deleteBriefcaseFromHub(accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    assert(!!briefcase.iModelId);

    try {
      await BriefcaseManager.hubClient!.getBriefcase(accessToken, briefcase.iModelId, briefcase.briefcaseId, false /*=getDownloadUrl*/);
    } catch (err) {
      return; // Briefcase does not exist on the hub, or cannot be accessed
    }

    await BriefcaseManager.hubClient!.deleteBriefcase(accessToken, briefcase.iModelId, briefcase.briefcaseId)
      .catch(() => {
        Logger.logError(loggingCategory, "Could not delete the acquired briefcase"); // Could well be that the current user does not have the appropriate access
      });
  }

  /** Deletes a briefcase from the cache (if it exists) */
  private static deleteBriefcaseFromCache(briefcase: BriefcaseEntry) {
    if (!BriefcaseManager.cache.findBriefcase(briefcase))
      return;

    BriefcaseManager.cache.deleteBriefcase(briefcase);
  }

  /** Deletes a briefcase, and releases it's references in the iModelHub */
  private static async deleteBriefcase(accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    BriefcaseManager.deleteBriefcaseFromCache(briefcase);
    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
    await BriefcaseManager.deleteBriefcaseFromHub(accessToken, briefcase);
  }

  /** Get change sets */
  private static async getChangeSets(accessToken: AccessToken, iModelId: string, includeDownloadLink?: boolean, toChangeSetId?: string, fromChangeSetId?: string): Promise<ChangeSet[]> {
    if (toChangeSetId === "" /* first version */ || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>();

    const allChangeSets: ChangeSet[] = await BriefcaseManager.hubClient!.getChangeSets(accessToken, iModelId, includeDownloadLink, fromChangeSetId);
    if (!toChangeSetId)
      return allChangeSets;

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  /** Downloads Change Sets in the specified range */
  private static async downloadChangeSets(accessToken: AccessToken, iModelId: string, toChangeSetId?: string, fromChangeSetId?: string): Promise<ChangeSet[]> {
    const changeSets = await BriefcaseManager.getChangeSets(accessToken, iModelId, true /*includeDownloadLink*/, toChangeSetId, fromChangeSetId);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    const changeSetsToDownload = new Array<ChangeSet>();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      if (!IModelJsFs.existsSync(changeSetPathname))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      await BriefcaseManager.hubClient!.downloadChangeSets(changeSetsToDownload, changeSetsPath)
        .catch(() => {
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
        });
    }

    return changeSets;
  }

  /** Open a standalone iModel from the local disk */
  public static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseEntry {
    if (BriefcaseManager.standaloneCache.findBriefcaseByToken(new IModelToken(pathname)))
      throw new IModelError(DbResult.BE_SQLITE_CANTOPEN, `Cannot open ${pathname} again - it's already been opened once`);

    const nativeDb: AddonDgnDb = new (AddonRegistry.getAddon()).AddonDgnDb();

    const res = nativeDb.openDgnDb(pathname, openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, pathname);

    let briefcaseId: number = nativeDb.getBriefcaseId();
    if (enableTransactions) {
      if (briefcaseId === BriefcaseId.Illegal || briefcaseId === BriefcaseId.Master) {
        briefcaseId = BriefcaseId.Standalone;
        nativeDb.setBriefcaseId(briefcaseId);
      }
      assert(nativeDb.getBriefcaseId() !== BriefcaseId.Illegal || nativeDb.getBriefcaseId() !== BriefcaseId.Master);
    }

    const briefcase = new BriefcaseEntry();
    briefcase.briefcaseId = briefcaseId;
    briefcase.changeSetId = nativeDb.getParentChangeSetId();
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.isOpen = true;
    briefcase.openMode = openMode;
    briefcase.pathname = pathname;
    briefcase.isStandalone = true;
    briefcase.nativeDb = nativeDb;

    BriefcaseManager.standaloneCache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Create a standalone iModel from the local disk */
  public static createStandalone(pathname: string, rootSubjectName: string, rootSubjectDescription?: string): BriefcaseEntry {
    if (BriefcaseManager.standaloneCache.findBriefcaseByToken(new IModelToken(pathname)))
      throw new IModelError(DbResult.BE_SQLITE_ERROR_FileExists, `Cannot create file ${pathname} again - it already exists`);

    const nativeDb: AddonDgnDb = new (AddonRegistry.getAddon()).AddonDgnDb();

    const res: DbResult = nativeDb.createDgnDb(pathname, rootSubjectName, rootSubjectDescription);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, pathname);

    nativeDb.setBriefcaseId(BriefcaseId.Standalone);

    const briefcase = new BriefcaseEntry();
    briefcase.briefcaseId = BriefcaseId.Standalone;
    briefcase.changeSetId = "";
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.isOpen = true;
    briefcase.openMode = OpenMode.ReadWrite;
    briefcase.pathname = pathname;
    briefcase.isStandalone = true;
    briefcase.nativeDb = nativeDb;

    BriefcaseManager.standaloneCache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Close the standalone briefcase */
  public static closeStandalone(briefcase: BriefcaseEntry) {
    briefcase.onBeforeClose.raiseEvent(briefcase);
    briefcase.nativeDb!.closeDgnDb();
    briefcase.isOpen = false;

    if (BriefcaseManager.standaloneCache.findBriefcase(briefcase))
      BriefcaseManager.standaloneCache.deleteBriefcase(briefcase);
  }

  /** Purge closed briefcases */
  public static async purgeClosed(accessToken: AccessToken) {
    await BriefcaseManager.initCache(accessToken);

    const briefcases = BriefcaseManager.cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => !briefcase.isOpen);
    for (const briefcase of briefcases) {
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
    }
  }

  private static deleteFolderRecursive(folderPath: string) {
    if (!IModelJsFs.existsSync(folderPath))
      return;
    try {
      IModelJsFs.readdirSync(folderPath).forEach((file) => {
        const curPath = folderPath + "/" + file;
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          BriefcaseManager.deleteFolderRecursive(curPath);
        } else {
          // delete file
          IModelJsFs.unlinkSync(curPath);
        }
      });
      IModelJsFs.rmdirSync(folderPath);
    } catch (err) {
      return; // todo: This seems to fail sometimes for no reason
    }
  }

  /** Purge all briefcases and reset the briefcase manager */
  public static purgeAll() {
    if (!iModelHost)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "IModelHost.startup() should be called before any backend operations");

    if (IModelJsFs.existsSync(iModelHost.configuration.briefcaseCacheDir))
      BriefcaseManager.deleteFolderRecursive(iModelHost.configuration.briefcaseCacheDir);

    BriefcaseManager.clearCache();
  }

  /** Find the existing briefcase */
  public static findBriefcaseByToken(iModelToken: IModelToken): BriefcaseEntry | undefined {
    return iModelToken.isStandalone ?
      BriefcaseManager.standaloneCache.findBriefcaseByToken(iModelToken) :
      BriefcaseManager.cache.findBriefcaseByToken(iModelToken);
  }

  private static buildChangeSetTokens(changeSets: ChangeSet[], changeSetsPath: string): ChangeSetToken[] {
    const changeSetTokens = new Array<ChangeSetToken>();
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      changeSetTokens.push(new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.containsSchemaChanges!));
    });
    return changeSetTokens;
  }

  private static openBriefcase(briefcase: BriefcaseEntry) {
    if (!briefcase.nativeDb)
      briefcase.nativeDb = new (AddonRegistry.getAddon()).AddonDgnDb();

    // Note: Open briefcase as ReadWrite, even if briefcase.openMode is Readonly. This is to allow to pull and merge change sets.
    const res: DbResult = briefcase.nativeDb.openDgnDb(briefcase.pathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, briefcase.pathname);

    briefcase.isOpen = true;
  }

  private static async applyChangeSets(accessToken: AccessToken, briefcase: BriefcaseEntry, targetVersion: IModelVersion, processOption: ChangeSetProcessOption): Promise<void> {
    assert(!!briefcase.nativeDb && briefcase.isOpen);
    if (briefcase.changeSetIndex === undefined)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot apply changes to a standalone file"));

    const targetChangeSetId: string = await targetVersion.evaluateChangeSet(accessToken, briefcase.iModelId, BriefcaseManager.hubClient!);
    const targetChangeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(accessToken, briefcase.iModelId, targetChangeSetId);
    if (targetChangeSetIndex === undefined)
      return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Could not determine change set information from the Hub"));

    const hasReversedChanges = briefcase.reversedChangeSetId !== undefined;

    const currentChangeSetId: string = hasReversedChanges ? briefcase.reversedChangeSetId! : briefcase.changeSetId!;
    const currentChangeSetIndex: number = hasReversedChanges ? briefcase.reversedChangeSetIndex! : briefcase.changeSetIndex!;

    if (targetChangeSetIndex === currentChangeSetIndex)
      return Promise.resolve(); // nothing to apply

    switch (processOption) {
      case ChangeSetProcessOption.Merge:
        if (hasReversedChanges)
          return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot merge when there are reversed changes"));

        if (targetChangeSetIndex < currentChangeSetIndex)
          return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Nothing to merge"));

        break;
      case ChangeSetProcessOption.Reinstate:
        if (!hasReversedChanges)
          return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "No reversed changes to reinstate"));

        if (targetChangeSetIndex < currentChangeSetIndex)
          return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot reinstate to an earlier version"));

        break;
      case ChangeSetProcessOption.Reverse:
        if (targetChangeSetIndex >= currentChangeSetIndex)
          return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot reverse to a later version"));

        break;
      default:
        assert(false, "Unknown change set process option");
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Unknown ChangeSet process option"));
    }

    const reverse: boolean = (targetChangeSetIndex < currentChangeSetIndex);
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(accessToken, briefcase.iModelId, reverse ? currentChangeSetId : targetChangeSetId, reverse ? targetChangeSetId : currentChangeSetId);
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    // Close Db before merge (if there are schema changes)
    const containsSchemaChanges: boolean = changeSets.some((changeSet: ChangeSet) => changeSet.containsSchemaChanges === ContainsSchemaChanges.Yes);
    if (containsSchemaChanges && briefcase.isOpen)
      briefcase.onBeforeClose.raiseEvent(briefcase);

    // Apply the changes
    const result: DbResult = briefcase.nativeDb!.processChangeSets(JSON.stringify(changeSetTokens), processOption, containsSchemaChanges);
    if (DbResult.BE_SQLITE_OK !== result)
      return Promise.reject(new IModelError(result));

    // Mark Db as reopened after merge (if there are schema changes)
    if (containsSchemaChanges)
      briefcase.isOpen = true;

    switch (processOption) {
      case ChangeSetProcessOption.Merge:
        briefcase.changeSetId = targetChangeSetId;
        briefcase.changeSetIndex = targetChangeSetIndex;
        break;
      case ChangeSetProcessOption.Reinstate:
        if (targetChangeSetIndex === briefcase.changeSetIndex) {
          briefcase.reversedChangeSetIndex = undefined;
          briefcase.reversedChangeSetId = undefined;
        } else {
          briefcase.reversedChangeSetIndex = targetChangeSetIndex;
          briefcase.reversedChangeSetId = targetChangeSetId;
        }
        assert(briefcase.nativeDb.getReversedChangeSetId() === briefcase.reversedChangeSetId);
        break;
      case ChangeSetProcessOption.Reverse:
        briefcase.reversedChangeSetIndex = targetChangeSetIndex;
        briefcase.reversedChangeSetId = targetChangeSetId;
        assert(briefcase.nativeDb.getReversedChangeSetId() === briefcase.reversedChangeSetId);
        break;
      default:
        assert(false, "Unknown change set process option");
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Unknown ChangeSet process option"));
    }
  }

  public static async reverseChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void> {
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, reverseToVersion, ChangeSetProcessOption.Reverse);
  }

  public static async reinstateChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void> {
    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(briefcase.changeSetId);
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, targetVersion, ChangeSetProcessOption.Reinstate);
  }

  /**
   * Pull and merge changes from the hub
   * @param accessToken Delegation token of the authorized user
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   */
  public static async pullAndMergeChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, mergeToVersion, ChangeSetProcessOption.Merge);
  }

  private static startCreateChangeSet(briefcase: BriefcaseEntry): ChangeSetToken {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.startCreateChangeSet();
    if (res.error)
      throw new IModelError(res.error.status);
    return JSON.parse(res.result!);
  }

  private static finishCreateChangeSet(briefcase: BriefcaseEntry) {
    const result = briefcase.nativeDb!.finishCreateChangeSet();
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result);
  }

  /** Push local changes to the hub
   * @param accessToken The access token of the account that has write access to the iModel. This may be a service account.
   * @param briefcase Identifies the IModelDb that contains the pending changes.
   * @param description a description of the changeset that is to be pushed.
   */
  public static async pushChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, description: string): Promise<void> {

    await BriefcaseManager.pullAndMergeChanges(accessToken, briefcase, IModelVersion.latest());

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);

    const changeSet = new ChangeSet();
    changeSet.briefcaseId = briefcase.briefcaseId;
    changeSet.id = changeSetToken.id;
    changeSet.parentId = changeSetToken.parentId;
    changeSet.containsSchemaChanges = changeSetToken.containsSchemaChanges;
    changeSet.seedFileId = briefcase.fileId!;
    changeSet.fileSize = IModelJsFs.lstatSync(changeSetToken.pathname)!.size.toString();
    changeSet.description = description;
    if (changeSet.description.length >= 255) {
      Logger.logWarning(loggingCategory, "pushChanges - Truncating description to 255 characters. " + changeSet.description);
      changeSet.description = changeSet.description.slice(0, 254);
    }

    const postedChangeSet = await BriefcaseManager.hubClient!.uploadChangeSet(accessToken, briefcase.iModelId, changeSet, changeSetToken.pathname);

    BriefcaseManager.finishCreateChangeSet(briefcase);
    briefcase.changeSetId = postedChangeSet.wsgId;
    briefcase.changeSetIndex = +postedChangeSet.index!;
  }

  /** Create an iModel on the iModelHub */
  public static async create(accessToken: AccessToken, projectId: string, hubName: string, rootSubjectName: string, hubDescription?: string, rootSubjectDescription?: string): Promise<BriefcaseEntry> {
    await BriefcaseManager.initCache(accessToken);
    assert(!!BriefcaseManager.hubClient);

    const nativeDb: AddonDgnDb = new (AddonRegistry.getAddon()).AddonDgnDb();

    const scratchDir = BriefcaseManager.buildScratchPath();
    if (!IModelJsFs.existsSync(scratchDir))
      IModelJsFs.mkdirSync(scratchDir);

    const pathname = path.join(scratchDir, hubName + ".bim");
    if (IModelJsFs.existsSync(pathname))
      IModelJsFs.unlinkSync(pathname); // Note: Cannot create two files with the same name at the same time with multiple async calls.

    let res: DbResult = nativeDb.createDgnDb(pathname, rootSubjectName, rootSubjectDescription);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, pathname);

    res = nativeDb.saveChanges();
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res);

    nativeDb.closeDgnDb();

    const iModelId: string = await BriefcaseManager.upload(accessToken, projectId, pathname, hubName, hubDescription);
    return BriefcaseManager.open(accessToken, projectId, iModelId, OpenMode.ReadWrite, IModelVersion.latest());
  }

  /** Pushes a new iModel to the Hub */
  private static async upload(accessToken: AccessToken, projectId: string, pathname: string, hubName?: string, hubDescription?: string, timeOutInMilliseconds: number = 2 * 60 * 1000): Promise<string> {
    hubName = hubName || path.basename(pathname, ".bim");

    const iModel: HubIModel = await BriefcaseManager.hubClient!.createIModel(accessToken, projectId, hubName, hubDescription);

    const seedFile: SeedFile = await BriefcaseManager.hubClient!.uploadSeedFile(accessToken, iModel.wsgId, pathname, hubDescription)
      .catch(async () => {
        await BriefcaseManager.hubClient!.deleteIModel(accessToken, projectId, iModel.wsgId);
        return Promise.reject(new IModelError(BriefcaseStatus.CannotUpload, pathname));
      });

    return new Promise<string>((resolve, reject) => {
      let numRetries: number = 10;
      const retryDelay = timeOutInMilliseconds / numRetries;

      const attempt = () => {
        numRetries--;
        if (numRetries === 0) {
          reject(new IModelError(BriefcaseStatus.CannotUpload));
          return;
        }

        BriefcaseManager.hubClient!.confirmUploadSeedFile(accessToken, iModel.wsgId, seedFile)
          .then((confirmUploadSeedFile: SeedFile) => {
            const initState = confirmUploadSeedFile.initializationState;
            if (initState === SeedFileInitState.Successful) {
              resolve(iModel.wsgId);
              return;
            }

            if (initState !== SeedFileInitState.NotStarted && initState !== SeedFileInitState.Scheduled) {
              reject(new IModelError(BriefcaseStatus.CannotUpload));
              return;
            }
            setTimeout(() => attempt(), retryDelay);
          })
          .catch(() => {
            reject(new IModelError(BriefcaseStatus.CannotUpload));
            return;
          });
      };

      attempt();
    });
  }

  /** @hidden */
  public static async deleteAllBriefcases(accessToken: AccessToken, iModelId: string) {
    if (BriefcaseManager.hubClient === undefined)
      return;
    const promises = new Array<Promise<void>>();
    const briefcases = await BriefcaseManager.hubClient.getBriefcases(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(BriefcaseManager.hubClient!.deleteBriefcase(accessToken, iModelId, briefcase.briefcaseId!));
    });
    return Promise.all(promises);
  }

  /** @hidden */
  public static async deleteAllBriefcasesIfNewInstance(accessToken: AccessToken, iModelId: string) {
    if (fs.existsSync(iModelHost.configuration.briefcaseCacheDir))
      return;
    await BriefcaseManager.initCache(accessToken); // set up hubClient
    return BriefcaseManager.deleteAllBriefcases(accessToken, iModelId);
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */

import {
  AccessToken, Briefcase as HubBriefcase, IModelHubClient, ChangeSet, IModel as HubIModel,
  ContainsSchemaChanges, Briefcase, Code, IModelHubResponseError, IModelHubResponseErrorId,
  BriefcaseQuery, ChangeSetQuery, IModelQuery, AzureFileHandler, ConflictingCodesError,
} from "@bentley/imodeljs-clients";
import { ChangeSetApplyOption, BeEvent, DbResult, OpenMode, assert, Logger, ChangeSetStatus, BentleyStatus } from "@bentley/bentleyjs-core";
import { BriefcaseStatus, IModelError, IModelVersion, IModelToken, CreateIModelProps } from "@bentley/imodeljs-common";
import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { NativeDgnDb, ErrorStatusOrResult } from "@bentley/imodeljs-native-platform-api";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import * as path from "path";

const loggingCategory = "imodeljs-backend.BriefcaseManager";

/** The Id assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels */
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
export class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public containsSchemaChanges: ContainsSchemaChanges) { }
}

/** Entry in the briefcase cache */
export class BriefcaseEntry {
  /** Id of the iModel - set to the DbGuid field in the BIM, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId!: string;

  /** Id of the last change set that was applied to the BIM.
   * Set to an empty string if it's the initial version, or a standalone briefcase
   */
  public changeSetId!: string;

  /** Index of the last change set that was applied to the BI.
   * Only specified if the briefcase was acquired from the Hub.
   * Set to 0 if it's the initial version.
   */
  public changeSetIndex = 0;

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
  public briefcaseId = 0;

  /** Absolute path where the briefcase is cached/stored */
  public pathname!: string;

  /** Flag indicating if the briefcase is standalone or from the iModelHub */
  public isStandalone?: boolean;

  /** Mode used to open the iModel */
  public openMode?: OpenMode;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen = false;

  /** Id of the user that acquired the briefcase. This is not set if it's standalone briefcase */
  public userId?: string;

  /** In-memory handle of the native Db */
  public nativeDb!: NativeDgnDb;

  /** In-memory handle fo the IModelDb that corresponds with this briefcase. This is only set if an IModelDb wrapper has been created for this briefcase */
  public iModelDb?: IModelDb;

  /** File Id used to upload change sets for this briefcase (only setup in Read-Write cases) */
  public fileId?: string;

  /** Error set if push has succeeded, but updating codes has failed with conflicts */
  public conflictError?: ConflictingCodesError;

  /** @hidden Event called after a changeset is applied to a briefcase. */
  public readonly onChangesetApplied = new BeEvent<() => void>();

  /** @hidden Event called when the briefcase is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** @hidden Event called when the version of the briefcase has been updated */
  public readonly onBeforeVersionUpdate = new BeEvent<() => void>();

  /** Gets the path key to be used in the cache and iModelToken */
  public getPathKey(): string {
    if (this.isStandalone)
      return this.pathname;

    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;
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
  public findBriefcase(briefcase: BriefcaseEntry): BriefcaseEntry | undefined { return this.briefcases.get(briefcase.getPathKey()); }

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
  public isEmpty(): boolean { return this.briefcases.size === 0; }

  /** Clears all entries in the cache */
  public clear() { this.briefcases.clear(); }
}

/** Utility to manage briefcases
 *  Folder structure for cached imodels:
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
    const pathname = path.join(IModelHost.configuration!.briefcaseCacheDir, iModelId, "/");
    return path.normalize(pathname);
  }

  public static getChangeSetsPath(iModelId: string): string { return path.join(BriefcaseManager.getIModelPath(iModelId), "csets"); }
  public static getChangeSummaryPathname(iModelId: string): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }

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

  private static buildScratchPath(): string { return path.join(IModelHost.configuration!.briefcaseCacheDir, "scratch"); }

  /** Get information on the briefcases that have been cached on disk
   *  Format of returned JSON:
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
    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();
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
    IModelHost.onBeforeShutdown.removeListener(BriefcaseManager.onIModelHostShutdown);
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

    if (!IModelHost.configuration)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "IModelHost.startup() should be called before any backend operations");

    IModelHost.onBeforeShutdown.addListener(BriefcaseManager.onIModelHostShutdown);

    const startTime = new Date().getTime();

    // Reset the hubclient in case the configuration has changed
    if (!BriefcaseManager.hubClient || BriefcaseManager.hubClient!.deploymentEnv !== IModelHost.configuration!.iModelHubDeployConfig)
      BriefcaseManager.hubClient = new IModelHubClient(IModelHost.configuration!.iModelHubDeployConfig, new AzureFileHandler());

    if (!accessToken)
      return;

    const cacheDir = IModelHost.configuration.briefcaseCacheDir;
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
              hubBriefcases = await BriefcaseManager.hubClient.Briefcases().get(accessToken, iModelId);

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
      const changeSet: ChangeSet = (await BriefcaseManager.hubClient!.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
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

    let changeSetApplyOption: ChangeSetApplyOption | undefined;
    if (changeSetIndex > briefcase.changeSetIndex) {
      changeSetApplyOption = ChangeSetApplyOption.Merge;
    } else if (changeSetIndex < briefcase.changeSetIndex) {
      if (openMode === OpenMode.ReadWrite) {
        Logger.logWarning(loggingCategory, `No support to open an older version in ReadWrite mode. Cannot open briefcase ${briefcase.iModelId}:${briefcase.briefcaseId}.`);
        await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot merge when there are reversed changes"));
      }
      changeSetApplyOption = ChangeSetApplyOption.Reverse;
    }

    try {
      if (changeSetApplyOption)
        await BriefcaseManager.applyChangeSets(accessToken, briefcase, IModelVersion.asOfChangeSet(changeSetId), changeSetApplyOption);
    } catch (error) {
      Logger.logWarning(loggingCategory, `Error merging changes to briefcase  ${briefcase.iModelId}:${briefcase.briefcaseId}. Deleting it so that it can be re-fetched again.`);
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
      return Promise.reject(error);
    }

    if (isNewBriefcase)
      BriefcaseManager.cache.addBriefcase(briefcase);

    return briefcase;
  }

  /** Close a briefcase */
  public static async close(accessToken: AccessToken, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void> {
    briefcase.onBeforeClose.raiseEvent(briefcase);
    briefcase.nativeDb!.closeIModel();
    briefcase.isOpen = false;
    if (keepBriefcase === KeepBriefcase.No)
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
  }

  /** Get the change set from the specified id */
  private static async getChangeSetFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient!.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSetId));
    if (changeSets.length > 0)
      return changeSets[0];

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
    const iModel: HubIModel = (await BriefcaseManager.hubClient!.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];

    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = iModelId;
    briefcase.isOpen = false;
    briefcase.openMode = openMode;
    briefcase.userId = accessToken.getUserProfile()!.userId;

    let downloadToPathname: string;
    if (openMode === OpenMode.Readonly) {
      downloadToPathname = BriefcaseManager.buildReadOnlyPath(iModelId, iModel.name!);
      briefcase.briefcaseId = BriefcaseId.Standalone;
      await BriefcaseManager.downloadSeedFile(accessToken, iModelId, downloadToPathname);
      briefcase.changeSetId = "";
      briefcase.changeSetIndex = 0;
    } else {
      const hubBriefcase: HubBriefcase = await BriefcaseManager.acquireBriefcase(accessToken, iModelId);
      downloadToPathname = BriefcaseManager.buildReadWritePath(iModelId, +hubBriefcase.briefcaseId!, iModel.name!);
      briefcase.briefcaseId = hubBriefcase.briefcaseId!;
      briefcase.fileId = hubBriefcase.fileId;
      await BriefcaseManager.downloadBriefcase(hubBriefcase, downloadToPathname);
      briefcase.changeSetId = hubBriefcase.mergedChangeSetId!;
      briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.changeSetId);
    }
    briefcase.pathname = downloadToPathname;

    briefcase.openMode = OpenMode.ReadWrite; // Setup briefcase as ReadWrite to allow pull and merge of changes (irrespective of the real openMode)

    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();
    const res: DbResult = nativeDb.setupBriefcase(JSON.stringify(briefcase));
    if (DbResult.BE_SQLITE_OK !== res) {
      Logger.logWarning(loggingCategory, `Unable to create briefcase ${briefcase.pathname}. Deleting any remnants of it`);
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
      throw new IModelError(res, briefcase.pathname);
    }

    assert(nativeDb.getParentChangeSetId() === briefcase.changeSetId);

    briefcase.openMode = openMode; // Restore briefcase's openMode
    briefcase.nativeDb = nativeDb;
    briefcase.isOpen = true;

    return briefcase;
  }

  /** Acquire a briefcase */
  private static async acquireBriefcase(accessToken: AccessToken, iModelId: string): Promise<HubBriefcase> {
    const briefcase: HubBriefcase = await BriefcaseManager.hubClient!.Briefcases().create(accessToken, iModelId);
    if (!briefcase) {
      Logger.logError(loggingCategory, "Could not acquire briefcase"); // Could well be that the current user does not have the appropriate access
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire));
    }
    return briefcase;
  }

  /** Downloads the briefcase file */
  private static async downloadBriefcase(briefcase: Briefcase, seedPathname: string): Promise<void> {
    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.hubClient!.Briefcases().download(briefcase, seedPathname)
      .catch(() => {
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
  }

  /** Downloads the briefcase seed file */
  private static async downloadSeedFile(accessToken: AccessToken, imodelId: string, seedPathname: string): Promise<void> {
    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.hubClient!.IModels().download(accessToken, imodelId, seedPathname)
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
    if (briefcase.briefcaseId === BriefcaseId.Standalone)
      return;

    try {
      await BriefcaseManager.hubClient!.Briefcases().get(accessToken, briefcase.iModelId, new BriefcaseQuery().byId(briefcase.briefcaseId));
    } catch (err) {
      return; // Briefcase does not exist on the hub, or cannot be accessed
    }

    await BriefcaseManager.hubClient!.Briefcases().delete(accessToken, briefcase.iModelId, briefcase.briefcaseId)
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

  /** Deletes a briefcase, and releases it's references in the iModelHub if necessary */
  private static async deleteBriefcase(accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    BriefcaseManager.deleteBriefcaseFromCache(briefcase);
    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
    await BriefcaseManager.deleteBriefcaseFromHub(accessToken, briefcase);
  }

  /** Get change sets in the specified range
   *  * Gets change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array
   */
  private static async getChangeSets(accessToken: AccessToken, iModelId: string, includeDownloadLink: boolean, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    if (toChangeSetId === "" /* first version */ || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>();

    const query = new ChangeSetQuery();
    if (fromChangeSetId)
      query.fromId(fromChangeSetId);
    if (includeDownloadLink)
      query.selectDownloadUrl();
    const allChangeSets: ChangeSet[] = await BriefcaseManager.hubClient!.ChangeSets().get(accessToken, iModelId, query);

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  private static async downloadChangeSetsInternal(iModelId: string, changeSets: ChangeSet[]) {
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);

    const changeSetsToDownload = new Array<ChangeSet>();
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      if (!IModelJsFs.existsSync(changeSetPathname))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      await BriefcaseManager.hubClient!.ChangeSets().download(changeSetsToDownload, changeSetsPath)
        .catch(() => {
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
        });
    }
  }

  /** Downloads change sets in the specified range.
   *  * Downloads change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array.
   */
  public static async downloadChangeSets(accessToken: AccessToken, iModelId: string, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    const changeSets = await BriefcaseManager.getChangeSets(accessToken, iModelId, true /*includeDownloadLink*/, fromChangeSetId, toChangeSetId);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await BriefcaseManager.downloadChangeSetsInternal(iModelId, changeSets);

    return changeSets;
  }

  /** Open a standalone iModel from the local disk */
  public static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseEntry {
    if (BriefcaseManager.standaloneCache.findBriefcaseByToken(new IModelToken(pathname)))
      throw new IModelError(DbResult.BE_SQLITE_CANTOPEN, `Cannot open ${pathname} again - it's already been opened once`);

    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    const res = nativeDb.openIModel(pathname, openMode);
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
  public static createStandalone(fileName: string, args: CreateIModelProps): BriefcaseEntry {
    if (BriefcaseManager.standaloneCache.findBriefcaseByToken(new IModelToken(fileName)))
      throw new IModelError(DbResult.BE_SQLITE_ERROR_FileExists, `Cannot create file ${fileName} again - it already exists`);

    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    const res: DbResult = nativeDb.createIModel(fileName, JSON.stringify(args));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, fileName);

    nativeDb.setBriefcaseId(BriefcaseId.Standalone);

    const briefcase = new BriefcaseEntry();
    briefcase.briefcaseId = BriefcaseId.Standalone;
    briefcase.changeSetId = "";
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.isOpen = true;
    briefcase.openMode = OpenMode.ReadWrite;
    briefcase.pathname = fileName;
    briefcase.isStandalone = true;
    briefcase.nativeDb = nativeDb;

    BriefcaseManager.standaloneCache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Close the standalone briefcase */
  public static closeStandalone(briefcase: BriefcaseEntry) {
    briefcase.onBeforeClose.raiseEvent(briefcase);
    briefcase.nativeDb!.closeIModel();
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
    if (IModelJsFs.existsSync(IModelHost.configuration!.briefcaseCacheDir))
      BriefcaseManager.deleteFolderRecursive(IModelHost.configuration!.briefcaseCacheDir);

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
      briefcase.nativeDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    // Note: Open briefcase as ReadWrite, even if briefcase.openMode is Readonly. This is to allow to pull and merge change sets.
    const res: DbResult = briefcase.nativeDb.openIModel(briefcase.pathname, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, briefcase.pathname);

    briefcase.isOpen = true;
  }

  private static async applyChangeSets(accessToken: AccessToken, briefcase: BriefcaseEntry, targetVersion: IModelVersion, processOption: ChangeSetApplyOption): Promise<void> {
    assert(!!briefcase.nativeDb && briefcase.isOpen);
    if (briefcase.changeSetIndex === undefined)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot apply changes to a standalone file"));

    const targetChangeSetId: string = await targetVersion.evaluateChangeSet(accessToken, briefcase.iModelId, BriefcaseManager.hubClient!);
    const targetChangeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(accessToken, briefcase.iModelId, targetChangeSetId);
    if (targetChangeSetIndex === undefined)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Could not determine change set information from the Hub"));

    const hasReversedChanges = briefcase.reversedChangeSetId !== undefined;

    const currentChangeSetId: string = hasReversedChanges ? briefcase.reversedChangeSetId! : briefcase.changeSetId!;
    const currentChangeSetIndex: number = hasReversedChanges ? briefcase.reversedChangeSetIndex! : briefcase.changeSetIndex!;

    if (targetChangeSetIndex === currentChangeSetIndex)
      return Promise.resolve(); // nothing to apply

    switch (processOption) {
      case ChangeSetApplyOption.Merge:
        if (hasReversedChanges)
          return Promise.reject(new IModelError(ChangeSetStatus.CannotMergeIntoReversed, "Cannot merge when there are reversed changes"));

        if (targetChangeSetIndex < currentChangeSetIndex)
          return Promise.reject(new IModelError(ChangeSetStatus.NothingToMerge, "Nothing to merge"));

        break;
      case ChangeSetApplyOption.Reinstate:
        if (!hasReversedChanges)
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "No reversed changes to reinstate"));

        if (targetChangeSetIndex < currentChangeSetIndex)
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reinstate to an earlier version"));

        break;
      case ChangeSetApplyOption.Reverse:
        if (targetChangeSetIndex >= currentChangeSetIndex)
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse to a later version"));

        break;
      default:
        assert(false, "Unknown change set process option");
        return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Unknown ChangeSet process option"));
    }

    const reverse: boolean = (targetChangeSetIndex < currentChangeSetIndex);
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(accessToken, briefcase.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    // Close Db before merge (if there are schema changes)
    const containsSchemaChanges: boolean = changeSets.some((changeSet: ChangeSet) => changeSet.containsSchemaChanges === ContainsSchemaChanges.Yes);
    if (containsSchemaChanges && briefcase.isOpen)
      briefcase.onBeforeClose.raiseEvent(briefcase);

    // Apply the changes
    const status: ChangeSetStatus = briefcase.nativeDb!.applyChangeSets(JSON.stringify(changeSetTokens), processOption, containsSchemaChanges);
    if (ChangeSetStatus.Success !== status)
      return Promise.reject(new IModelError(status));

    // Mark Db as reopened after merge (if there are schema changes)
    if (containsSchemaChanges)
      briefcase.isOpen = true;

    switch (processOption) {
      case ChangeSetApplyOption.Merge:
        briefcase.changeSetId = targetChangeSetId;
        briefcase.changeSetIndex = targetChangeSetIndex;
        assert(briefcase.nativeDb.getParentChangeSetId() === briefcase.changeSetId);
        break;
      case ChangeSetApplyOption.Reinstate:
        if (targetChangeSetIndex === briefcase.changeSetIndex) {
          briefcase.reversedChangeSetIndex = undefined;
          briefcase.reversedChangeSetId = undefined;
        } else {
          briefcase.reversedChangeSetIndex = targetChangeSetIndex;
          briefcase.reversedChangeSetId = targetChangeSetId;
        }
        assert(briefcase.nativeDb.getReversedChangeSetId() === briefcase.reversedChangeSetId);
        break;
      case ChangeSetApplyOption.Reverse:
        briefcase.reversedChangeSetIndex = targetChangeSetIndex;
        briefcase.reversedChangeSetId = targetChangeSetId;
        assert(briefcase.nativeDb.getReversedChangeSetId() === briefcase.reversedChangeSetId);
        break;
      default:
        assert(false, "Unknown change set process option");
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Unknown ChangeSet process option"));
    }

    briefcase.onChangesetApplied.raiseEvent();
  }

  public static async reverseChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void> {
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, reverseToVersion, ChangeSetApplyOption.Reverse);
  }

  public static async reinstateChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void> {
    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(briefcase.changeSetId);
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, targetVersion, ChangeSetApplyOption.Reinstate);
  }

  /**
   * Pull and merge changes from the hub
   * @param accessToken Delegation token of the authorized user
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   */
  public static async pullAndMergeChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    await BriefcaseManager.updatePendingChangeSets(accessToken, briefcase);
    return BriefcaseManager.applyChangeSets(accessToken, briefcase, mergeToVersion, ChangeSetApplyOption.Merge);
  }

  private static startCreateChangeSet(briefcase: BriefcaseEntry): ChangeSetToken {
    const res: ErrorStatusOrResult<ChangeSetStatus, string> = briefcase.nativeDb!.startCreateChangeSet();
    if (res.error)
      throw new IModelError(res.error.status);
    return JSON.parse(res.result!);
  }

  private static finishCreateChangeSet(briefcase: BriefcaseEntry) {
    const status = briefcase.nativeDb!.finishCreateChangeSet();
    if (ChangeSetStatus.Success !== status)
      throw new IModelError(status);
  }

  private static abandonCreateChangeSet(briefcase: BriefcaseEntry) {
    briefcase.nativeDb!.abandonCreateChangeSet();
  }

  /** Get array of pending ChangeSet ids that need to have their codes updated */
  private static getPendingChangeSets(briefcase: BriefcaseEntry): string[] {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.getPendingChangeSets();
    if (res.error)
      throw new IModelError(res.error.status);
    return JSON.parse(res.result!) as string[];
  }

  /** Add a pending ChangeSet before updating its codes */
  private static addPendingChangeSet(briefcase: BriefcaseEntry, changeSetId: string): void {
    const result = briefcase.nativeDb!.addPendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result);
  }

  /** Remove a pending ChangeSet after its codes have been updated */
  private static removePendingChangeSet(briefcase: BriefcaseEntry, changeSetId: string): void {
    const result = briefcase.nativeDb!.removePendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result);
  }

  /** Update codes for all pending ChangeSets */
  private static async updatePendingChangeSets(accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    let pendingChangeSets = BriefcaseManager.getPendingChangeSets(briefcase);
    if (pendingChangeSets.length === 0)
      return;

    pendingChangeSets = pendingChangeSets.slice(0, 100);

    const query = new ChangeSetQuery().filter(`$id+in+[${pendingChangeSets.map((value: string) => `'${value}'`).join(",")}]`).selectDownloadUrl();
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient!.ChangeSets().get(accessToken, briefcase.iModelId, query);

    await BriefcaseManager.downloadChangeSetsInternal(briefcase.iModelId, changeSets);

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    for (const token of changeSetTokens) {
      try {
        const codes = BriefcaseManager.extractCodesFromFile(briefcase, [token]);
        await BriefcaseManager.hubClient!.Codes().update(accessToken, briefcase.iModelId, codes, {deniedCodes: true, continueOnConflict: true});
        BriefcaseManager.removePendingChangeSet(briefcase, token.id);
      } catch (error) {
        if (error instanceof ConflictingCodesError) {
          briefcase.conflictError = error;
          BriefcaseManager.removePendingChangeSet(briefcase, token.id);
        }
      }
    }
  }

  /** Parse Code array from json */
  private static parseCodesFromJson(briefcase: BriefcaseEntry, json: string): Code[] {
    return JSON.parse(json, (key: any, value: any) => {
      if (key === "state") {
        return (value as number);
      }
      // If the key is a number, it's an array member.
      if (!Number.isNaN(Number.parseInt(key))) {
        const code = new Code();
        Object.assign(code, value);
        code.briefcaseId = briefcase.briefcaseId;
        return code;
      }
      return value;
    }) as Code[];
  }

  /** Extracts codes from current ChangeSet */
  private static extractCodes(briefcase: BriefcaseEntry): Code[] {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodes();
    if (res.error)
      throw new IModelError(res.error.status);
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Extracts codes from ChangeSet file */
  private static extractCodesFromFile(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[]): Code[] {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodesFromFile(JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status);
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Attempt to update codes without rejecting so pull wouldn't fail */
  private static async tryUpdatingCodes(accessToken: AccessToken, briefcase: BriefcaseEntry, changeSet: ChangeSet, relinquishCodesLocks: boolean): Promise<void> {
    // Add ChangeSet id, in case updating failed due to something else than conflicts
    BriefcaseManager.addPendingChangeSet(briefcase, changeSet.id!);

    let failedUpdating = false;
    try {
      await BriefcaseManager.hubClient!.Codes().update(accessToken, briefcase.iModelId, BriefcaseManager.extractCodes(briefcase), {deniedCodes: true, continueOnConflict: true});
    } catch (error) {
      if (error instanceof ConflictingCodesError) {
        const msg = `Found conflicting codes when pushing briefcase ${briefcase.iModelId}:${briefcase.briefcaseId} changes.`;
        Logger.logError(loggingCategory, msg);
        briefcase.conflictError = error;
      } else {
        failedUpdating = true;
      }
    }

    // Cannot retry relinquishing later, ignore error
    try {
      if (relinquishCodesLocks) {
        await BriefcaseManager.hubClient!.Codes().deleteAll(accessToken, briefcase.iModelId, briefcase.briefcaseId);
        await BriefcaseManager.hubClient!.Locks().deleteAll(accessToken, briefcase.iModelId, briefcase.briefcaseId);
      }
    } catch (error) {
      const msg = `Relinquishing codes or locks has failed with: ${error}`;
      Logger.logError(loggingCategory, msg);
    }

    // Remove ChangeSet id if it succeeded or failed with conflicts
    if (!failedUpdating)
      BriefcaseManager.removePendingChangeSet(briefcase, changeSet.id!);
  }

  /** Creates a change set file from the changes in a standalone iModel
   * @return Path to the standalone change set file
   * @hidden
   */
  public static createStandaloneChangeSet(briefcase: BriefcaseEntry): ChangeSetToken {
    if (!briefcase.isStandalone)
      throw new IModelError(BentleyStatus.ERROR);

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);
    BriefcaseManager.finishCreateChangeSet(briefcase);

    return changeSetToken;
  }

  /** Dumps a change set */
  public static dumpChangeSet(briefcase: BriefcaseEntry, changeSetToken: ChangeSetToken) {
    briefcase.nativeDb!.dumpChangeSet(JSON.stringify(changeSetToken));
  }

  /** Attempt to push a ChangeSet to iModel Hub */
  private static async pushChangeSet(accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
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

    let postedChangeSet: ChangeSet | undefined;
    try {
      postedChangeSet = await BriefcaseManager.hubClient!.ChangeSets().create(accessToken, briefcase.iModelId, changeSet, changeSetToken.pathname);
    } catch (error) {
      // If ChangeSet already exists, updating codes and locks might have timed out.
      if (!(error instanceof IModelHubResponseError) || error.id !== IModelHubResponseErrorId.ChangeSetAlreadyExists) {
        Promise.reject(error);
      }
    }

    await BriefcaseManager.tryUpdatingCodes(accessToken, briefcase, changeSet, relinquishCodesLocks);

    BriefcaseManager.finishCreateChangeSet(briefcase);
    briefcase.changeSetId = postedChangeSet!.wsgId;
    briefcase.changeSetIndex = +postedChangeSet!.index!;
  }

  /** Attempt to pull merge and push once */
  private static async pushChangesOnce(accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    await BriefcaseManager.pullAndMergeChanges(accessToken, briefcase, IModelVersion.latest());
    await BriefcaseManager.pushChangeSet(accessToken, briefcase, description, relinquishCodesLocks).catch((err) => {
      BriefcaseManager.abandonCreateChangeSet(briefcase);
      return Promise.reject(err);
    });
  }

  /** Return true if should attempt pushing again. */
  private static shouldRetryPush(error: any): boolean {
    if (error instanceof IModelHubResponseError && error.id) {
      switch (error.id!) {
        case IModelHubResponseErrorId.AnotherUserPushing:
        case IModelHubResponseErrorId.PullIsRequired:
        case IModelHubResponseErrorId.DatabaseTemporarilyLocked:
        case IModelHubResponseErrorId.iModelHubOperationFailed:
          return true;
      }
    }
    return false;
  }

  /** Push local changes to the hub
   * @param accessToken The access token of the account that has write access to the iModel. This may be a service account.
   * @param briefcase Identifies the IModelDb that contains the pending changes.
   * @param description a description of the changeset that is to be pushed.
   */
  public static async pushChanges(accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks?: boolean): Promise<void> {
    for (let i = 0; i < 5; ++i) {
      let pushed: boolean = false;
      let error: any;
      await BriefcaseManager.pushChangesOnce(accessToken, briefcase, description, relinquishCodesLocks || false).then(() => {
        pushed = true;
      }).catch((err) => {
        error = err;
      });
      if (pushed) {
        return Promise.resolve();
      }
      if (!BriefcaseManager.shouldRetryPush(error)) {
        return Promise.reject(error);
      }
      const delay: number = Math.floor(Math.random() * 4800) + 200;
      await new Promise((resolve: any) => setTimeout(resolve, delay));
    }
  }

  /** Create an iModel on the iModelHub */
  public static async create(accessToken: AccessToken, projectId: string, hubName: string, args: CreateIModelProps): Promise<BriefcaseEntry> {
    await BriefcaseManager.initCache(accessToken);
    assert(!!BriefcaseManager.hubClient);

    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    const scratchDir = BriefcaseManager.buildScratchPath();
    if (!IModelJsFs.existsSync(scratchDir))
      IModelJsFs.mkdirSync(scratchDir);

    const fileName = path.join(scratchDir, hubName + ".bim");
    if (IModelJsFs.existsSync(fileName))
      IModelJsFs.unlinkSync(fileName); // Note: Cannot create two files with the same name at the same time with multiple async calls.

    let res: DbResult = nativeDb.createIModel(fileName, JSON.stringify(args));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, fileName);

    res = nativeDb.saveChanges();
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res);

    nativeDb.closeIModel();

    const iModelId: string = await BriefcaseManager.upload(accessToken, projectId, fileName, hubName, args.rootSubject.description);
    return BriefcaseManager.open(accessToken, projectId, iModelId, OpenMode.ReadWrite, IModelVersion.latest());
  }

  /** Pushes a new iModel to the Hub */
  private static async upload(accessToken: AccessToken, projectId: string, pathname: string, hubName?: string, hubDescription?: string, timeOutInMilliseconds: number = 2 * 60 * 1000): Promise<string> {
    hubName = hubName || path.basename(pathname, ".bim");

    const iModel: HubIModel = await BriefcaseManager.hubClient!.IModels().create(accessToken, projectId, hubName, pathname, hubDescription, timeOutInMilliseconds);
    return iModel.wsgId;
  }

  /** @hidden */
  public static async deleteAllBriefcases(accessToken: AccessToken, iModelId: string) {
    if (BriefcaseManager.hubClient === undefined)
      return;
    const promises = new Array<Promise<void>>();
    const briefcases = await BriefcaseManager.hubClient.Briefcases().get(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(BriefcaseManager.hubClient!.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!));
    });
    return Promise.all(promises);
  }

}

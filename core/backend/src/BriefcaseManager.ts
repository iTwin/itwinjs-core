/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import {
  AccessToken, Briefcase as HubBriefcase, IModelHubClient, ConnectClient, ChangeSet,
  ChangesType, Briefcase, HubCode, IModelHubError,
  BriefcaseQuery, ChangeSetQuery, IModelQuery, ConflictingCodesError, IModelClient, HubIModel,
} from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank";
import { AzureFileHandler } from "@bentley/imodeljs-clients/lib/imodelhub/AzureFileHandler";
import { ChangeSetApplyOption, BeEvent, DbResult, OpenMode, assert, Logger, ChangeSetStatus, BentleyStatus, IModelHubStatus, PerfLogger, ActivityLoggingContext, Guid, Id64 } from "@bentley/bentleyjs-core";
import { BriefcaseStatus, IModelError, IModelVersion, IModelToken, CreateIModelProps } from "@bentley/imodeljs-common";
import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { NativeDgnDb, ErrorStatusOrResult } from "./imodeljs-native-platform-api";
import { IModelDb, OpenParams, SyncMode, AccessMode, ExclusiveAccessOption } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import * as path from "path";
import * as glob from "glob";

const loggingCategory = "imodeljs-backend.BriefcaseManager";

/** The Id assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels */
export class BriefcaseId {
  private _value: number;
  public static get Illegal(): number { return 0xffffffff; }
  public static get Master(): number { return 0; }
  public static get Standalone(): number { return 1; }
  constructor(value?: number) {
    if (value === undefined)
      this._value = BriefcaseId.Illegal;
    else this._value = value;
  }
  public get isValid(): boolean { return this._value !== BriefcaseId.Illegal; }
  public get isMaster(): boolean { return this._value !== BriefcaseId.Master; }
  public get isStandaloneId(): boolean { return this._value !== BriefcaseId.Standalone; }
  public getValue(): number { return this._value; }
  public toString(): string { return this._value.toString(); }
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  No = 0,
  Yes = 1,
}

/** A token that represents a ChangeSet */
export class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public containsSchemaChanges: boolean) { }
}

/** Entry in the briefcase cache */
export class BriefcaseEntry {

  /** Id of the iModel - set to the DbGuid field in the BIM, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId!: string;

  /** Absolute path where the briefcase is cached/stored */
  public pathname!: string;

  /** Id of the last change set that was applied to the BIM.
   * Set to an empty string if it is the initial version, or a standalone briefcase
   */
  public changeSetId!: string;

  /** Index of the last change set that was applied to the BI.
   * Only specified if the briefcase was acquired from the Hub.
   * Set to 0 if it is the initial version.
   */
  public changeSetIndex?: number;

  /** Briefcase Id  */
  public briefcaseId!: number;

  /** Flag indicating if the briefcase is a standalone iModel that only exists locally on disk, or is from iModelHub */
  public isStandalone!: boolean;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen!: boolean;

  /** In-memory handle of the native Db */
  public nativeDb!: NativeDgnDb;

  /** Params used to open the briefcase */
  public openParams?: OpenParams;

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

  /** Id of the user that acquired the briefcase. This is not set if it is a standalone briefcase */
  public userId?: string;

  /** In-memory handle fo the IModelDb that corresponds with this briefcase. This is only set if an IModelDb wrapper has been created for this briefcase */
  public iModelDb?: IModelDb;

  /** File Id used to upload change sets for this briefcase (only setup in Read-Write cases) */
  public fileId?: string;

  /** Error set if push has succeeded, but updating codes has failed with conflicts */
  public conflictError?: ConflictingCodesError;

  /** Identifies the IModelClient to use when accessing this briefcase. If not defined, this may be a standalone briefcase, or it may be
   * a briefcase downloaded from iModelHub. Only iModelBank briefcases use custom contexts.
   */
  public imodelClientContext?: string;

  /** @hidden Event called after a changeset is applied to a briefcase. */
  public readonly onChangesetApplied = new BeEvent<() => void>();

  /** @hidden Event called when the briefcase is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** @hidden Event called when the version of the briefcase has been updated */
  public readonly onBeforeVersionUpdate = new BeEvent<() => void>();

  /** Gets the path key to be used in the cache and iModelToken */
  public getKey(): string {
    if (this.isStandalone)
      return this.pathname;

    // Standalone (FixedVersion, PullOnly)
    if (this.briefcaseId === BriefcaseId.Standalone) {
      const uniqueId = path.basename(path.dirname(this.pathname)).substr(1);
      return `${this.iModelId}:${this.changeSetId}:${uniqueId}`;
    }

    // Acquired (PullPush)
    return `${this.iModelId}:${this.briefcaseId}`;
  }
}

/** In-memory cache of briefcases */
class BriefcaseCache {
  private readonly _briefcases = new Map<string, BriefcaseEntry>();

  /** Find a briefcase in the cache by token */
  public findBriefcaseByToken({ key }: IModelToken): BriefcaseEntry | undefined {
    assert(!!key);
    return this.findBriefcaseByKey(key!);
  }

  /** Find a briefcase in the cache by key */
  public findBriefcaseByKey(key: string): BriefcaseEntry | undefined {
    return this._briefcases.get(key);
  }

  /** Find a briefcase in the cache */
  public findBriefcase(briefcase: BriefcaseEntry): BriefcaseEntry | undefined {
    return this._briefcases.get(briefcase.getKey());
  }

  /** Add a briefcase to the cache */
  public addBriefcase(briefcase: BriefcaseEntry) {
    const key = briefcase.getKey();

    if (this._briefcases.get(key)) {
      const msg = `Briefcase ${key} already exists in the cache.`;
      Logger.logError(loggingCategory, msg);
      throw new IModelError(DbResult.BE_SQLITE_ERROR, msg);
    }

    Logger.logTrace(loggingCategory, `Added briefcase ${key} (${briefcase.pathname}) to the cache`);
    this._briefcases.set(key, briefcase);
  }

  /** Delete a briefcase from the cache */
  public deleteBriefcase(briefcase: BriefcaseEntry) {
    this.deleteBriefcaseByKey(briefcase.getKey());
  }

  /** Delete a briefcase from the cache by key */
  public deleteBriefcaseByKey(key: string) {
    const briefcase = this._briefcases.get(key);
    if (!briefcase) {
      const msg = `Briefcase ${key} not found in cache`;
      Logger.logError(loggingCategory, msg);
      throw new IModelError(DbResult.BE_SQLITE_ERROR, msg);
    }

    Logger.logTrace(loggingCategory, `Removed briefcase ${key} (${briefcase.pathname}) from the cache`);
    this._briefcases.delete(key);
  }

  /** Get a subset of entries in the cache */
  public getFilteredBriefcases(filterFn: (value: BriefcaseEntry) => boolean): BriefcaseEntry[] {
    const filteredBriefcases = new Array<BriefcaseEntry>();
    this._briefcases.forEach((value: BriefcaseEntry) => {
      if (filterFn(value))
        filteredBriefcases.push(value);
    });
    return filteredBriefcases;
  }

  /** Checks if the cache is empty */
  public get isEmpty(): boolean { return this._briefcases.size === 0; }

  /** Clears all entries in the cache */
  public clear() { this._briefcases.clear(); }
}

/** Utility to manage briefcases */
export class BriefcaseManager {
  private static _cache: BriefcaseCache = new BriefcaseCache();
  private static _isCacheInitialized?: boolean;
  private static _imodelClient?: IModelClient;

  /** IModel Server Client to be used for all briefcase operations */
  public static get imodelClient(): IModelClient {
    if (!this._imodelClient) {
      // The server handler defaults to iModelHub handler and the file handler defaults to AzureFileHandler
      this._imodelClient = new IModelHubClient(IModelHost.configuration ? IModelHost.configuration.hubDeploymentEnv : "PROD", new AzureFileHandler(false));
    }
    return this._imodelClient;
  }

  public static set imodelClient(cli: IModelClient) {
    this._imodelClient = cli;
  }

  private static _connectClient?: ConnectClient;

  /** Connect client to be used for all briefcase operations */
  public static get connectClient(): ConnectClient {
    if (!BriefcaseManager._connectClient) {
      if (!IModelHost.configuration)
        throw new Error("IModelHost.startup() should be called before any backend operations");
      BriefcaseManager._connectClient = new ConnectClient(IModelHost.configuration.hubDeploymentEnv);
    }
    return BriefcaseManager._connectClient;
  }

  /** Get the local path of the root folder storing the imodel seed file, change sets and briefcases */
  private static getIModelPath(iModelId: string): string {
    const pathname = path.join(BriefcaseManager.cacheDir, iModelId, "/");
    return path.normalize(pathname);
  }

  public static getChangeSetsPath(iModelId: string): string { return path.join(BriefcaseManager.getIModelPath(iModelId), "csets"); }
  public static getChangeCachePathName(iModelId: string): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }

  private static getBriefcasesPath(iModelId: string) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc");
  }

  private static buildStandalonePathname(iModelId: string, iModelName: string): string {
    const briefcases = BriefcaseManager._cache.getFilteredBriefcases((entry: BriefcaseEntry) => {
      return entry.iModelId === iModelId && entry.briefcaseId === BriefcaseId.Standalone;
    });

    const pathBaseName: string = BriefcaseManager.getBriefcasesPath(iModelId);

    let pathname: string | undefined;
    for (let ii = briefcases.length; !pathname || IModelJsFs.existsSync(pathname); ii++) {
      pathname = path.join(pathBaseName, `_${ii.toString()}`, iModelName.concat(".bim"));
    }
    return pathname;
  }

  private static buildAcquiredPathname(iModelId: string, briefcaseId: number, iModelName: string): string {
    const pathBaseName: string = BriefcaseManager.getBriefcasesPath(iModelId);

    return path.join(pathBaseName, briefcaseId.toString(), iModelName.concat(".bim"));
  }

  private static buildScratchPath(): string { return path.join(BriefcaseManager.cacheDir, "scratch"); }

  /** Clear the briefcase manager cache */
  private static clearCache() {
    BriefcaseManager._cache.clear();
    BriefcaseManager._isCacheInitialized = undefined;
  }

  private static onIModelHostShutdown() {
    BriefcaseManager.clearCache();
    BriefcaseManager._imodelClient = undefined;
    BriefcaseManager._connectClient = undefined;
    BriefcaseManager._cacheDir = undefined;
    IModelHost.onBeforeShutdown.removeListener(BriefcaseManager.onIModelHostShutdown);
  }

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    const parentPath = path.dirname(dirPath);
    if (parentPath !== dirPath)
      BriefcaseManager.makeDirectoryRecursive(parentPath);
    IModelJsFs.mkdirSync(dirPath);
  }

  /** Get information on a briefcase on disk by opening it, and querying the IModelServer */
  private static async addBriefcaseToCache(actx: ActivityLoggingContext, accessToken: AccessToken, briefcaseDir: string, iModelId: string) {
    actx.enter();
    const fileNames = IModelJsFs.readdirSync(briefcaseDir);
    if (fileNames.length !== 1)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Briefcase directory ${briefcaseDir} must contain exactly one briefcase`);
    const pathname = path.join(briefcaseDir, fileNames[0]);

    // Open the briefcase (for now as ReadWrite to allow reinstating reversed briefcases)
    const briefcase = BriefcaseManager.openBriefcase(iModelId, pathname, new OpenParams(OpenMode.ReadWrite));

    try {
      // Append information from the IModelServer
      briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(actx, accessToken, briefcase.iModelId, briefcase.changeSetId);
      actx.enter();
      if (briefcase.reversedChangeSetId)
        briefcase.reversedChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(actx, accessToken, briefcase.iModelId, briefcase.reversedChangeSetId);
      actx.enter();
      if (briefcase.briefcaseId !== BriefcaseId.Standalone) {
        const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.Briefcases().get(actx, accessToken, new Guid(iModelId), new BriefcaseQuery().byId(briefcase.briefcaseId));
        if (hubBriefcases.length === 0)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unable to find briefcase ${briefcase.briefcaseId}:${briefcase.pathname} on the Hub (for the current user)`);
        briefcase.userId = hubBriefcases[0].userId;
        briefcase.fileId = hubBriefcases[0].fileId!.toString();
      }

      // Reinstate any reversed changes - these can happen with exclusive briefcases
      // Note: We currently allow reversal only in Exclusive briefcases. Ideally we should just keep these briefcases reversed in case they
      // are exclusive, but at the moment we don't have a way of differentiating exclusive and shared briefcases when opening them the
      // first time. We could consider caching that information also. see findCachedBriefcaseToOpen()
      if (briefcase.reversedChangeSetId) {
        await BriefcaseManager.reinstateChanges(actx, accessToken, briefcase);
        assert(!briefcase.reversedChangeSetId && !briefcase.nativeDb.getReversedChangeSetId(), "Error with reinstating reversed changes");
      }
    } catch (error) {
      throw error;
    } finally {
      actx.enter();
      if (briefcase && briefcase.isOpen)
        BriefcaseManager.closeBriefcase(briefcase);
    }

    BriefcaseManager._cache.addBriefcase(briefcase);
  }

  /** Get basic information on all briefcases on disk under the specified path */
  private static async initCacheForIModel(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string) {
    actx.enter();
    const basePath = BriefcaseManager.getBriefcasesPath(iModelId);
    if (!IModelJsFs.existsSync(basePath))
      return;
    const subDirs = IModelJsFs.readdirSync(basePath);
    if (subDirs.length === 0)
      return;

    for (const subDirName of subDirs) {
      const briefcaseDir = path.join(basePath, subDirName);
      try {
        await BriefcaseManager.addBriefcaseToCache(actx, accessToken, briefcaseDir, iModelId);
        actx.enter();
      } catch (error) {
        Logger.logWarning(loggingCategory, `Deleting briefcase in ${briefcaseDir} from cache`);
        BriefcaseManager.deleteFolderRecursive(briefcaseDir);
      }
    }
  }

  private static readonly _cacheMajorVersion: number = 1;
  private static readonly _cacheMinorVersion: number = 0;

  private static buildCacheSubDir(): string {
    return `v${BriefcaseManager._cacheMajorVersion}_${BriefcaseManager._cacheMinorVersion}`;
  }

  private static findCacheSubDir(): string | undefined {
    if (!IModelHost.configuration || !IModelHost.configuration.briefcaseCacheDir) {
      assert(false, "Cache directory undefined");
      return undefined;
    }
    const cacheDir = IModelHost.configuration.briefcaseCacheDir;
    let dirs: string[] | undefined;
    try {
      dirs = glob.sync(`v${BriefcaseManager._cacheMajorVersion}_*`, { cwd: cacheDir });
      assert(dirs.length === 1, "Expected *only* a single directory for a major version");
    } catch (error) {
    }
    if (!dirs || dirs.length === 0)
      return undefined;
    return dirs[0];
  }

  private static _cacheDir?: string;
  public static get cacheDir(): string {
    if (!BriefcaseManager._cacheDir)
      BriefcaseManager.setupCacheDir();
    return BriefcaseManager._cacheDir!;
  }

  private static setupCacheDir() {
    const cacheSubDirOnDisk = BriefcaseManager.findCacheSubDir();
    const cacheSubDir = BriefcaseManager.buildCacheSubDir();
    const cacheDir = path.join(IModelHost.configuration!.briefcaseCacheDir, cacheSubDir);

    if (!cacheSubDirOnDisk) {
      // For now, just recreate the entire cache if the directory for the major version is not found - NEEDS_WORK
      BriefcaseManager.deleteFolderRecursive(IModelHost.configuration!.briefcaseCacheDir!);
    } else if (cacheSubDirOnDisk !== cacheSubDir) {
      const cacheDirOnDisk = path.join(IModelHost.configuration!.briefcaseCacheDir!, cacheSubDirOnDisk);
      BriefcaseManager.deleteFolderRecursive(cacheDirOnDisk);
    }

    if (!IModelJsFs.existsSync(cacheDir))
      BriefcaseManager.makeDirectoryRecursive(cacheDir);

    BriefcaseManager._cacheDir = cacheDir;
  }

  /** Initialize the briefcase manager cache of in-memory briefcases (if necessary).
   * Note: Callers should use memoizedInitCache() instead
   */
  private static async initCache(actx: ActivityLoggingContext, accessToken?: AccessToken): Promise<void> {
    actx.enter();
    if (BriefcaseManager._isCacheInitialized)
      return;

    if (!IModelHost.configuration)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "IModelHost.startup() should be called before any backend operations");

    IModelHost.onBeforeShutdown.addListener(BriefcaseManager.onIModelHostShutdown);
    if (!accessToken)
      return;

    const perfLogger = new PerfLogger("BriefcaseManager.initCache");
    for (const iModelId of IModelJsFs.readdirSync(BriefcaseManager.cacheDir)) {
      await BriefcaseManager.initCacheForIModel(actx, accessToken, iModelId);
    }
    perfLogger.dispose();

    BriefcaseManager._isCacheInitialized = true;
  }

  private static _memoizedInitCache?: Promise<void>;
  /** Memoized initCache - avoids race condition caused by two async calls to briefcase manager */
  private static async memoizedInitCache(actx: ActivityLoggingContext, accessToken?: AccessToken) {
    // NEEDS_WORK: initCache() is to be made synchronous and independent of the accessToken passed in.
    if (!BriefcaseManager._memoizedInitCache)
      BriefcaseManager._memoizedInitCache = BriefcaseManager.initCache(actx, accessToken);
    try {
      await BriefcaseManager._memoizedInitCache;
    } finally {
      BriefcaseManager._memoizedInitCache = undefined;
    }
  }

  /** Get the index of the change set from its id */
  private static async getChangeSetIndexFromId(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<number> {
    actx.enter();
    if (changeSetId === "")
      return 0; // the first version
    try {
      const changeSet: ChangeSet = (await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, new Guid(iModelId), new ChangeSetQuery().byId(changeSetId)))[0];
      return +changeSet.index!;
    } catch (err) {
      assert(false, "Could not determine index of change set");
      return -1;
    }
  }

  /** Open a briefcase */
  public static async open(actx: ActivityLoggingContext, accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): Promise<BriefcaseEntry> {
    await BriefcaseManager.memoizedInitCache(actx, accessToken);

    actx.enter();

    assert(!!BriefcaseManager.imodelClient);

    let perfLogger = new PerfLogger("IModelDb.open, evaluating change set");
    const changeSetId: string = await version.evaluateChangeSet(actx, accessToken, iModelId, BriefcaseManager.imodelClient);
    actx.enter();
    let changeSetIndex: number;
    if (changeSetId === "") {
      changeSetIndex = 0; // First version
    } else {
      const changeSet: ChangeSet = await BriefcaseManager.getChangeSetFromId(actx, accessToken, iModelId, changeSetId);
      actx.enter();
      changeSetIndex = changeSet ? +changeSet.index! : 0;
    }
    perfLogger.dispose();

    perfLogger = new PerfLogger("IModelDb.open, find cached briefcase");
    let briefcase = BriefcaseManager.findCachedBriefcaseToOpen(accessToken, iModelId, changeSetIndex, openParams);
    if (briefcase && briefcase.isOpen && briefcase.changeSetIndex === changeSetIndex) {
      Logger.logTrace(loggingCategory, `Reused briefcase ${briefcase.pathname} without changes`);
      return briefcase;
    }

    perfLogger.dispose();

    perfLogger = new PerfLogger("IModelDb.open, preparing briefcase");
    let isNewBriefcase: boolean = false;
    const tempOpenParams = new OpenParams(OpenMode.ReadWrite, openParams.accessMode, openParams.syncMode, openParams.exclusiveAccessOption); // Merge needs the Db to be opened ReadWrite
    if (briefcase) {
      Logger.logTrace(loggingCategory, `Reused briefcase ${briefcase.pathname} after upgrades (if necessary)`);
      BriefcaseManager.reopenBriefcase(accessToken, briefcase, tempOpenParams);
    } else {
      briefcase = await BriefcaseManager.createBriefcase(actx, accessToken, contextId, iModelId, tempOpenParams); // Merge needs the Db to be opened ReadWrite
      actx.enter();
      isNewBriefcase = true;
    }

    let changeSetApplyOption: ChangeSetApplyOption | undefined;
    if (changeSetIndex > briefcase.changeSetIndex!) {
      changeSetApplyOption = ChangeSetApplyOption.Merge;
    } else if (changeSetIndex < briefcase.changeSetIndex!) {
      if (openParams.syncMode === SyncMode.PullAndPush) {
        Logger.logWarning(loggingCategory, `No support to open an older version when opening an IModel to push changes (SyncMode.PullAndPush). Cannot open briefcase ${briefcase.iModelId}:${briefcase.briefcaseId}.`);
        await BriefcaseManager.deleteBriefcase(actx, accessToken, briefcase);
        actx.enter();
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot merge when there are reversed changes"));
      }
      changeSetApplyOption = ChangeSetApplyOption.Reverse;
    }

    if (changeSetApplyOption) {
      assert(briefcase.isOpen && briefcase.openParams!.openMode === OpenMode.ReadWrite); // Briefcase must be opened ReadWrite first to allow applying change sets
      try {
        await BriefcaseManager.applyChangeSets(actx, accessToken, briefcase, IModelVersion.asOfChangeSet(changeSetId), changeSetApplyOption);
        actx.enter();
      } catch (error) {
        actx.enter();
        Logger.logWarning(loggingCategory, `Error applying changes to briefcase  ${briefcase.iModelId}:${briefcase.briefcaseId}. Deleting it so that it can be re-fetched again.`);
        await BriefcaseManager.deleteBriefcase(actx, accessToken, briefcase);
        return Promise.reject(error);
      }
    }

    // Reopen the briefcase if the briefcase hasn't been opened with the required OpenMode
    if (briefcase.openParams!.openMode !== openParams.openMode)
      BriefcaseManager.reopenBriefcase(accessToken, briefcase, openParams);

    perfLogger.dispose();

    // Add briefcase to cache if necessary
    if (isNewBriefcase) {
      // Note: This cannot be done right after creation since the version (that's part of the key to the cache)
      // is not established until the change sets are merged
      BriefcaseManager._cache.addBriefcase(briefcase);
    }

    return briefcase;
  }

  /** Close a briefcase */
  public static async close(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void> {
    actx.enter();
    assert(!briefcase.isStandalone, "Cannot use IModelDb.close() to close a standalone iModel. Use IModelDb.closeStandalone() instead");
    briefcase.onBeforeClose.raiseEvent(briefcase);
    BriefcaseManager.closeBriefcase(briefcase);
    if (keepBriefcase === KeepBriefcase.No) {
      await BriefcaseManager.deleteBriefcase(actx, accessToken, briefcase);
    }
  }

  /** Get the change set from the specified id */
  private static async getChangeSetFromId(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    actx.enter();
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, new Guid(iModelId), new ChangeSetQuery().byId(changeSetId));
    if (changeSets.length > 0)
      return changeSets[0];

    actx.enter();
    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound, changeSetId));
  }

  /** Finds any existing briefcase for the specified parameters. Pass null for the requiredChangeSet if the first version is to be retrieved */
  private static findCachedBriefcaseToOpen(accessToken: AccessToken, iModelId: string, requiredChangeSetIndex: number, requiredOpenParams: OpenParams): BriefcaseEntry | undefined {
    const requiredUserId = accessToken.getUserProfile()!.userId;

    // Narrow down briefcases by various criteria (except their versions)
    const filterBriefcaseFn = (entry: BriefcaseEntry): boolean => {
      // Narrow down to entries for the specified iModel
      if (entry.iModelId !== iModelId)
        return false;

      // Narrow down open briefcases
      if (entry.isOpen) {
        // If exclusive access is required, do not reuse if the user preference indicates so, or if the briefcase wasn't previously created by the same user
        if (requiredOpenParams.accessMode === AccessMode.Exclusive && (requiredOpenParams.exclusiveAccessOption !== ExclusiveAccessOption.TryReuseOpenBriefcase || requiredUserId !== entry.userId))
          return false;

        // Any open briefcase must have been opened with the exact same open parameters
        if (!entry.openParams!.equals(requiredOpenParams))
          return false;

        if (entry.openParams!.exclusiveAccessOption === ExclusiveAccessOption.CreateNewBriefcase)
          return false;
      }

      // For PullOnly or FixedVersion briefcases, ensure that the briefcase is opened Standalone, and does NOT have any reversed changes
      // Note: We currently allow reversal only in Exclusive briefcases. Also, we reinstate any reversed changes in all briefcases when the
      // cache is initialized, but that may be removed in the future. See addBriefcaseToCache()
      if (requiredOpenParams.syncMode !== SyncMode.PullAndPush)
        return entry.briefcaseId === BriefcaseId.Standalone && !entry.reversedChangeSetId;

      // For PullAndPush briefcases, ensure that the user had acquired the briefcase the first time around
      // else if (requiredOpenParams.syncMode === SyncMode.PullAndPush)
      return entry.briefcaseId !== BriefcaseId.Standalone && entry.userId === requiredUserId;
    };

    const briefcases = this._cache.getFilteredBriefcases(filterBriefcaseFn);
    if (!briefcases || briefcases.length === 0)
      return undefined;

    let briefcase: BriefcaseEntry | undefined;

    // first prefer open briefcases, with a changeSetIndex that can be upgraded in case Exclusive access is required, or with the same exact changeSetIndex if Shared access is required
    briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
      if (!entry.isOpen)
        return false;

      return (requiredOpenParams.accessMode === AccessMode.Exclusive) ?
        entry.changeSetIndex! <= requiredChangeSetIndex :
        entry.changeSetIndex === requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    // next prefer a briefcase that's closed, and with changeSetIndex = requiredChangeSetIndex
    briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
      return !entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    // next prefer any standalone briefcase that's closed, and with changeSetIndex < requiredChangeSetIndex
    briefcase = briefcases.find((entry: BriefcaseEntry): boolean => {
      return !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    return undefined;
  }

  private static setupBriefcase(briefcase: BriefcaseEntry, openParams: OpenParams): DbResult {
    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    assert(openParams.openMode === OpenMode.ReadWrite); // Expect to setup briefcase as ReadWrite to allow pull and merge of changes (irrespective of the real openMode)

    let res: DbResult = nativeDb.openIModel(briefcase.pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res) {
      Logger.logError(loggingCategory, `Unable to open briefcase at ${briefcase.pathname}`);
      return res;
    }

    res = nativeDb.setBriefcaseId(briefcase.briefcaseId);
    if (DbResult.BE_SQLITE_OK !== res) {
      Logger.logError(loggingCategory, `Unable to setup briefcase id for ${briefcase.pathname}`);
      return res;
    }
    assert(nativeDb.getParentChangeSetId() === briefcase.changeSetId);

    briefcase.nativeDb = nativeDb;
    briefcase.openParams = openParams;
    briefcase.isOpen = true;
    briefcase.isStandalone = false;

    Logger.logTrace(loggingCategory, `Created briefcase ${briefcase.pathname}`);
    return DbResult.BE_SQLITE_OK;
  }

  /** Create a briefcase */
  private static async createBriefcase(actx: ActivityLoggingContext, accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams): Promise<BriefcaseEntry> {
    actx.enter();

    const iModel: HubIModel = (await BriefcaseManager.imodelClient.IModels().get(actx, accessToken, contextId, new IModelQuery().byId(new Guid(iModelId))))[0];

    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = iModelId;
    briefcase.userId = accessToken.getUserProfile()!.userId;

    if (openParams.syncMode !== SyncMode.PullAndPush) {
      /* FixedVersion, PullOnly => Create standalone briefcase */
      briefcase.pathname = BriefcaseManager.buildStandalonePathname(iModelId, iModel.name!);
      briefcase.briefcaseId = BriefcaseId.Standalone;
      await BriefcaseManager.downloadSeedFile(actx, accessToken, iModelId, briefcase.pathname);
      actx.enter();
      briefcase.changeSetId = "";
      briefcase.changeSetIndex = 0;
    } else {
      /* PullAndPush => Acquire a briefcase from the hub */
      const hubBriefcase: HubBriefcase = await BriefcaseManager.acquireBriefcase(actx, accessToken, iModelId);
      briefcase.pathname = BriefcaseManager.buildAcquiredPathname(iModelId, +hubBriefcase.briefcaseId!, iModel.name!);
      briefcase.briefcaseId = hubBriefcase.briefcaseId!;
      briefcase.fileId = hubBriefcase.fileId!.toString();
      await BriefcaseManager.downloadBriefcase(actx, hubBriefcase, briefcase.pathname);
      briefcase.changeSetId = hubBriefcase.mergedChangeSetId!;
      briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(actx, accessToken, iModelId, briefcase.changeSetId);
    }

    const res: DbResult = BriefcaseManager.setupBriefcase(briefcase, openParams);
    if (DbResult.BE_SQLITE_OK !== res) {
      Logger.logWarning(loggingCategory, `Unable to create briefcase ${briefcase.pathname}. Deleting any remnants of it`);
      await BriefcaseManager.deleteBriefcase(actx, accessToken, briefcase);
      actx.enter();
      throw new IModelError(res, briefcase.pathname);
    }

    briefcase.imodelClientContext = contextId;

    return briefcase;
  }

  /** Acquire a briefcase */
  private static async acquireBriefcase(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string): Promise<HubBriefcase> {
    actx.enter();
    const briefcase: HubBriefcase = await BriefcaseManager.imodelClient.Briefcases().create(actx, accessToken, new Guid(iModelId));
    actx.enter();
    if (!briefcase) {
      Logger.logError(loggingCategory, "Could not acquire briefcase"); // Could well be that the current user does not have the appropriate access
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire));
    }
    return briefcase;
  }

  /** Downloads the briefcase file */
  private static async downloadBriefcase(actx: ActivityLoggingContext, briefcase: Briefcase, seedPathname: string): Promise<void> {
    actx.enter();
    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.imodelClient.Briefcases().download(actx, briefcase, seedPathname)
      .catch(() => {
        actx.enter();
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
  }

  /** Downloads the briefcase seed file */
  private static async downloadSeedFile(actx: ActivityLoggingContext, accessToken: AccessToken, imodelId: string, seedPathname: string): Promise<void> {
    actx.enter();
    if (IModelJsFs.existsSync(seedPathname))
      return;

    const perfLogger = new PerfLogger("BriefcaseManager.downloadSeedFile");
    await BriefcaseManager.imodelClient.IModels().download(actx, accessToken, new Guid(imodelId), seedPathname)
      .catch(() => {
        actx.enter();
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
    perfLogger.dispose();
  }

  /** Deletes a briefcase from the local disk (if it exists) */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseEntry) {
    const dirName = path.dirname(briefcase.pathname);
    BriefcaseManager.deleteFolderRecursive(dirName);
  }

  /** Deletes a briefcase from the IModelServer (if it exists) */
  private static async deleteBriefcaseFromServer(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    assert(!!briefcase.iModelId);
    if (briefcase.briefcaseId === BriefcaseId.Standalone)
      return;

    actx.enter();

    try {
      await BriefcaseManager.imodelClient.Briefcases().get(actx, accessToken, new Guid(briefcase.iModelId), new BriefcaseQuery().byId(briefcase.briefcaseId));
    } catch (err) {
      return; // Briefcase does not exist on the hub, or cannot be accessed
    }
    actx.enter();

    await BriefcaseManager.imodelClient.Briefcases().delete(actx, accessToken, new Guid(briefcase.iModelId), briefcase.briefcaseId)
      .catch(() => {
        actx.enter();
        Logger.logError(loggingCategory, "Could not delete the acquired briefcase"); // Could well be that the current user does not have the appropriate access
      });
  }

  /** Deletes a briefcase from the cache (if it exists) */
  private static deleteBriefcaseFromCache(briefcase: BriefcaseEntry) {
    if (!BriefcaseManager._cache.findBriefcase(briefcase))
      return;

    BriefcaseManager._cache.deleteBriefcase(briefcase);
  }

  /** Deletes a briefcase, and releases its references in iModelHub if necessary */
  private static async deleteBriefcase(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    actx.enter();
    BriefcaseManager.deleteBriefcaseFromCache(briefcase);
    await BriefcaseManager.deleteBriefcaseFromServer(actx, accessToken, briefcase);
    actx.enter();
    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
  }

  /** Get change sets in the specified range
   *  * Gets change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array
   */
  private static async getChangeSets(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string, includeDownloadLink: boolean, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    actx.enter();
    if (toChangeSetId === "" /* first version */ || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>();

    const query = new ChangeSetQuery();
    if (fromChangeSetId)
      query.fromId(fromChangeSetId);
    if (includeDownloadLink)
      query.selectDownloadUrl();
    const allChangeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, new Guid(iModelId), query);
    actx.enter();

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  private static async downloadChangeSetsInternal(actx: ActivityLoggingContext, iModelId: string, changeSets: ChangeSet[]) {
    actx.enter();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);

    const changeSetsToDownload = new Array<ChangeSet>();
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      if (!IModelJsFs.existsSync(changeSetPathname))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      const perfLogger = new PerfLogger("BriefcaseManager.downloadChangeSets");
      await BriefcaseManager.imodelClient.ChangeSets().download(actx, changeSetsToDownload, changeSetsPath)
        .catch(() => {
          actx.enter();
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
        });
      perfLogger.dispose();
    }
  }

  /** Downloads change sets in the specified range.
   *  * Downloads change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array.
   */
  public static async downloadChangeSets(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    const changeSets = await BriefcaseManager.getChangeSets(actx, accessToken, iModelId, true /*includeDownloadLink*/, fromChangeSetId, toChangeSetId);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await BriefcaseManager.downloadChangeSetsInternal(actx, iModelId, changeSets);

    return changeSets;
  }

  /** Open a standalone iModel from the local disk */
  public static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseEntry {
    if (BriefcaseManager._cache.findBriefcaseByToken(new IModelToken(pathname, undefined, undefined, undefined, openMode)))
      throw new IModelError(DbResult.BE_SQLITE_CANTOPEN, `Cannot open ${pathname} again - it has already been opened once`);

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
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.pathname = pathname;
    briefcase.changeSetId = nativeDb.getParentChangeSetId();
    briefcase.briefcaseId = briefcaseId;
    briefcase.isOpen = true;
    briefcase.openParams = OpenParams.standalone(openMode);
    briefcase.isStandalone = true;
    briefcase.nativeDb = nativeDb;

    BriefcaseManager._cache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Create a standalone iModel from the local disk */
  public static createStandalone(fileName: string, args: CreateIModelProps): BriefcaseEntry {
    if (BriefcaseManager._cache.findBriefcaseByToken(new IModelToken(fileName, undefined, undefined, undefined, OpenMode.ReadWrite)))
      throw new IModelError(DbResult.BE_SQLITE_ERROR_FileExists, `Cannot create file ${fileName} again - it already exists`);

    const nativeDb: NativeDgnDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    const res: DbResult = nativeDb.createIModel(fileName, JSON.stringify(args));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, fileName);

    nativeDb.setBriefcaseId(BriefcaseId.Standalone);

    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.pathname = fileName;
    briefcase.changeSetId = "";
    briefcase.briefcaseId = BriefcaseId.Standalone;
    briefcase.isOpen = true;
    briefcase.openParams = OpenParams.standalone(OpenMode.ReadWrite);
    briefcase.isStandalone = true;
    briefcase.nativeDb = nativeDb;

    BriefcaseManager._cache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Close the standalone briefcase */
  public static closeStandalone(briefcase: BriefcaseEntry) {
    assert(briefcase.isStandalone, "Cannot use IModelDb.closeStandalone() to close a non-standalone iModel. Use IModelDb.close() instead");
    briefcase.onBeforeClose.raiseEvent(briefcase);
    BriefcaseManager.closeBriefcase(briefcase);
    if (BriefcaseManager._cache.findBriefcase(briefcase))
      BriefcaseManager._cache.deleteBriefcase(briefcase);
  }

  /** Delete closed briefcases */
  public static async deleteClosed(actx: ActivityLoggingContext, accessToken: AccessToken) {
    await BriefcaseManager.memoizedInitCache(actx, accessToken);

    const briefcases = BriefcaseManager._cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => !briefcase.isOpen);
    for (const briefcase of briefcases) {
      await BriefcaseManager.deleteBriefcase(actx, accessToken, briefcase);
    }
  }

  private static deleteFolderRecursive(folderPath: string) {
    if (!IModelJsFs.existsSync(folderPath))
      return;

    try {
      const files = IModelJsFs.readdirSync(folderPath);
      for (const file of files) {
        const curPath = path.join(folderPath, file);
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          BriefcaseManager.deleteFolderRecursive(curPath);
        } else {
          try {
            IModelJsFs.unlinkSync(curPath);
          } catch (error) {
            Logger.logError(loggingCategory, `Cannot delete file ${curPath}`);
            throw error;
          }
        }
      }
      try {
        IModelJsFs.rmdirSync(folderPath);
      } catch (error) {
        Logger.logError(loggingCategory, `Cannot delete folder: ${folderPath}`);
        throw error;
      }
    } catch (error) {
    }
  }

  /** Purges the cache of briefcases - closes any open briefcases,
   *  releases any briefcases acquired from the hub, and deletes the cache
   *  directory.
   */
  public static async purgeCache(actx: ActivityLoggingContext, accessToken: AccessToken) {
    await BriefcaseManager.memoizedInitCache(actx, accessToken);
    actx.enter();

    const briefcases = BriefcaseManager._cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => briefcase.isOpen);
    for (const briefcase of briefcases) {
      await briefcase.iModelDb!.close(actx, accessToken, KeepBriefcase.Yes);
    }

    await this.deleteClosed(actx, accessToken);
    actx.enter();
    BriefcaseManager.clearCache();
  }

  /** Find the existing briefcase */
  public static findBriefcaseByToken(iModelToken: IModelToken): BriefcaseEntry | undefined {
    return BriefcaseManager._cache.findBriefcaseByToken(iModelToken);
  }

  private static buildChangeSetTokens(changeSets: ChangeSet[], changeSetsPath: string): ChangeSetToken[] {
    const changeSetTokens = new Array<ChangeSetToken>();
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      changeSetTokens.push(new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType === ChangesType.Schema));
    });
    return changeSetTokens;
  }

  private static openBriefcase(iModelId: string, pathname: string, openParams: OpenParams): BriefcaseEntry {
    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = iModelId;
    briefcase.pathname = pathname;

    briefcase.nativeDb = new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();
    const res: DbResult = briefcase.nativeDb.openIModel(briefcase.pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unable to open briefcase at ${briefcase.pathname}`);

    briefcase.isOpen = true;
    briefcase.openParams = openParams;
    briefcase.isStandalone = false;
    briefcase.briefcaseId = briefcase.nativeDb.getBriefcaseId();
    briefcase.changeSetId = briefcase.nativeDb.getParentChangeSetId();
    briefcase.reversedChangeSetId = briefcase.nativeDb.getReversedChangeSetId();

    return briefcase;
  }

  private static closeBriefcase(briefcase: BriefcaseEntry) {
    assert(briefcase.isOpen, "Briefcase must be open for it to be closed");
    briefcase.nativeDb.closeIModel();
    briefcase.isOpen = false;
    briefcase.openParams = undefined;
  }

  private static reopenBriefcase(accessToken: AccessToken, briefcase: BriefcaseEntry, openParams: OpenParams) {
    if (briefcase.isOpen)
      BriefcaseManager.closeBriefcase(briefcase);

    briefcase.nativeDb = briefcase.nativeDb || new (NativePlatformRegistry.getNativePlatform()).NativeDgnDb();

    const res: DbResult = briefcase.nativeDb!.openIModel(briefcase.pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, briefcase.pathname);

    briefcase.openParams = openParams;
    briefcase.userId = accessToken.getUserProfile()!.userId;
    briefcase.isOpen = true;
  }

  private static async applyChangeSets(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, targetVersion: IModelVersion, processOption: ChangeSetApplyOption): Promise<void> {
    actx.enter();
    assert(!!briefcase.nativeDb && briefcase.isOpen);
    assert(briefcase.nativeDb.getParentChangeSetId() === briefcase.changeSetId, "Mismatch between briefcase and the native Db");

    if (briefcase.changeSetIndex === undefined)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot apply changes to a standalone file"));

    const targetChangeSetId: string = await targetVersion.evaluateChangeSet(actx, accessToken, briefcase.iModelId, BriefcaseManager.imodelClient);
    const targetChangeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(actx, accessToken, briefcase.iModelId, targetChangeSetId);
    actx.enter();
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
        assert(briefcase.openParams!.accessMode !== AccessMode.Shared, "Cannot reinstate. If a Db has shared access, we should NOT have allowed to reverse in the first place!");

        break;
      case ChangeSetApplyOption.Reverse:
        if (targetChangeSetIndex >= currentChangeSetIndex)
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse to a later version"));
        if (briefcase.openParams!.accessMode === AccessMode.Shared)
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changes when the Db allows shared access - open with AccessMode.Exclusive"));

        break;
      default:
        assert(false, "Unknown change set process option");
        return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Unknown ChangeSet process option"));
    }

    const reverse: boolean = (targetChangeSetIndex < currentChangeSetIndex);
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(actx, accessToken, briefcase.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    actx.enter();
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    // Close Db before merge (if there are schema changes)
    const containsSchemaChanges: boolean = changeSets.some((changeSet: ChangeSet) => changeSet.changesType === ChangesType.Schema);
    if (containsSchemaChanges && briefcase.isOpen)
      briefcase.onBeforeClose.raiseEvent(briefcase);

    // Apply the changes
    const status: ChangeSetStatus = briefcase.nativeDb!.applyChangeSets(JSON.stringify(changeSetTokens), processOption);
    if (ChangeSetStatus.Success !== status)
      return Promise.reject(new IModelError(status));

    // Mark Db as reopened after merge (if there are schema changes)
    if (containsSchemaChanges)
      briefcase.isOpen = true;

    switch (processOption) {
      case ChangeSetApplyOption.Merge:
        BriefcaseManager.updateBriefcaseVersion(briefcase, targetChangeSetId, targetChangeSetIndex);
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

  private static updateBriefcaseVersion(briefcase: BriefcaseEntry, changeSetId: string, changeSetIndex: number) {
    const oldKey = briefcase.getKey();
    briefcase.changeSetId = changeSetId;
    briefcase.changeSetIndex = changeSetIndex;

    // Update cache if necessary
    if (BriefcaseManager._cache.findBriefcaseByKey(oldKey)) {
      BriefcaseManager._cache.deleteBriefcaseByKey(oldKey);
      BriefcaseManager._cache.addBriefcase(briefcase);
    }
  }

  public static async reverseChanges(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void> {
    return BriefcaseManager.applyChangeSets(actx, accessToken, briefcase, reverseToVersion, ChangeSetApplyOption.Reverse);
  }

  public static async reinstateChanges(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void> {
    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(briefcase.changeSetId);
    return BriefcaseManager.applyChangeSets(actx, accessToken, briefcase, targetVersion, ChangeSetApplyOption.Reinstate);
  }

  /**
   * Pull and merge changes from the hub
   * @param accessToken Delegation token of the authorized user
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   */
  public static async pullAndMergeChanges(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    await BriefcaseManager.updatePendingChangeSets(actx, accessToken, briefcase);
    return BriefcaseManager.applyChangeSets(actx, accessToken, briefcase, mergeToVersion, ChangeSetApplyOption.Merge);
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
  private static async updatePendingChangeSets(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry): Promise<void> {
    actx.enter();

    let pendingChangeSets = BriefcaseManager.getPendingChangeSets(briefcase);
    if (pendingChangeSets.length === 0)
      return;

    pendingChangeSets = pendingChangeSets.slice(0, 100);

    const query = new ChangeSetQuery().filter(`$id+in+[${pendingChangeSets.map((value: string) => `'${value}'`).join(",")}]`).selectDownloadUrl();
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, new Guid(briefcase.iModelId), query);

    await BriefcaseManager.downloadChangeSetsInternal(actx, briefcase.iModelId, changeSets);
    actx.enter();

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    for (const token of changeSetTokens) {
      try {
        const codes = BriefcaseManager.extractCodesFromFile(briefcase, [token]);
        await BriefcaseManager.imodelClient.Codes().update(actx, accessToken, new Guid(briefcase.iModelId), codes, { deniedCodes: true, continueOnConflict: true });
        actx.enter();
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
  private static parseCodesFromJson(briefcase: BriefcaseEntry, json: string): HubCode[] {
    return JSON.parse(json, (key: any, value: any) => {
      if (key === "state") {
        return (value as number);
      }
      // If the key is a number, it is an array member.
      if (!Number.isNaN(Number.parseInt(key, 10))) {
        const code = new HubCode();
        Object.assign(code, value);
        code.codeSpecId = new Id64(value.codeSpecId);
        code.briefcaseId = briefcase.briefcaseId;
        return code;
      }
      return value;
    }) as HubCode[];
  }

  /** Extracts codes from current ChangeSet */
  private static extractCodes(briefcase: BriefcaseEntry): HubCode[] {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodes();
    if (res.error)
      throw new IModelError(res.error.status);
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Extracts codes from ChangeSet file */
  private static extractCodesFromFile(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[]): HubCode[] {
    const res: ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodesFromFile(JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status);
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Attempt to update codes without rejecting so pull wouldn't fail */
  private static async tryUpdatingCodes(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, changeSet: ChangeSet, relinquishCodesLocks: boolean): Promise<void> {
    actx.enter();
    // Add ChangeSet id, in case updating failed due to something else than conflicts
    BriefcaseManager.addPendingChangeSet(briefcase, changeSet.id!);

    let failedUpdating = false;
    try {
      await BriefcaseManager.imodelClient.Codes().update(actx, accessToken, new Guid(briefcase.iModelId), BriefcaseManager.extractCodes(briefcase), { deniedCodes: true, continueOnConflict: true });
      actx.enter();
    } catch (error) {
      actx.enter();
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
        await BriefcaseManager.imodelClient.Codes().deleteAll(actx, accessToken, new Guid(briefcase.iModelId), briefcase.briefcaseId);
        await BriefcaseManager.imodelClient.Locks().deleteAll(actx, accessToken, new Guid(briefcase.iModelId), briefcase.briefcaseId);
        actx.enter();
      }
    } catch (error) {
      actx.enter();
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

  /** Applies a change set to a standalone iModel */
  public static applyStandaloneChangeSets(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): ChangeSetStatus {
    if (!briefcase.isStandalone)
      throw new IModelError(BentleyStatus.ERROR);

    return briefcase.nativeDb!.applyChangeSets(JSON.stringify(changeSetTokens), processOption);
  }

  /** Dumps a change set */
  public static dumpChangeSet(briefcase: BriefcaseEntry, changeSetToken: ChangeSetToken) {
    briefcase.nativeDb!.dumpChangeSet(JSON.stringify(changeSetToken));
  }

  /** Attempt to push a ChangeSet to iModel Hub */
  private static async pushChangeSet(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    actx.enter();
    if (briefcase.openParams!.syncMode !== SyncMode.PullAndPush) {
      throw new IModelError(BriefcaseStatus.CannotUpload, "Cannot push from an IModelDb that's opened PullOnly");
    }

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);
    const changeSet = new ChangeSet();
    changeSet.briefcaseId = briefcase.briefcaseId;
    changeSet.id = changeSetToken.id;
    changeSet.parentId = changeSetToken.parentId;
    changeSet.changesType = changeSetToken.containsSchemaChanges ? ChangesType.Schema : ChangesType.Regular;
    changeSet.seedFileId = new Guid(briefcase.fileId!);
    changeSet.fileSize = IModelJsFs.lstatSync(changeSetToken.pathname)!.size.toString();
    changeSet.description = description;
    if (changeSet.description.length >= 255) {
      Logger.logWarning(loggingCategory, "pushChanges - Truncating description to 255 characters. " + changeSet.description);
      changeSet.description = changeSet.description.slice(0, 254);
    }

    let postedChangeSet: ChangeSet | undefined;
    try {
      postedChangeSet = await BriefcaseManager.imodelClient.ChangeSets().create(actx, accessToken, new Guid(briefcase.iModelId), changeSet, changeSetToken.pathname);
    } catch (error) {
      // If ChangeSet already exists, updating codes and locks might have timed out.
      if (!(error instanceof IModelHubError) || error.errorNumber !== IModelHubStatus.ChangeSetAlreadyExists) {
        Promise.reject(error);
      }
    }

    await BriefcaseManager.tryUpdatingCodes(actx, accessToken, briefcase, changeSet, relinquishCodesLocks);
    actx.enter();

    BriefcaseManager.finishCreateChangeSet(briefcase);
    BriefcaseManager.updateBriefcaseVersion(briefcase, postedChangeSet!.wsgId, +postedChangeSet!.index!);
  }

  /** Attempt to pull merge and push once */
  private static async pushChangesOnce(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    await BriefcaseManager.pullAndMergeChanges(actx, accessToken, briefcase, IModelVersion.latest());
    await BriefcaseManager.pushChangeSet(actx, accessToken, briefcase, description, relinquishCodesLocks).catch((err) => {
      actx.enter();
      BriefcaseManager.abandonCreateChangeSet(briefcase);
      return Promise.reject(err);
    });
  }

  /** Return true if should attempt pushing again. */
  private static shouldRetryPush(error: any): boolean {
    if (error instanceof IModelHubError && error.errorNumber) {
      switch (error.errorNumber!) {
        case IModelHubStatus.AnotherUserPushing:
        case IModelHubStatus.PullIsRequired:
        case IModelHubStatus.DatabaseTemporarilyLocked:
        case IModelHubStatus.OperationFailed:
          return true;
      }
    }
    return false;
  }

  /** Push local changes to the hub
   * @param accessToken The access token of the account that has write access to the iModel. This may be a service account.
   * @param briefcase Identifies the IModelDb that contains the pending changes.
   * @param description a description of the changeset that is to be pushed.
   * @param relinquishCodesLocks release locks held and codes reserved (but not used) after pushing?
   */
  public static async pushChanges(actx: ActivityLoggingContext, accessToken: AccessToken, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean = true): Promise<void> {
    for (let i = 0; i < 5; ++i) {
      let pushed: boolean = false;
      let error: any;
      await BriefcaseManager.pushChangesOnce(actx, accessToken, briefcase, description, relinquishCodesLocks || false).then(() => {
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

  private static isUsingIModelBankClient(): boolean {
    return (this._imodelClient === undefined) || (this._imodelClient instanceof IModelBankClient);
  }

  /** Create an iModel on iModelHub */
  public static async create(actx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, hubName: string, args: CreateIModelProps): Promise<string> {
    assert(!this.isUsingIModelBankClient(), "This is a Hub-only operation");

    await BriefcaseManager.memoizedInitCache(actx, accessToken);
    assert(!!BriefcaseManager.imodelClient);

    actx.enter();

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

    const iModelId: string = await BriefcaseManager.upload(actx, accessToken, projectId, fileName, hubName, args.rootSubject.description);
    return iModelId;
  }

  /** Pushes a new iModel to the Hub */
  private static async upload(actx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, pathname: string, hubName?: string, hubDescription?: string, timeOutInMilliseconds: number = 2 * 60 * 1000): Promise<string> {
    assert(!this.isUsingIModelBankClient(), "This is a Hub-only operation");

    hubName = hubName || path.basename(pathname, ".bim");

    actx.enter();
    const iModel: HubIModel = await BriefcaseManager.imodelClient.IModels().create(actx, accessToken, projectId, hubName, pathname, hubDescription, undefined, timeOutInMilliseconds);

    return iModel.wsgId;
  }

  /** @hidden */
  // TODO: This should take contextId as an argument, so that we know which server (iModelHub or iModelBank) to use.
  public static async deleteAllBriefcases(actx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string) {
    if (BriefcaseManager.imodelClient === undefined)
      return;
    actx.enter();
    const promises = new Array<Promise<void>>();
    const briefcases = await BriefcaseManager.imodelClient.Briefcases().get(actx, accessToken, new Guid(iModelId));
    actx.enter();
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(BriefcaseManager.imodelClient.Briefcases().delete(actx, accessToken, new Guid(iModelId), briefcase.briefcaseId!));
    });
    return Promise.all(promises);
  }

}

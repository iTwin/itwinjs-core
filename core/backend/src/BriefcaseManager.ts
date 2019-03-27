/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import {
  Briefcase as HubBriefcase, IModelHubClient, ConnectClient, ChangeSet,
  ChangesType, Briefcase, HubCode, IModelHubError, AuthorizedClientRequestContext,
  BriefcaseQuery, ChangeSetQuery, IModelQuery, ConflictingCodesError, IModelClient, HubIModel, IncludePrefix,
} from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { AzureFileHandler, IOSAzureFileHandler } from "@bentley/imodeljs-clients-backend";
import { ChangeSetApplyOption, BeEvent, DbResult, OpenMode, assert, Logger, ChangeSetStatus, BentleyStatus, IModelHubStatus, PerfLogger, GuidString, Id64, IModelStatus } from "@bentley/bentleyjs-core";
import { BriefcaseStatus, IModelError, IModelVersion, IModelToken, CreateIModelProps } from "@bentley/imodeljs-common";
import { IModelJsNative } from "./IModelJsNative";
import { IModelDb, OpenParams, SyncMode, AccessMode, ExclusiveAccessOption } from "./IModelDb";
import { IModelHost, Platform } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { LoggerCategory } from "./LoggerCategory";
import * as path from "path";
import * as glob from "glob";

const loggerCategory: string = LoggerCategory.IModelDb;

/** The Id assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels
 * @internal
 */
export class BriefcaseId {
  private _value: number;
  public static get Illegal(): number { return 0xffffffff; }
  public static get Master(): number { return 0; }
  public static get Standalone(): number { return 1; }
  constructor(value?: number) { this._value = value === undefined ? BriefcaseId.Illegal : value; }
  public get value(): number { return this._value; }
  public toString(): string { return this._value.toString(); }
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  No = 0,
  Yes = 1,
}

/**
 * A token that represents a ChangeSet
 * @internal
 */
export class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public containsSchemaChanges: boolean, public pushDate?: string) { }
}

/**
 * Entry in the briefcase cache
 * @internal
 */
export class BriefcaseEntry {

  /** Id of the iModel - set to the DbGuid field in the briefcase, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId!: GuidString;

  /** Absolute path where the briefcase is cached/stored */
  public pathname!: string;

  /** Id of the last change set that was applied to the briefcase.
   * Set to an empty string if it is the initial version, or a standalone briefcase
   */
  public changeSetId!: string;

  /** Index of the last change set that was applied to the briefcase.
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
  public nativeDb!: IModelJsNative.DgnDb;

  /** Params used to open the briefcase */
  public openParams?: OpenParams;

  /** Id of the last change set that was applied to the briefcase after it was reversed.
   * Undefined if no change sets have been reversed.
   * Set to empty string if reversed to the first version.
   */
  public reversedChangeSetId?: string;

  /** Index of the last change set that was applied to the briefcase after it was reversed.
   * Undefined if no change sets have been reversed
   * Set to 0 if the briefcase has been reversed to the first version
   */
  public reversedChangeSetIndex?: number;

  /** Id of the user that acquired the briefcase. This is not set if it is a standalone briefcase */
  public userId?: string;

  /** The IModelDb for this briefcase. */
  private _iModelDb?: IModelDb;
  public get iModelDb(): IModelDb | undefined { return this._iModelDb; }
  public set iModelDb(iModelDb: IModelDb | undefined) {
    this.nativeDb.setIModelDb(iModelDb); // store a pointer to this IModelDb on the native object so we can send it callbacks
    this._iModelDb = iModelDb;
  }

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
      return `${this.iModelId}:${this.currentChangeSetId}:${uniqueId}`;
    }

    // Acquired (PullPush)
    return `${this.iModelId}:${this.briefcaseId}`;
  }

  /**
   * Gets the current changeSetId of the briefcase
   * Note that this may not be the changeSetId if the briefcase has reversed changes
   * @hidden
   */
  public get currentChangeSetId(): string {
    return (typeof this.reversedChangeSetId !== "undefined") ? this.reversedChangeSetId : this.changeSetId;
  }

  /**
   * Gets the current changeSetIndex of the briefcase
   * Note that this may not be the changeSetIndex if the briefcase has reversed changes
   * @hidden
   */
  public get currentChangeSetIndex(): number {
    return (typeof this.reversedChangeSetIndex !== "undefined") ? this.reversedChangeSetIndex! : this.changeSetIndex!;
  }

  /** Returns true if the briefcase has reversed changes
   * @hidden
   */
  public get hasReversedChanges(): boolean {
    return typeof this.reversedChangeSetId !== "undefined";
  }

  /** @hidden */
  public getDebugInfo(): any {
    const pathname = this.pathname.replace(/\\/g, "/");
    return { key: this.getKey(), iModelId: this.iModelId, pathname, isOpen: this.isOpen ? true : false, changeSetId: this.changeSetId, changeSetIndex: this.changeSetIndex, reversedChangeSetId: this.reversedChangeSetId, reversedChangeSetIndex: this.reversedChangeSetIndex, userId: this.userId };
  }
}

/**
 * In-memory cache of briefcases
 * @hidden
 */
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

    if (this._briefcases.get(key))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Briefcase ${key} already exists in the cache.`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    Logger.logTrace(loggerCategory, "Added briefcase to the cache", () => briefcase.getDebugInfo());
    this._briefcases.set(key, briefcase);
  }

  /** Delete a briefcase from the cache */
  public deleteBriefcase(briefcase: BriefcaseEntry) { this.deleteBriefcaseByKey(briefcase.getKey()); }

  /** Delete a briefcase from the cache by key */
  public deleteBriefcaseByKey(key: string) {
    const briefcase = this._briefcases.get(key);
    if (!briefcase)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Briefcase not found in cache", Logger.logError, loggerCategory, () => ({ key }));

    this._briefcases.delete(key);
    Logger.logTrace(loggerCategory, "Deleted briefcase from the cache", () => briefcase.getDebugInfo());
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

/**
 * Utility to manage briefcases
 * @hidden
 */
export class BriefcaseManager {
  private static _cache: BriefcaseCache = new BriefcaseCache();
  private static _isCacheInitialized?: boolean;
  private static _imodelClient?: IModelClient;

  /** IModel Server Client to be used for all briefcase operations */
  public static get imodelClient(): IModelClient {
    if (!this._imodelClient) {
      // The server handler defaults to iModelHub handler and the file handler defaults to AzureFileHandler
      if (Platform.isMobile) {
        this._imodelClient = new IModelHubClient(new IOSAzureFileHandler());
      } else {
        this._imodelClient = new IModelHubClient(new AzureFileHandler());
      }
    }
    return this._imodelClient;
  }

  public static set imodelClient(cli: IModelClient) { this._imodelClient = cli; }

  private static _connectClient?: ConnectClient;

  /** Connect client to be used for all briefcase operations */
  public static get connectClient(): ConnectClient {
    if (!BriefcaseManager._connectClient) {
      if (!IModelHost.configuration)
        throw new Error("IModelHost.startup() should be called before any backend operations");
      BriefcaseManager._connectClient = new ConnectClient();
    }
    return BriefcaseManager._connectClient;
  }

  /** Get the local path of the root folder storing the imodel seed file, change sets and briefcases */
  private static getIModelPath(iModelId: GuidString): string {
    const pathname = path.join(BriefcaseManager.cacheDir, iModelId, "/");
    return path.normalize(pathname);
  }

  public static getChangeSetsPath(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), "csets"); }
  public static getChangeCachePathName(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }
  public static getChangedElementsPathName(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.elems")); }

  private static getBriefcasesPath(iModelId: GuidString) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc");
  }

  private static buildStandalonePathname(iModelId: GuidString, iModelName: string): string {
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

  private static buildAcquiredPathname(iModelId: GuidString, briefcaseId: number, iModelName: string): string {
    const pathBaseName: string = BriefcaseManager.getBriefcasesPath(iModelId);

    return path.join(pathBaseName, briefcaseId.toString(), iModelName.concat(".bim"));
  }

  /** Clear the briefcase manager cache */
  private static clearCache() {
    BriefcaseManager._cache.clear();
    BriefcaseManager._isCacheInitialized = undefined;
  }

  private static closeAllBriefcases() {
    const briefcases = BriefcaseManager._cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => briefcase.isOpen);
    for (const briefcase of briefcases) {
      BriefcaseManager.closeBriefcase(briefcase, true);
    }
  }

  private static onIModelHostShutdown() {
    BriefcaseManager.closeAllBriefcases();
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
  private static async addBriefcaseToCache(requestContext: AuthorizedClientRequestContext, briefcaseDir: string, iModelId: GuidString) {
    requestContext.enter();

    // Determine the briefcase .bim file in the folder, and cleanup anything else (may be a result of an aborted copy)
    const fileNames = IModelJsFs.readdirSync(briefcaseDir);
    let briefcasePathname: string | undefined;
    for (const tmpFileName of fileNames) {
      const tmpPathname = path.join(briefcaseDir, tmpFileName);
      const ext = path.extname(tmpPathname).toLowerCase();
      if (ext !== ".bim")
        continue;
      if (!!briefcasePathname)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `Briefcase directory ${briefcaseDir} must contain only one briefcase`, Logger.logError, loggerCategory);
      briefcasePathname = tmpPathname;
    }
    if (!briefcasePathname)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Briefcase directory ${briefcaseDir} must contain at least one briefcase`, Logger.logError, loggerCategory);

    // Open the briefcase to populate the briefcase entry with briefcaseid changesetid and reversedchangesetid
    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = iModelId;
    briefcase.pathname = briefcasePathname;
    briefcase.isStandalone = false;

    const nativeDb = new IModelHost.platform.DgnDb();
    const res: DbResult = nativeDb.openIModelFile(briefcase.pathname, OpenMode.Readonly);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, "Unable to open briefcase", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));

    briefcase.briefcaseId = nativeDb.getBriefcaseId();
    briefcase.changeSetId = nativeDb.getParentChangeSetId();
    briefcase.reversedChangeSetId = nativeDb.getReversedChangeSetId();
    nativeDb.closeIModel();

    // Now populate changesetIndex, reversedChangesetIndex, userId, fileId from hub
    try {
      briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.changeSetId);
      requestContext.enter();

      if (typeof briefcase.reversedChangeSetId !== "undefined") {
        briefcase.reversedChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.reversedChangeSetId);
        requestContext.enter();
      }

      if (briefcase.briefcaseId !== BriefcaseId.Standalone) {
        const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcase.briefcaseId));
        requestContext.enter();

        if (hubBriefcases.length === 0)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unable to find briefcase ${briefcase.briefcaseId}:${briefcase.pathname} on the Hub (for the current user)`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
        briefcase.userId = hubBriefcases[0].userId;
        briefcase.fileId = hubBriefcases[0].fileId!.toString();
      }
    } catch (error) {
      throw error;
    } finally {
      requestContext.enter();
    }

    BriefcaseManager._cache.addBriefcase(briefcase);
  }

  /** Get basic information on all briefcases on disk under the specified path */
  private static async initCacheForIModel(requestContext: AuthorizedClientRequestContext, iModelId: GuidString) {
    requestContext.enter();
    const basePath = BriefcaseManager.getBriefcasesPath(iModelId);
    if (!IModelJsFs.existsSync(basePath))
      return;
    const subDirs = IModelJsFs.readdirSync(basePath);
    if (subDirs.length === 0)
      return;

    Logger.logTrace(loggerCategory, "Initializing briefcase cache for iModel", () => ({ iModelId }));

    for (const subDirName of subDirs) {
      const briefcaseDir = path.join(basePath, subDirName);
      try {
        await BriefcaseManager.addBriefcaseToCache(requestContext, briefcaseDir, iModelId);
        requestContext.enter();
      } catch (error) {
        Logger.logWarning(loggerCategory, `Deleting briefcase in ${briefcaseDir} from cache`);
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
  private static async initCache(requestContext: AuthorizedClientRequestContext): Promise<void> {
    requestContext.enter();
    if (BriefcaseManager._isCacheInitialized)
      return;

    if (!IModelHost.configuration)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "IModelHost.startup() should be called before any backend operations", Logger.logError, loggerCategory);
    Logger.logTrace(loggerCategory, "Started initializing briefcase cache");

    IModelHost.onBeforeShutdown.addListener(BriefcaseManager.onIModelHostShutdown);

    const perfLogger = new PerfLogger("BriefcaseManager.initCache");
    for (const iModelId of IModelJsFs.readdirSync(BriefcaseManager.cacheDir)) {
      await BriefcaseManager.initCacheForIModel(requestContext, iModelId);
    }
    perfLogger.dispose();

    BriefcaseManager._isCacheInitialized = true;
    Logger.logTrace(loggerCategory, "Finished initializing briefcase cache");
  }

  private static _memoizedInitCache?: Promise<void>;
  /** Memoized initCache - avoids race condition caused by two async calls to briefcase manager */
  private static async memoizedInitCache(requestContext: AuthorizedClientRequestContext) {
    // NEEDS_WORK: initCache() is to be made synchronous and independent of the accessToken passed in.
    if (!BriefcaseManager._memoizedInitCache)
      BriefcaseManager._memoizedInitCache = BriefcaseManager.initCache(requestContext);
    try {
      await BriefcaseManager._memoizedInitCache;
    } finally {
      BriefcaseManager._memoizedInitCache = undefined;
    }
  }

  /** Get the index of the change set from its id */
  private static async getChangeSetIndexFromId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSetId: string): Promise<number> {
    requestContext.enter();
    if (changeSetId === "")
      return 0; // the first version
    try {
      const changeSet: ChangeSet = (await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
      requestContext.enter();

      return +changeSet.index!;
    } catch (err) {
      throw new IModelError(ChangeSetStatus.InvalidId, "Could not determine index of change set", Logger.logError, loggerCategory, () => ({ iModelId, changeSetId }));
    }
  }

  /** Open a briefcase */
  public static async open(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString, openParams: OpenParams, version: IModelVersion): Promise<BriefcaseEntry> {
    await BriefcaseManager.memoizedInitCache(requestContext);
    requestContext.enter();

    assert(!!BriefcaseManager.imodelClient);

    let perfLogger = new PerfLogger("BriefcaseManager.open -> version.evaluateChangeSet + BriefcaseManager.getChangeSetIndexFromId");
    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, BriefcaseManager.imodelClient);
    requestContext.enter();
    const changeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(requestContext, iModelId, changeSetId);
    requestContext.enter();
    perfLogger.dispose();

    // Find a cached briefcase if possible
    perfLogger = new PerfLogger("BriefcaseManager.open -> BriefcaseManager.findCachedBriefcaseToOpen");
    let briefcase: BriefcaseEntry | undefined = BriefcaseManager.findCachedBriefcaseToOpen(requestContext, iModelId, changeSetIndex, openParams);
    perfLogger.dispose();

    const createNewBriefcase: boolean = !briefcase;
    const readWriteOpenParams: OpenParams = openParams.openMode === OpenMode.ReadWrite ? openParams : new OpenParams(OpenMode.ReadWrite, openParams.accessMode, openParams.syncMode, openParams.exclusiveAccessOption); // Open ReadWrite to allow applying changes
    if (!!briefcase) {
      // briefcase already exists. If open and has a different version than requested, close first
      if (briefcase.isOpen) {
        if (briefcase.currentChangeSetIndex === changeSetIndex) {
          Logger.logTrace(loggerCategory, `Reused briefcase ${briefcase.pathname} without changes`);
          return briefcase;
        }

        BriefcaseManager.closeBriefcase(briefcase, false);
      }

      perfLogger = new PerfLogger("BriefcaseManager.open -> BriefcaseManager.openBriefcase");
      BriefcaseManager.openBriefcase(requestContext, contextId, briefcase, readWriteOpenParams);
      perfLogger.dispose();
    } else {
      perfLogger = new PerfLogger("BriefcaseManager.open -> BriefcaseManager.createBriefcase");
      try {
        briefcase = await BriefcaseManager.createBriefcase(requestContext, contextId, iModelId, readWriteOpenParams);
      } finally {
        requestContext.enter();
        perfLogger.dispose();
      }
    }

    assert(!!briefcase);
    if (changeSetIndex < briefcase.changeSetIndex! && openParams.syncMode === SyncMode.PullAndPush) {
      Logger.logError(loggerCategory, "Cannot open an older version of an IModel to push changes (SyncMode.PullAndPush)", () => briefcase!.getDebugInfo());
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
      throw new IModelError(BriefcaseStatus.CannotApplyChanges, "Cannot open an older version of an IModel to push changes (SyncMode.PullAndPush)");
    }

    // Apply the required change sets
    try {
      await BriefcaseManager.processChangeSets(requestContext, briefcase, version);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();

      // Clean up the cache for a retry
      Logger.logError(loggerCategory, "Error applying changes to briefcase. Deleting the briefcase from cache to enable retries", () => briefcase!.getDebugInfo());
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();

      if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
        Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them from cache to enable retries", () => briefcase!.getDebugInfo());
        BriefcaseManager.deleteChangeSetsFromLocalDisk(iModelId);
      }
      throw error;
    }

    // Reopen the iModel file if the briefcase hasn't been opened with the required OpenMode
    if (briefcase.openParams!.openMode !== openParams.openMode) {
      // Don't use closeBriefcase and openBriefcase as this would trigger a new usage tracking entry
      assert(briefcase.isOpen, "Briefcase must be open for it to be closed");
      briefcase.nativeDb.closeIModel();
      const res: DbResult = briefcase.nativeDb.openIModelFile(briefcase.pathname, openParams.openMode);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, `Unable to reopen briefcase at ${briefcase.pathname}`, Logger.logError, loggerCategory, () => briefcase!.getDebugInfo());

      briefcase.openParams = openParams;
    }

    // Add briefcase to cache if necessary
    if (createNewBriefcase) {
      // Note: This cannot be done right after creation since the version (that's part of the key to the cache)
      // is not established until the change sets are merged
      BriefcaseManager._cache.addBriefcase(briefcase);
    }

    return briefcase;
  }

  /** Close a briefcase, and delete from the hub if necessary */
  public static async close(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void> {
    requestContext.enter();
    assert(!briefcase.isStandalone, "Cannot use IModelDb.close() to close a standalone iModel. Use IModelDb.closeStandalone() instead");
    BriefcaseManager.closeBriefcase(briefcase, true);
    if (keepBriefcase === KeepBriefcase.No) {
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
    }
  }

  /** Finds any existing briefcase for the specified parameters. Pass null for the requiredChangeSet if the first version is to be retrieved */
  private static findCachedBriefcaseToOpen(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, requiredChangeSetIndex: number, requiredOpenParams: OpenParams): BriefcaseEntry | undefined {
    const requiredUserId = requestContext.accessToken.getUserInfo()!.id;

    // Narrow down briefcases by various criteria (except their versions)
    const filterBriefcaseFn = (entry: BriefcaseEntry): boolean => {
      // Narrow down to entries for the specified iModel
      if (entry.iModelId !== iModelId)
        return false;

      // Narrow down briefcases for PullAndPush access
      if (requiredOpenParams.syncMode === SyncMode.PullAndPush) {
        if (entry.briefcaseId === BriefcaseId.Standalone) // only acquired briefcases
          return false;
        assert(requiredOpenParams.accessMode === AccessMode.Exclusive); // only exclusive access can be requested
        if (!entry.userId || entry.userId !== requiredUserId) // must've been acquired by same user
          return false;
        if (entry.isOpen) {
          if (requiredOpenParams.exclusiveAccessOption === ExclusiveAccessOption.CreateNewBriefcase || entry.openParams!.exclusiveAccessOption === ExclusiveAccessOption.CreateNewBriefcase)
            return false; // user doesn't want to reuse
          assert(entry.openParams!.equals(requiredOpenParams));
        } else {
          if (requiredChangeSetIndex < entry.changeSetIndex!) // Cannot push (write) to a reversed briefcase
            return false;
        }
        return true;
      }

      // Narrow down briefcase for PullOnly or FixedVersion access
      // Note: We currently allow reversal only in Exclusive briefcases. Also, we reinstate any reversed changes in all briefcases when the
      // cache is initialized, but that may be removed in the future. See addBriefcaseToCache()
      assert(requiredOpenParams.syncMode === SyncMode.FixedVersion || requiredOpenParams.syncMode === SyncMode.PullOnly);
      if (entry.briefcaseId !== BriefcaseId.Standalone) // only standalone briefcases
        return false;
      if (!entry.isOpen) // can reuse any closed standalone briefcase
        return true;

      // Further narrow down open briefcase
      if (entry.openParams!.accessMode !== requiredOpenParams.accessMode) // exclusive/shared briefcases cannot be re-purposed
        return false;
      if (entry.openParams!.syncMode !== requiredOpenParams.syncMode) // PullOnly and FixedVersion briefcases cannot be re-purposed for the other
        return false;
      if (entry.currentChangeSetIndex !== requiredChangeSetIndex) // current changeset index must exactly match
        return false;

      if (requiredOpenParams.accessMode === AccessMode.Exclusive) {
        assert(!!entry.userId);
        if (entry.userId !== requiredUserId) // must've been opened by the same user
          return false;
        if (requiredOpenParams.exclusiveAccessOption === ExclusiveAccessOption.CreateNewBriefcase || entry.openParams!.exclusiveAccessOption === ExclusiveAccessOption.CreateNewBriefcase)
          return false; // user doesn't want to reuse
      }

      return true;
    };

    const briefcases = this._cache.getFilteredBriefcases(filterBriefcaseFn);
    if (!briefcases || briefcases.length === 0)
      return undefined;

    const sortedBriefcases = briefcases.sort((a: BriefcaseEntry, b: BriefcaseEntry) => { // Return -1 if a < b, +1 if a > b, and 0 if a = b
      // Prefer open
      if (a.isOpen && !b.isOpen)
        return -1;
      if (!a.isOpen && b.isOpen)
        return 1;

      // Prefer closer change set index (a better metric will be change set size)
      const aDist = Math.abs(a.currentChangeSetIndex - requiredChangeSetIndex);
      const bDist = Math.abs(b.currentChangeSetIndex - requiredChangeSetIndex);
      if (aDist < bDist)
        return -1;
      if (aDist > bDist)
        return 1;
      return 0;
    });

    return sortedBriefcases[0];
  }

  /** Create a briefcase */
  private static async createBriefcase(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString, openParams: OpenParams): Promise<BriefcaseEntry> {
    requestContext.enter();

    const iModel: HubIModel = (await BriefcaseManager.imodelClient.iModels.get(requestContext, contextId, new IModelQuery().byId(iModelId)))[0];

    const briefcase = new BriefcaseEntry();
    briefcase.iModelId = iModelId;
    briefcase.userId = requestContext.accessToken.getUserInfo()!.id;

    let hubBriefcase: HubBriefcase;
    if (openParams.syncMode !== SyncMode.PullAndPush) {
      /* FixedVersion, PullOnly => Create standalone briefcase
       * We attempt to get any briefcase for the iModel to download the latest copy. If there isn't
       * such a briefcase available, we simply acquire one and keep it unused. The iModelHub team
       * will be providing an API that helps avoid this acquisition and get to a checkpoint that's
       * closest to the requested version.
       */
      hubBriefcase = await BriefcaseManager.getOrAcquireBriefcase(requestContext, iModelId);
      requestContext.enter();
      briefcase.pathname = BriefcaseManager.buildStandalonePathname(iModelId, iModel.name!);
      briefcase.briefcaseId = BriefcaseId.Standalone;
    } else {
      /* PullAndPush => Acquire a briefcase from the hub */
      hubBriefcase = await BriefcaseManager.acquireBriefcase(requestContext, iModelId);
      requestContext.enter();
      briefcase.pathname = BriefcaseManager.buildAcquiredPathname(iModelId, +hubBriefcase.briefcaseId!, iModel.name!);
      briefcase.briefcaseId = hubBriefcase.briefcaseId!;
    }
    briefcase.fileId = hubBriefcase.fileId!.toString();

    await BriefcaseManager.downloadBriefcase(requestContext, hubBriefcase, briefcase.pathname);
    requestContext.enter();

    briefcase.changeSetId = hubBriefcase.mergedChangeSetId!;
    briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, iModelId, briefcase.changeSetId);
    requestContext.enter();

    assert(openParams.openMode === OpenMode.ReadWrite); // Expect to setup briefcase as ReadWrite to allow pull and merge of changes (irrespective of the real openMode)
    const nativeDb: IModelJsNative.DgnDb = new IModelHost.platform.DgnDb();
    let res: DbResult = BriefcaseManager.openDb(requestContext, nativeDb, contextId, briefcase.pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res) {
      const msg = `Unable to open Db at ${briefcase.pathname} when creating a briefcase`;
      Logger.logError(loggerCategory, msg, () => ({ ...briefcase.getDebugInfo(), result: res }));

      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();

      throw new IModelError(res, msg);
    }

    res = nativeDb.setBriefcaseId(briefcase.briefcaseId);
    if (DbResult.BE_SQLITE_OK !== res) {
      const msg = `Unable to setup briefcase id for Db at ${briefcase.pathname} when creating a briefcase`;
      Logger.logError(loggerCategory, msg, () => ({ ...briefcase.getDebugInfo(), result: res }));

      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();

      throw new IModelError(res, msg);
    }
    assert(nativeDb.getParentChangeSetId() === briefcase.changeSetId);

    briefcase.nativeDb = nativeDb;
    briefcase.openParams = openParams;
    briefcase.isOpen = true;
    briefcase.isStandalone = false;
    briefcase.imodelClientContext = contextId;

    Logger.logTrace(loggerCategory, `Created briefcase ${briefcase.pathname}`);
    return briefcase;
  }

  private static openDb(requestContext: AuthorizedClientRequestContext, nativeDb: IModelJsNative.DgnDb, contextId: GuidString, filePath: string, mode: OpenMode): DbResult {
    const res: DbResult = nativeDb.openIModel(requestContext.accessToken.toTokenString(IncludePrefix.No), requestContext.applicationVersion, contextId, filePath, mode);
    return res;
  }

  private static async getOrAcquireBriefcase(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<HubBriefcase> {
    requestContext.enter();

    const briefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, (new BriefcaseQuery()).selectDownloadUrl());
    requestContext.enter();

    const someBriefcase = briefcases.length > 0 ? briefcases[0] : await BriefcaseManager.acquireBriefcase(requestContext, iModelId);
    requestContext.enter();

    return someBriefcase;
  }

  /** Acquire a briefcase */
  private static async acquireBriefcase(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<HubBriefcase> {
    requestContext.enter();

    const briefcase: HubBriefcase = await BriefcaseManager.imodelClient.briefcases.create(requestContext, iModelId);
    requestContext.enter();

    if (!briefcase) {
      // Could well be that the current user does not have the appropriate access
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire, "Could not acquire briefcase", Logger.logError, loggerCategory));
    }
    return briefcase;
  }

  /** Downloads the briefcase file */
  private static async downloadBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: Briefcase, seedPathname: string): Promise<void> {
    requestContext.enter();

    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.imodelClient.briefcases.download(requestContext, briefcase, seedPathname)
      .catch(async () => {
        requestContext.enter();
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload, "Could not download briefcase", Logger.logError, loggerCategory));
      });
  }

  /** Deletes a briefcase from the local disk (if it exists) */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseEntry) {
    assert(!briefcase.isOpen);
    const dirName = path.dirname(briefcase.pathname);
    if (BriefcaseManager.deleteFolderRecursive(dirName))
      Logger.logTrace(loggerCategory, "Deleted briefcase from local disk", () => briefcase.getDebugInfo());
  }

  /** Deletes change sets of an iModel from local disk */
  private static deleteChangeSetsFromLocalDisk(iModelId: string) {
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    if (BriefcaseManager.deleteFolderRecursive(changeSetsPath))
      Logger.logTrace(loggerCategory, "Deleted change sets from local disk", () => ({ iModelId, changeSetsPath }));
  }

  /** Deletes a briefcase from the IModelServer (if it exists) */
  private static async deleteBriefcaseFromServer(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry): Promise<void> {
    requestContext.enter();

    assert(!!briefcase.iModelId);
    if (briefcase.briefcaseId === BriefcaseId.Standalone)
      return;

    try {
      await BriefcaseManager.imodelClient.briefcases.get(requestContext, briefcase.iModelId, new BriefcaseQuery().byId(briefcase.briefcaseId));
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      return; // Briefcase does not exist on the hub, or cannot be accessed
    }

    try {
      await BriefcaseManager.imodelClient.briefcases.delete(requestContext, briefcase.iModelId, briefcase.briefcaseId);
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Deleted briefcase from the server", () => briefcase.getDebugInfo());
    } catch (err) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Could not delete the acquired briefcase", () => briefcase.getDebugInfo()); // Could well be that the current user does not have the appropriate access
    }
  }

  /** Deletes a briefcase from the cache (if it exists) */
  private static deleteBriefcaseFromCache(briefcase: BriefcaseEntry) {
    if (!BriefcaseManager._cache.findBriefcase(briefcase))
      return;

    BriefcaseManager._cache.deleteBriefcase(briefcase);
  }

  /** Deletes a briefcase, and releases its references in iModelHub if necessary */
  private static async deleteBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry): Promise<void> {
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Attempting to delete briefcase", () => briefcase.getDebugInfo());
    if (briefcase.isOpen)
      BriefcaseManager.closeBriefcase(briefcase, false);
    BriefcaseManager.deleteBriefcaseFromCache(briefcase);

    await BriefcaseManager.deleteBriefcaseFromServer(requestContext, briefcase);
    requestContext.enter();

    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
  }

  /** Get change sets in the specified range
   *  * Gets change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array
   */
  private static async getChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, includeDownloadLink: boolean, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    requestContext.enter();
    if (toChangeSetId === "" /* first version */ || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>();

    const query = new ChangeSetQuery();
    if (fromChangeSetId)
      query.fromId(fromChangeSetId);
    if (includeDownloadLink)
      query.selectDownloadUrl();
    const allChangeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelId, query);
    requestContext.enter();

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound, "Version not found", Logger.logWarning, loggerCategory));
  }

  private static wasChangeSetDownloaded(changeSet: ChangeSet, changeSetsPath: string): boolean {
    const pathname = path.join(changeSetsPath, changeSet.fileName!);

    // Was the file downloaded?
    if (!IModelJsFs.existsSync(pathname))
      return false;

    // Was the download complete?
    const actualFileSize: number = IModelJsFs.lstatSync(pathname)!.size;
    const expectedFileSize: number = +changeSet.fileSize!;
    if (actualFileSize === expectedFileSize)
      return true;

    Logger.logError(loggerCategory, `ChangeSet size ${actualFileSize} does not match the expected size ${expectedFileSize}. Deleting it so that it can be refetched`, () => (changeSet));
    try {
      IModelJsFs.unlinkSync(pathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete ChangeSet file at ${pathname}`);
    }
    return false;
  }

  private static async downloadChangeSetsInternal(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSets: ChangeSet[]): Promise<void> {
    requestContext.enter();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);

    const changeSetsToDownload = new Array<ChangeSet>();
    for (const changeSet of changeSets) {
      if (!BriefcaseManager.wasChangeSetDownloaded(changeSet, changeSetsPath))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      const perfLogger = new PerfLogger("BriefcaseManager.downloadChangeSets");
      try {
        await BriefcaseManager.imodelClient.changeSets.download(requestContext, changeSetsToDownload, changeSetsPath);
        requestContext.enter();
      } catch {
        requestContext.enter();
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload, "Could not download changesets", Logger.logError, loggerCategory));
      }
      perfLogger.dispose();
    }
  }

  /** Downloads change sets in the specified range.
   *  * Downloads change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array.
   */
  public static async downloadChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    requestContext.enter();

    const changeSets = await BriefcaseManager.getChangeSets(requestContext, iModelId, true /*includeDownloadLink*/, fromChangeSetId, toChangeSetId);
    requestContext.enter();
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await BriefcaseManager.downloadChangeSetsInternal(requestContext, iModelId, changeSets);
    requestContext.enter();

    return changeSets;
  }

  /** Open a standalone iModel from the local disk */
  public static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseEntry {
    if (BriefcaseManager._cache.findBriefcaseByToken(new IModelToken(pathname, undefined, undefined, undefined, openMode)))
      throw new IModelError(DbResult.BE_SQLITE_CANTOPEN, `Cannot open standalone iModel at ${pathname} again - it has already been opened once`, Logger.logError, loggerCategory);

    const nativeDb = new IModelHost.platform.DgnDb();

    const res = nativeDb.openIModelFile(pathname, openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, `Cannot open standalone iModel at ${pathname}`, Logger.logError, loggerCategory);

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

    const nativeDb = new IModelHost.platform.DgnDb();

    const res: DbResult = nativeDb.createStandaloneIModel(fileName, JSON.stringify(args));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, `Cannot open standalone iModel at ${fileName}`, Logger.logError, loggerCategory);

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
    BriefcaseManager.closeBriefcase(briefcase, true);
    if (BriefcaseManager._cache.findBriefcase(briefcase))
      BriefcaseManager._cache.deleteBriefcase(briefcase);
  }

  /** Delete closed briefcases */
  public static async deleteClosed(requestContext: AuthorizedClientRequestContext) {
    requestContext.enter();

    await BriefcaseManager.memoizedInitCache(requestContext);
    requestContext.enter();

    const briefcases = BriefcaseManager._cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => !briefcase.isOpen);
    for (const briefcase of briefcases) {
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
    }
  }

  /** Deletes a folder on disk. Does not throw any errors, but returns true
   * if the delete was successful.
   */
  private static deleteFolderRecursive(folderPath: string): boolean {
    if (!IModelJsFs.existsSync(folderPath))
      return true;

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
            Logger.logError(loggerCategory, `Cannot delete file ${curPath}`);
            throw error;
          }
        }
      }
      try {
        IModelJsFs.rmdirSync(folderPath);
      } catch (error) {
        Logger.logError(loggerCategory, `Cannot delete folder: ${folderPath}`);
        throw error;
      }
    } catch (error) {
    }

    return !IModelJsFs.existsSync(folderPath);
  }

  /** Purges the cache of briefcases - closes any open briefcases,
   *  releases any briefcases acquired from the hub, and deletes the cache
   *  directory.
   */
  public static async purgeCache(requestContext: AuthorizedClientRequestContext) {
    await BriefcaseManager.memoizedInitCache(requestContext);
    requestContext.enter();

    BriefcaseManager.closeAllBriefcases();
    await this.deleteClosed(requestContext);
    requestContext.enter();

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

  private static closeBriefcase(briefcase: BriefcaseEntry, raiseOnCloseEvent: boolean) {
    if (raiseOnCloseEvent)
      briefcase.onBeforeClose.raiseEvent(briefcase);
    assert(briefcase.isOpen, "Briefcase must be open for it to be closed");
    briefcase.nativeDb.closeIModel();
    briefcase.isOpen = false;
    briefcase.openParams = undefined;
    Logger.logTrace(loggerCategory, "Closed briefcase ", () => briefcase.getDebugInfo());
  }

  private static openBriefcase(requestContext: AuthorizedClientRequestContext, contextId: string, briefcase: BriefcaseEntry, openParams: OpenParams): void {
    if (briefcase.isOpen)
      throw new IModelError(IModelStatus.AlreadyOpen, `Briefcase ${briefcase.pathname} is already open.`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    briefcase.nativeDb = briefcase.nativeDb || new IModelHost.platform.DgnDb();

    const res: DbResult = BriefcaseManager.openDb(requestContext, briefcase.nativeDb!, contextId, briefcase.pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, `Cannot open briefcase at ${briefcase.pathname}`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    briefcase.openParams = openParams;
    briefcase.userId = requestContext.accessToken.getUserInfo()!.id;
    briefcase.isOpen = true;
  }

  private static async processChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, targetVersion: IModelVersion, requestedChangeSetOption?: ChangeSetApplyOption): Promise<void> {
    requestContext.enter();
    const perfLogger = new PerfLogger("BriefcaseManager.processChangeSets");

    if (!briefcase.nativeDb || !briefcase.isOpen)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    if (briefcase.openParams!.openMode !== OpenMode.ReadWrite)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    assert(briefcase.nativeDb.getParentChangeSetId() === briefcase.changeSetId, "Mismatch between briefcase and the native Db");
    if (briefcase.changeSetIndex === undefined)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot apply changes to a standalone file", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));

    const targetChangeSetId: string = await targetVersion.evaluateChangeSet(requestContext, briefcase.iModelId, BriefcaseManager.imodelClient);
    requestContext.enter();

    const targetChangeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, targetChangeSetId);
    requestContext.enter();

    if (typeof targetChangeSetIndex === "undefined")
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Could not determine change set information from the Hub", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));

    // Error check the requested change set option
    if (requestedChangeSetOption) {
      const currentChangeSetIndex: number = briefcase.currentChangeSetIndex;
      switch (requestedChangeSetOption) {
        case ChangeSetApplyOption.Merge:
          if (targetChangeSetIndex < currentChangeSetIndex)
            return Promise.reject(new IModelError(ChangeSetStatus.NothingToMerge, "Nothing to merge", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));
          break;
        case ChangeSetApplyOption.Reinstate:
          if (targetChangeSetIndex < currentChangeSetIndex)
            return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reinstate to an earlier version", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));
          break;
        case ChangeSetApplyOption.Reverse:
          if (targetChangeSetIndex >= currentChangeSetIndex)
            return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse to a later version", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));
          break;
        default:
          assert(false, "Unknown change set process option");
          return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Unknown ChangeSet process option", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));
      }
    }

    // Determine the reinstates, reversals or merges required
    let reverseToId: string | undefined, reinstateToId: string | undefined, mergeToId: string | undefined;
    let reverseToIndex: number | undefined, reinstateToIndex: number | undefined, mergeToIndex: number | undefined;
    if (briefcase.hasReversedChanges) {
      if (targetChangeSetIndex < briefcase.reversedChangeSetIndex!) {
        reverseToId = targetChangeSetId;
        reverseToIndex = targetChangeSetIndex;
      } else if (targetChangeSetIndex > briefcase.reversedChangeSetIndex!) {
        reinstateToId = targetChangeSetId;
        reinstateToIndex = targetChangeSetIndex;
        if (targetChangeSetIndex > briefcase.changeSetIndex!) {
          reinstateToId = briefcase.changeSetId;
          reinstateToIndex = briefcase.changeSetIndex;
          mergeToId = targetChangeSetId;
          mergeToIndex = targetChangeSetIndex;
        }
      }
    } else {
      if (targetChangeSetIndex < briefcase.changeSetIndex!) {
        reverseToId = targetChangeSetId;
        reverseToIndex = targetChangeSetIndex;
      } else if (targetChangeSetIndex > briefcase.changeSetIndex!) {
        mergeToId = targetChangeSetId;
        mergeToIndex = targetChangeSetIndex;
      }
    }

    // Reverse, reinstate and merge as necessary
    if (typeof reverseToId !== "undefined") {
      Logger.logTrace(loggerCategory, `Reversing briefcase to ${reverseToId}`, () => briefcase.getDebugInfo());
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, reverseToId, reverseToIndex!, ChangeSetApplyOption.Reverse);
      requestContext.enter();
      Logger.logTrace(loggerCategory, `Reversed briefcase to ${reverseToId}`, () => briefcase.getDebugInfo());
    }
    if (typeof reinstateToId !== "undefined") {
      Logger.logTrace(loggerCategory, `Reinstating briefcase to ${reinstateToId}`, () => briefcase.getDebugInfo());
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, reinstateToId, reinstateToIndex!, ChangeSetApplyOption.Reinstate);
      requestContext.enter();
      Logger.logTrace(loggerCategory, `Reinstated briefcase to ${reinstateToId}`, () => briefcase.getDebugInfo());
    }
    if (typeof mergeToId !== "undefined") {
      Logger.logTrace(loggerCategory, `Merging briefcase to ${mergeToId}`, () => briefcase.getDebugInfo());
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, mergeToId, mergeToIndex!, ChangeSetApplyOption.Merge);
      requestContext.enter();
      Logger.logTrace(loggerCategory, `Merged briefcase to ${mergeToId}`, () => briefcase.getDebugInfo());
    }
    perfLogger.dispose();
  }

  private static async applyChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, targetChangeSetId: string, targetChangeSetIndex: number, processOption: ChangeSetApplyOption): Promise<void> {
    requestContext.enter();

    const currentChangeSetId: string = briefcase.currentChangeSetId;
    const currentChangeSetIndex: number = briefcase.currentChangeSetIndex;

    if (targetChangeSetIndex === currentChangeSetIndex)
      return Promise.resolve(); // nothing to apply

    const reverse: boolean = (targetChangeSetIndex < currentChangeSetIndex);
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(requestContext, briefcase.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    requestContext.enter();
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
      return Promise.reject(new IModelError(status, "Error applying changesets", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));

    // Mark Db as reopened after merge (if there are schema changes)
    if (containsSchemaChanges)
      briefcase.isOpen = true;

    const oldKey = briefcase.getKey();
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
        return Promise.reject(new IModelError(BriefcaseStatus.CannotApplyChanges, "Unknown ChangeSet process option", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));
    }

    // Update cache if necessary
    if (BriefcaseManager._cache.findBriefcaseByKey(oldKey)) {
      BriefcaseManager._cache.deleteBriefcaseByKey(oldKey);
      BriefcaseManager._cache.addBriefcase(briefcase);
    }

    briefcase.onChangesetApplied.raiseEvent();
  }

  public static async reverseChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams!.accessMode === AccessMode.Shared)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changes when the Db allows shared access - open with AccessMode.Exclusive", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    return BriefcaseManager.processChangeSets(requestContext, briefcase, reverseToVersion);
  }

  public static async reinstateChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams!.accessMode === AccessMode.Shared)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot reinstate (or reverse) changes when the Db allows shared access - open with AccessMode.Exclusive", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(briefcase.changeSetId);
    return BriefcaseManager.processChangeSets(requestContext, briefcase, targetVersion);
  }

  /**
   * Pull and merge changes from the hub
   * @param requestContext The client request context
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   * @hidden
   */
  public static async pullAndMergeChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();
    await BriefcaseManager.updatePendingChangeSets(requestContext, briefcase);
    requestContext.enter();
    return BriefcaseManager.processChangeSets(requestContext, briefcase, mergeToVersion);
  }

  private static startCreateChangeSet(briefcase: BriefcaseEntry): ChangeSetToken {
    const res: IModelJsNative.ErrorStatusOrResult<ChangeSetStatus, string> = briefcase.nativeDb!.startCreateChangeSet();
    if (res.error)
      throw new IModelError(res.error.status, "Error in startCreateChangeSet", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
    return JSON.parse(res.result!);
  }

  private static finishCreateChangeSet(briefcase: BriefcaseEntry) {
    const status = briefcase.nativeDb!.finishCreateChangeSet();
    if (ChangeSetStatus.Success !== status)
      throw new IModelError(status, "Error in finishCreateChangeSet", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
  }

  private static abandonCreateChangeSet(briefcase: BriefcaseEntry) {
    briefcase.nativeDb!.abandonCreateChangeSet();
  }

  /** Get array of pending ChangeSet ids that need to have their codes updated */
  private static getPendingChangeSets(briefcase: BriefcaseEntry): string[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.getPendingChangeSets();
    if (res.error)
      throw new IModelError(res.error.status, "Error in getPendingChangeSets", Logger.logWarning, loggerCategory, () => briefcase.getDebugInfo());
    return JSON.parse(res.result!) as string[];
  }

  /** Add a pending ChangeSet before updating its codes */
  private static addPendingChangeSet(briefcase: BriefcaseEntry, changeSetId: string): void {
    const result = briefcase.nativeDb!.addPendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Error in addPendingChangeSet", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
  }

  /** Remove a pending ChangeSet after its codes have been updated */
  private static removePendingChangeSet(briefcase: BriefcaseEntry, changeSetId: string): void {
    const result = briefcase.nativeDb!.removePendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Error in removePendingChangeSet", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
  }

  /** Update codes for all pending ChangeSets */
  private static async updatePendingChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry): Promise<void> {
    requestContext.enter();

    let pendingChangeSets = BriefcaseManager.getPendingChangeSets(briefcase);
    if (pendingChangeSets.length === 0)
      return;

    pendingChangeSets = pendingChangeSets.slice(0, 100);

    const query = new ChangeSetQuery().filter(`$id+in+[${pendingChangeSets.map((value: string) => `'${value}'`).join(",")}]`).selectDownloadUrl();
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, briefcase.iModelId, query);
    requestContext.enter();

    await BriefcaseManager.downloadChangeSetsInternal(requestContext, briefcase.iModelId, changeSets);
    requestContext.enter();

    const changeSetTokens: ChangeSetToken[] = BriefcaseManager.buildChangeSetTokens(changeSets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));

    for (const token of changeSetTokens) {
      try {
        const codes = BriefcaseManager.extractCodesFromFile(briefcase, [token]);
        await BriefcaseManager.imodelClient.codes.update(requestContext, briefcase.iModelId, codes, { deniedCodes: true, continueOnConflict: true });
        requestContext.enter();
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
        code.codeSpecId = Id64.fromJSON(value.codeSpecId);
        code.briefcaseId = briefcase.briefcaseId;
        return code;
      }
      return value;
    }) as HubCode[];
  }

  /** Extracts codes from current ChangeSet */
  private static extractCodes(briefcase: BriefcaseEntry): HubCode[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodes();
    if (res.error)
      throw new IModelError(res.error.status, "Error in extractCodes", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Extracts codes from ChangeSet file */
  private static extractCodesFromFile(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[]): HubCode[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = briefcase.nativeDb!.extractCodesFromFile(JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status, "Error in extractCodesFromFile", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
    return BriefcaseManager.parseCodesFromJson(briefcase, res.result!);
  }

  /** Attempt to update codes without rejecting so pull wouldn't fail */
  private static async tryUpdatingCodes(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, changeSet: ChangeSet, relinquishCodesLocks: boolean): Promise<void> {
    requestContext.enter();

    // Add ChangeSet id, in case updating failed due to something else than conflicts
    BriefcaseManager.addPendingChangeSet(briefcase, changeSet.id!);

    let failedUpdating = false;
    try {
      await BriefcaseManager.imodelClient.codes.update(requestContext, briefcase.iModelId, BriefcaseManager.extractCodes(briefcase), { deniedCodes: true, continueOnConflict: true });
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      if (error instanceof ConflictingCodesError) {
        Logger.logError(loggerCategory, "Found conflicting codes when pushing briefcase changes", () => briefcase.getDebugInfo());
        briefcase.conflictError = error;
      } else {
        failedUpdating = true;
      }
    }

    // Cannot retry relinquishing later, ignore error
    try {
      if (relinquishCodesLocks) {
        await BriefcaseManager.imodelClient.codes.deleteAll(requestContext, briefcase.iModelId, briefcase.briefcaseId);
        requestContext.enter();

        await BriefcaseManager.imodelClient.locks.deleteAll(requestContext, briefcase.iModelId, briefcase.briefcaseId);
        requestContext.enter();
      }
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "`Relinquishing codes or locks has failed with: ${ error } `", () => briefcase.getDebugInfo());
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
      throw new IModelError(BentleyStatus.ERROR, "Cannot call createStandaloneChangeSet() when the briefcase is not standalone", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);
    BriefcaseManager.finishCreateChangeSet(briefcase);

    return changeSetToken;
  }

  /** Applies a change set to a standalone iModel */
  public static applyStandaloneChangeSets(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): ChangeSetStatus {
    if (!briefcase.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot call applyStandaloneChangeSets() when the briefcase is not standalone", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    return briefcase.nativeDb!.applyChangeSets(JSON.stringify(changeSetTokens), processOption);
  }

  /** Dumps a change set */
  public static dumpChangeSet(briefcase: BriefcaseEntry, changeSetToken: ChangeSetToken) {
    briefcase.nativeDb!.dumpChangeSet(JSON.stringify(changeSetToken));
  }

  /** Attempt to push a ChangeSet to iModel Hub */
  private static async pushChangeSet(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams!.syncMode !== SyncMode.PullAndPush) {
      throw new IModelError(BriefcaseStatus.CannotUpload, "Cannot push from an IModelDb that's opened PullOnly", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
    }

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);
    const changeSet = new ChangeSet();
    changeSet.briefcaseId = briefcase.briefcaseId;
    changeSet.id = changeSetToken.id;
    changeSet.parentId = changeSetToken.parentId;
    changeSet.changesType = changeSetToken.containsSchemaChanges ? ChangesType.Schema : ChangesType.Regular;
    changeSet.seedFileId = briefcase.fileId!;
    changeSet.fileSize = IModelJsFs.lstatSync(changeSetToken.pathname)!.size.toString();
    changeSet.description = description;
    if (changeSet.description.length >= 255) {
      Logger.logWarning(loggerCategory, "pushChanges - Truncating description to 255 characters. " + changeSet.description);
      changeSet.description = changeSet.description.slice(0, 254);
    }

    let postedChangeSet: ChangeSet | undefined;
    try {
      postedChangeSet = await BriefcaseManager.imodelClient.changeSets.create(requestContext, briefcase.iModelId, changeSet, changeSetToken.pathname);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      // If ChangeSet already exists, updating codes and locks might have timed out.
      if (!(error instanceof IModelHubError) || error.errorNumber !== IModelHubStatus.ChangeSetAlreadyExists) {
        return Promise.reject(error);
      }
    }

    await BriefcaseManager.tryUpdatingCodes(requestContext, briefcase, changeSet, relinquishCodesLocks);
    requestContext.enter();

    BriefcaseManager.finishCreateChangeSet(briefcase);

    const oldKey = briefcase.getKey();
    briefcase.changeSetId = postedChangeSet!.wsgId;
    briefcase.changeSetIndex = +postedChangeSet!.index!;

    // Update cache if necessary
    if (BriefcaseManager._cache.findBriefcaseByKey(oldKey)) {
      BriefcaseManager._cache.deleteBriefcaseByKey(oldKey);
      BriefcaseManager._cache.addBriefcase(briefcase);
    }
  }

  /** Attempt to pull merge and push once */
  private static async pushChangesOnce(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    await BriefcaseManager.pullAndMergeChanges(requestContext, briefcase, IModelVersion.latest());
    requestContext.enter();

    try {
      await BriefcaseManager.pushChangeSet(requestContext, briefcase, description, relinquishCodesLocks);
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      BriefcaseManager.abandonCreateChangeSet(briefcase);
      return Promise.reject(err);
    }
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
   * @param requestContext The client request context
   * @param briefcase Identifies the IModelDb that contains the pending changes.
   * @param description a description of the changeset that is to be pushed.
   * @param relinquishCodesLocks release locks held and codes reserved (but not used) after pushing?
   */
  public static async pushChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean = true): Promise<void> {
    requestContext.enter();
    for (let i = 0; i < 5; ++i) {
      let pushed: boolean = false;
      let error: any;
      try {
        await BriefcaseManager.pushChangesOnce(requestContext, briefcase, description, relinquishCodesLocks || false);
        requestContext.enter();
        pushed = true;
      } catch (err) {
        requestContext.enter();
        error = err;
      }
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
    return (this.imodelClient === undefined) || (this._imodelClient instanceof IModelBankClient);
  }

  /**
   * Create an iModel on iModelHub
   * @hidden
   */
  public static async create(requestContext: AuthorizedClientRequestContext, contextId: string, iModelName: string, args: CreateIModelProps): Promise<string> {
    requestContext.enter();
    if (this.isUsingIModelBankClient()) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot create an iModel in iModelBank. This is a iModelHub only operation", Logger.logError, loggerCategory, () => ({ contextId, iModelName }));
    }

    const hubIModel: HubIModel = await BriefcaseManager.imodelClient.iModels.create(requestContext, contextId, iModelName, undefined, args.rootSubject.description, undefined, 2 * 60 * 1000);
    requestContext.enter();

    return hubIModel.wsgId;
  }

  /** @hidden */
  // TODO: This should take contextId as an argument, so that we know which server (iModelHub or iModelBank) to use.
  public static async deleteAllBriefcases(requestContext: AuthorizedClientRequestContext, iModelId: GuidString) {
    requestContext.enter();
    if (BriefcaseManager.imodelClient === undefined)
      return;

    const promises = new Array<Promise<void>>();
    const briefcases = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId);
    requestContext.enter();

    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(BriefcaseManager.imodelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!).then(() => {
        requestContext.enter();
      }));
    });
    return Promise.all(promises);
  }

}

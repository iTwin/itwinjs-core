/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import {
  Briefcase as HubBriefcase, IModelHubClient, ConnectClient, ChangeSet,
  ChangesType, Briefcase, HubCode, IModelHubError, AuthorizedClientRequestContext, CheckpointQuery, Checkpoint,
  BriefcaseQuery, ChangeSetQuery, IModelQuery, ConflictingCodesError, IModelClient, HubIModel,
} from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/imodelbank/IModelBankClient";
import { AzureFileHandler, IOSAzureFileHandler } from "@bentley/imodeljs-clients-backend";
import { ChangeSetApplyOption, BeEvent, DbResult, OpenMode, assert, Logger, ChangeSetStatus, BentleyStatus, IModelHubStatus, PerfLogger, GuidString, Id64, IModelStatus } from "@bentley/bentleyjs-core";
import { BriefcaseStatus, IModelError, IModelVersion, IModelToken, CreateIModelProps } from "@bentley/imodeljs-common";
import { IModelJsNative } from "./IModelJsNative";
import { IModelDb, OpenParams, SyncMode } from "./IModelDb";
import { IModelHost, Platform } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import * as path from "path";
import * as glob from "glob";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The Id assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels
 * @public
 */
export class BriefcaseId {
  private _value: number;
  public static get Illegal(): number { return 0xffffffff; }
  /** @internal */
  public static get Master(): number { return 0; }
  /** @internal */
  public static get Standalone(): number { return 1; }
  /** @beta */
  public static get Snapshot(): number { return 1; }
  constructor(value?: number) { this._value = value === undefined ? BriefcaseId.Illegal : value; }
  public get value(): number { return this._value; }
  public toString(): string { return this._value.toString(); }
}

/** Option to keep briefcase when the imodel is closed
 * @public
 */
export enum KeepBriefcase {
  No = 0,
  Yes = 1,
}

/** A token that represents a ChangeSet
 * @internal
 */
export class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public containsSchemaChanges: boolean, public pushDate?: string) { }
}

/** Entry in the briefcase cache
 * @internal
 */
export class BriefcaseEntry {

  /** Constructor */
  public constructor(contextId: GuidString, iModelId: GuidString, targetChangeSetId: GuidString, pathname: string, openParams: OpenParams, briefcaseId: number) {
    this.contextId = contextId;
    this.iModelId = iModelId;
    this.targetChangeSetId = targetChangeSetId;
    this.pathname = pathname;
    this.openParams = openParams;
    this.briefcaseId = briefcaseId;
  }

  /** Id of the iModel - set to the DbGuid field in the briefcase, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId: GuidString;

  /** Absolute path where the briefcase is cached/stored */
  public pathname: string;

  /** Id of the last change set that was applied to the briefcase.
   * Set to an empty string if it is the initial version, or a standalone briefcase
   */
  public parentChangeSetId!: GuidString;

  /** Index of the last change set that was applied to the briefcase.
   * Only specified if the briefcase was acquired from the Hub.
   * Set to 0 if it is the initial version.
   */
  public parentChangeSetIndex?: number;

  /** Briefcase Id  */
  public briefcaseId: number;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen!: boolean;

  /** Promise that if specified, resolves when the briefcase is ready for use */
  public isPending: Promise<void> = Promise.resolve();

  /** In-memory handle of the native Db */
  private _nativeDb!: IModelJsNative.DgnDb;
  public get nativeDb(): IModelJsNative.DgnDb { return this._nativeDb; }

  /** Params used to open the briefcase */
  public openParams: OpenParams;

  /** Id of the last change set that was applied to the briefcase after it was reversed.
   * Undefined if no change sets have been reversed.
   * Set to empty string if reversed to the first version.
   */
  public reversedChangeSetId?: GuidString;

  /** Index of the last change set that was applied to the briefcase after it was reversed.
   * Undefined if no change sets have been reversed
   * Set to 0 if the briefcase has been reversed to the first version
   */
  public reversedChangeSetIndex?: number;

  /** ChangeSet id that the briefcase eventually needs to be set to
   * currentChangeSetId may not match this if the briefcase is being prepared for use
   */
  public targetChangeSetId: string;

  /** Change set index that the briefcase needs to be set to
   * currentChangeSetIndex may not match this if the briefcase is being prepared for use
   */
  public targetChangeSetIndex?: number;

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
  public contextId: string;

  /** Event called after a changeset is applied to a briefcase.
   * @internal
   */
  public readonly onChangesetApplied = new BeEvent<() => void>();

  /** Event called when the briefcase is about to be closed
   * @internal
   */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Event called when the version of the briefcase has been updated
   * @internal
   */
  public readonly onBeforeVersionUpdate = new BeEvent<() => void>();

  /** Gets the path key to be used in the cache and iModelToken */
  public getKey(): string {
    if (this.openParams.isStandalone)
      return this.pathname;

    if (this.openParams.syncMode === SyncMode.FixedVersion)
      return `${this.iModelId}:${this.targetChangeSetId}`;

    return `${this.iModelId}:${this.briefcaseId}`;
  }

  /** Gets the current changeSetId of the briefcase
   * @note This may not be the changeSetId if the briefcase has reversed changes
   * @internal
   */
  public get currentChangeSetId(): GuidString {
    return (typeof this.reversedChangeSetId !== "undefined") ? this.reversedChangeSetId : this.parentChangeSetId;
  }

  /** Gets the current changeSetIndex of the briefcase
   * @note This may not be the changeSetIndex if the briefcase has reversed changes
   * @internal
   */
  public get currentChangeSetIndex(): number {
    return (typeof this.reversedChangeSetIndex !== "undefined") ? this.reversedChangeSetIndex! : this.parentChangeSetIndex!;
  }

  /** Returns true if the briefcase has reversed changes
   * @internal
   */
  public get hasReversedChanges(): boolean {
    return typeof this.reversedChangeSetId !== "undefined";
  }

  /** Get debug information on this briefcase
   * @internal
   */
  public getDebugInfo(): any {
    return {
      key: this.getKey(),
      contextId: this.contextId,
      iModelId: this.iModelId,
      pathname: this.pathname.replace(/\\/g, "/"),
      isOpen: this.isOpen,
      targetChangeSetId: this.targetChangeSetId,
      targetChangeSetIndex: this.targetChangeSetIndex,
      parentChangeSetId: this.parentChangeSetId,
      parentChangeSetIndex: this.parentChangeSetIndex,
      reversedChangeSetId: this.reversedChangeSetId,
      reversedChangeSetIndex: this.reversedChangeSetIndex,
      currentChangeSetId: this.currentChangeSetId,
      currentChangeSetIndex: this.currentChangeSetIndex,
    };
  }

  /** Set the native db */
  public setNativeDb(nativeDb: IModelJsNative.DgnDb) {
    this._nativeDb = nativeDb;
    this.parentChangeSetId = nativeDb.getParentChangeSetId();
    this.reversedChangeSetId = nativeDb.getReversedChangeSetId();
    this.briefcaseId = nativeDb.getBriefcaseId();
    this.isOpen = nativeDb.isOpen();
  }

}

/**
 * Type of method to unlock the held mutex
 * @see [[Mutex]]
 * @internal
 */
export type UnlockFnType = () => void;

/**
 * Utility to ensure a block of async code executes atomically.
 * Even if JavaScript precludes the possibility of race conditions between threads, there is potential for
 * race conditions with async code. This utility is needed in cases where a blocks of async code needs to run
 * to completion before another block is started.
 * This utility was based on this article: https://spin.atomicobject.com/2018/09/10/javascript-concurrency/
 * @internal
 */
export class Mutex {
  private _mutex = Promise.resolve();

  public async lock(): Promise<UnlockFnType> {
    /**
     * Note: The promise returned by this method will resolve (with the unlock function, which is actually the
     * mutex’s then’s resolve function) once any previous mutexes have finished and called their
     * respective unlock function that was yielded over their promise.
     */
    let begin: (unlock: UnlockFnType) => void = (_unlock) => { };

    this._mutex = this._mutex.then(async (): Promise<void> => {
      return new Promise(begin);
    });

    return new Promise((res) => {
      begin = res;
    });
  }
}

/** In-memory cache of briefcases
 * @internal
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

  /** Find read only briefcase */
  public findFixedVersionBriefcase(iModelId: GuidString, changeSetId: GuidString): BriefcaseEntry | undefined {
    for (const entry of this._briefcases.values()) {
      if (entry.iModelId === iModelId && entry.targetChangeSetId === changeSetId && entry.openParams.syncMode === SyncMode.FixedVersion)
        return entry;
    }
    return undefined;
  }

  /** Find read only briefcase */
  public findPullAndPushBriefcase(iModelId: GuidString, briefcaseId: number): BriefcaseEntry | undefined {
    for (const entry of this._briefcases.values()) {
      if (entry.iModelId === iModelId && entry.briefcaseId === briefcaseId && entry.openParams.syncMode === SyncMode.PullAndPush)
        return entry;
    }
    return undefined;
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

/** Utility to manage briefcases
 * @internal
 */
export class BriefcaseManager {
  private static _cache: BriefcaseCache = new BriefcaseCache();
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
  private static _firstChangeSetDir: string = "first";

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

  private static getFixedVersionBriefcasePath(iModelId: GuidString) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc", "FixedVersion");
  }

  private static getPullAndPushBriefcasePath(iModelId: GuidString) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc", "PullAndPush");
  }

  private static buildFixedVersionBriefcasePath(iModelId: GuidString, changeSetId: GuidString, iModelName: string): string {

    const pathBaseName: string = BriefcaseManager.getFixedVersionBriefcasePath(iModelId);
    return path.join(pathBaseName, changeSetId || this._firstChangeSetDir, iModelName.concat(".bim"));
  }

  private static buildPullAndPushBriefcasePath(iModelId: GuidString, briefcaseId: number, iModelName: string): string {
    const pathBaseName: string = BriefcaseManager.getPullAndPushBriefcasePath(iModelId);
    return path.join(pathBaseName, briefcaseId.toString(), iModelName.concat(".bim"));
  }

  private static async getIModelName(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString): Promise<string> {
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, contextId, new IModelQuery().byId(iModelId));
    if (iModels.length === 0)
      throw new IModelError(IModelStatus.NotFound, "iModel with specified id was not found", Logger.logError, loggerCategory, () => ({ contextId, iModelId }));
    return iModels[0].name!;
  }

  private static findFixedVersionBriefcaseInCache(iModelId: GuidString, changeSetId: string): BriefcaseEntry | undefined {
    return this._cache.findFixedVersionBriefcase(iModelId, changeSetId);
  }

  private static openFixedVersionBriefcaseOnDisk(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, iModelName: string): BriefcaseEntry | undefined {
    const pathname = this.buildFixedVersionBriefcasePath(iModelId, changeSetId, iModelName);
    if (!IModelJsFs.existsSync(pathname))
      return;
    const briefcase = this.openBriefcase(requestContext, contextId, iModelId, changeSetId, pathname, OpenParams.fixedVersion(), BriefcaseId.Standalone);
    return briefcase;
  }

  private static openPullAndPushBriefcaseOnDisk(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, hubBriefcases: HubBriefcase[], iModelName: string): BriefcaseEntry | undefined {
    for (const hubBriefcase of hubBriefcases) {
      const pathname = this.buildPullAndPushBriefcasePath(iModelId, hubBriefcase.briefcaseId!, iModelName);
      if (!IModelJsFs.existsSync(pathname))
        continue;
      const briefcase = this.openBriefcase(requestContext, contextId, iModelId, changeSetId, pathname, OpenParams.pullAndPush(), hubBriefcase.briefcaseId!);
      return briefcase;
    }
    return undefined;
  }

  private static findPullAndPushBriefcaseInCache(iModelId: GuidString, hubBriefcases: HubBriefcase[]): BriefcaseEntry | undefined {
    for (const hubBriefcase of hubBriefcases) {
      const briefcase = this._cache.findPullAndPushBriefcase(iModelId, hubBriefcase.briefcaseId!);
      if (briefcase)
        return briefcase;
    }
    return undefined;
  }

  /** Clear the briefcase manager cache */
  private static clearCache() {
    BriefcaseManager._cache.clear();
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

  private static readonly _cacheMajorVersion: number = 2;
  private static readonly _cacheMinorVersion: number = 0;

  private static buildCacheSubDir(): string {
    return `v${BriefcaseManager._cacheMajorVersion}_${BriefcaseManager._cacheMinorVersion}`;
  }

  private static findCacheSubDir(): string | undefined {
    if (!IModelHost.configuration || !IModelHost.configuration.briefcaseCacheDir) {
      assert(false, "Cache directory undefined");
      return undefined;
    }
    const cacheRootDir = IModelHost.configuration.briefcaseCacheDir;
    let dirs: string[] | undefined;
    try {
      dirs = glob.sync(`v${BriefcaseManager._cacheMajorVersion}_*`, { cwd: cacheRootDir });
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
      // For now, just recreate the entire cache if the directory for the major version is not found
      BriefcaseManager.deleteFolderRecursive(IModelHost.configuration!.briefcaseCacheDir!);
    } else if (cacheSubDirOnDisk !== cacheSubDir) {
      const cacheDirOnDisk = path.join(IModelHost.configuration!.briefcaseCacheDir!, cacheSubDirOnDisk);
      BriefcaseManager.deleteFolderRecursive(cacheDirOnDisk);
    }

    if (!IModelJsFs.existsSync(cacheDir))
      BriefcaseManager.makeDirectoryRecursive(cacheDir);

    BriefcaseManager._cacheDir = cacheDir;
  }

  /** Get the index of the change set from its id */
  private static async getChangeSetIndexFromId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSetId: GuidString): Promise<number> {
    requestContext.enter();
    if (changeSetId === "")
      return 0; // the first version

    const changeSet: ChangeSet = (await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
    requestContext.enter();

    return +changeSet.index!;
  }

  private static _mutex = new Mutex();

  /** Open a briefcase */
  public static async open(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, openParams: OpenParams, version: IModelVersion): Promise<BriefcaseEntry> {
    requestContext.enter();

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, BriefcaseManager.imodelClient);
    requestContext.enter();

    if (openParams.openMode === OpenMode.Readonly)
      return this.openFixedVersion(requestContext, contextId, iModelId, changeSetId);

    const unlock = await this._mutex.lock();
    try {
      // Note: It's important that the code below is called only once at a time - see docs with the method for more info
      return await this.openPullAndPush(requestContext, contextId, iModelId, changeSetId);
    } finally {
      unlock();
    }
  }

  private static async openFixedVersion(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString): Promise<BriefcaseEntry> {
    requestContext.enter();

    // Get the name of the iModel (briefcase) to be able to locate or create it on local disk
    const iModelName = await BriefcaseManager.getIModelName(requestContext, contextId, iModelId);
    requestContext.enter();

    /*
     * Note: It's important that there are no await-s between cache lookup and cache update!!
     *                 -- so the calls below should be kept synchronous --
     */

    // Find briefcase in cache, or add a new entry
    const cachedBriefcase = this.findFixedVersionBriefcaseInCache(iModelId, changeSetId);
    if (cachedBriefcase) {
      Logger.logTrace(loggerCategory, "BriefcaseManager.openFixedVersion - found briefcase in cache", () => cachedBriefcase.getDebugInfo());
      return cachedBriefcase;
    }

    // Find matching briefcase on disk if available (and add it to the cache)
    const diskBriefcase = this.openFixedVersionBriefcaseOnDisk(requestContext, contextId, iModelId, changeSetId, iModelName);
    if (diskBriefcase) {
      Logger.logTrace(loggerCategory, "BriefcaseManager.openFixedVersion - opening briefcase from disk", () => diskBriefcase.getDebugInfo());
      return diskBriefcase;
    }

    // Create a new briefcase (and it to the cache)
    const newBriefcase = this.createFixedVersionBriefcase(requestContext, contextId, iModelId, changeSetId, iModelName);
    Logger.logTrace(loggerCategory, "BriefcaseManager.openFixedVersion - creating a new briefcase", () => newBriefcase.getDebugInfo());
    return newBriefcase;
  }

  /** Open (or create) a briefcase for pull and push workflows
   * Note: It's important that this method ibe made atomic - i.e., there should never be a case where there are two asynchronous calls to this method
   * being processed at the same time. Otherwise there may be multiple briefcases that are acquired and downloaded for the same user.
   */
  private static async openPullAndPush(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString): Promise<BriefcaseEntry> {
    requestContext.enter();

    const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    requestContext.enter();

    // Get the name of the iModel (briefcase) to be able to locate or create it on local disk
    const iModelName = await BriefcaseManager.getIModelName(requestContext, contextId, iModelId);
    requestContext.enter();

    if (hubBriefcases.length > 0) {
      /** Find any of the briefcases in cache */
      const cachedBriefcase = this.findPullAndPushBriefcaseInCache(iModelId, hubBriefcases);
      if (cachedBriefcase) {
        Logger.logTrace(loggerCategory, "BriefcaseManager.openPullAndPush - found briefcase in cache", () => cachedBriefcase.getDebugInfo());
        return cachedBriefcase;
      }

      /** Find matching briefcase on disk if available(and add it to the cache) */
      const diskBriefcase = this.openPullAndPushBriefcaseOnDisk(requestContext, contextId, iModelId, changeSetId, hubBriefcases, iModelName);
      if (diskBriefcase) {
        Logger.logTrace(loggerCategory, "BriefcaseManager.openPullAndPush - opening briefcase from disk", () => diskBriefcase.getDebugInfo());
        return diskBriefcase;
      }
    }

    /** Create a new briefcase(and add it to the cache) */
    // Acquire a briefcase if necessary
    const hubBriefcase = hubBriefcases.length > 0 ? hubBriefcases[0] : await BriefcaseManager.acquireBriefcase(requestContext, iModelId);
    requestContext.enter();

    // Set up the briefcase and add it to the cache
    const newBriefcase = this.createPullAndPushBriefcase(requestContext, contextId, iModelId, changeSetId, iModelName, hubBriefcase.briefcaseId!);
    Logger.logTrace(loggerCategory, "BriefcaseManager.openPullAndPush - creating a new briefcase", () => newBriefcase.getDebugInfo());
    return newBriefcase;
  }

  private static openBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, pathname: string, openParams: OpenParams, briefcaseId: number): BriefcaseEntry | undefined {
    const nativeDb = new IModelHost.platform.DgnDb();
    const res = nativeDb.openIModel(pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, `Cannot open briefcase at ${pathname}`, Logger.logError, loggerCategory, () => ({ iModelId, pathname, openParams }));

    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, openParams, briefcaseId);
    briefcase.setNativeDb(nativeDb); // Note: Sets briefcaseId, currentChangeSetId in BriefcaseEntry by reading the values from nativeDb
    assert(briefcase.isOpen);

    // Validate the briefcase
    let isValidBriefcase: boolean = true;
    if (briefcase.currentChangeSetId !== briefcase.targetChangeSetId) {
      if (openParams.syncMode === SyncMode.FixedVersion) {
        Logger.logError(loggerCategory, "Briefcase found is invalid (is not of required version). Deleting it to allow retries", () => briefcase.getDebugInfo());
        isValidBriefcase = false;
      } else {
        Logger.logWarning(loggerCategory, "Briefcase found is not of required version. Ignoring required version", () => briefcase.getDebugInfo());
      }
    }
    if (briefcase.briefcaseId !== briefcaseId) {
      Logger.logError(loggerCategory, "Briefcase found is invalid (does not have the expected briefcase id). Deleting it to allow retries", () => ({ expectedBriefcaseId: briefcaseId, ...briefcase.getDebugInfo() }));
      isValidBriefcase = false;
    }
    if (!isValidBriefcase) {
      BriefcaseManager.closeBriefcase(briefcase, false);
      BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
      return undefined;
    }

    const cachedBriefcase = this._cache.findBriefcase(briefcase);
    if (cachedBriefcase) {
      // TODO: Turn this into an assertion, after ensuring this doesn't happen in deployments
      Logger.logError(loggerCategory, "Attempting to open and/or create briefcase twice", () => briefcase.getDebugInfo());
      return cachedBriefcase;
    }
    BriefcaseManager._cache.addBriefcase(briefcase);
    briefcase.isPending = this.finishOpenBriefcase(requestContext, briefcase);
    return briefcase;
  }

  private static async finishOpenBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry) {
    requestContext.enter();
    try {
      await this.initBriefcaseFromHub(requestContext, briefcase);
      requestContext.enter();
    } catch (error) {
      Logger.logError(loggerCategory, "Opening up a briefcase fails. Deleting it to allow retries", () => briefcase.getDebugInfo());
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
    }
  }

  private static async initBriefcaseFromHub(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry) {
    requestContext.enter();

    briefcase.targetChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.targetChangeSetId);
    requestContext.enter();

    briefcase.parentChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.parentChangeSetId);
    requestContext.enter();

    briefcase.reversedChangeSetIndex = (typeof briefcase.reversedChangeSetId === "undefined") ? undefined : await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.reversedChangeSetId);
    requestContext.enter();

    if (briefcase.briefcaseId !== BriefcaseId.Standalone) {
      const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, briefcase.iModelId, new BriefcaseQuery().byId(briefcase.briefcaseId));
      requestContext.enter();
      if (hubBriefcases.length === 0)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unable to find briefcase on the Hub (for the current user)`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
      briefcase.fileId = hubBriefcases[0].fileId!.toString();
    }
  }

  private static createFixedVersionBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, iModelName: string): BriefcaseEntry {
    const pathname = this.buildFixedVersionBriefcasePath(iModelId, changeSetId, iModelName);
    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, OpenParams.fixedVersion(), BriefcaseId.Standalone);

    briefcase.isPending = this.finishCreateBriefcase(requestContext, briefcase);

    const cachedBriefcase = this._cache.findBriefcase(briefcase);
    if (cachedBriefcase) {
      // TODO: Turn this into an assertion, after ensuring this doesn't happen in deployments
      Logger.logError(loggerCategory, "Attempting to open and/or create briefcase twice", () => briefcase.getDebugInfo());
      return cachedBriefcase;
    }
    BriefcaseManager._cache.addBriefcase(briefcase);

    return briefcase;
  }

  private static createPullAndPushBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, iModelName: string, briefcaseId: number): BriefcaseEntry {
    const pathname = this.buildPullAndPushBriefcasePath(iModelId, briefcaseId, iModelName);
    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, OpenParams.pullAndPush(), briefcaseId);

    briefcase.isPending = this.finishCreateBriefcase(requestContext, briefcase);

    assert(!this._cache.findBriefcase(briefcase), "Attempting to open or create briefcase twice");
    BriefcaseManager._cache.addBriefcase(briefcase);

    return briefcase;
  }

  private static async finishCreateBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry): Promise<void> {
    requestContext.enter();

    try {
      // Download checkpoint
      let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
      checkpointQuery = (briefcase.openParams.syncMode === SyncMode.FixedVersion) ? checkpointQuery.nearestCheckpoint(briefcase.targetChangeSetId) : checkpointQuery.precedingCheckpoint(briefcase.targetChangeSetId);
      const checkpoints: Checkpoint[] = await BriefcaseManager.imodelClient.checkpoints.get(requestContext, briefcase.iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length === 0)
        throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
      const checkpoint = checkpoints[0];
      if (checkpoint.fileId)
        briefcase.fileId = checkpoint.fileId.toString();
      await BriefcaseManager.downloadCheckpoint(requestContext, checkpoint, briefcase.pathname);
      requestContext.enter();

      // Open checkpoint
      const nativeDb = new IModelHost.platform.DgnDb();
      let res: DbResult = nativeDb.openIModel(briefcase.pathname, OpenMode.ReadWrite);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable to open Db", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));
      assert(nativeDb.getParentChangeSetId() === checkpoint.mergedChangeSetId);

      // Setup briefcase
      // TODO: Only need to setup briefcase id for the ReadWrite case after the hub properly sets up these checkpoints
      const perfLogger = new PerfLogger("Opening iModel - setting up context/iModel/briefcase ids", () => briefcase.getDebugInfo());
      res = nativeDb.saveProjectGuid(briefcase.contextId);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable to save context id", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));
      res = nativeDb.setDbGuid(briefcase.iModelId);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable to setup iModel id", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));
      res = nativeDb.setBriefcaseId(briefcase.briefcaseId);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable to setup briefcase id", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));

      perfLogger.dispose();
      briefcase.setNativeDb(nativeDb);
      await this.initBriefcaseFromHub(requestContext, briefcase);

      // Apply change sets if necessary
      if (briefcase.currentChangeSetId !== briefcase.targetChangeSetId) {
        const backupOpenParams = briefcase.openParams;
        if (briefcase.openParams.openMode !== OpenMode.ReadWrite)
          briefcase.openParams = new OpenParams(OpenMode.ReadWrite, backupOpenParams.syncMode); // Set briefcase to rewrite to be able to process change sets
        await BriefcaseManager.processChangeSets(requestContext, briefcase, briefcase.targetChangeSetId, briefcase.targetChangeSetIndex!);
        requestContext.enter();
        briefcase.openParams = backupOpenParams;
      }

      // Reopen the iModel file if the briefcase hasn't been opened with the required OpenMode
      if (briefcase.openParams.openMode !== OpenMode.ReadWrite) {
        briefcase.nativeDb!.closeIModel();
        res = briefcase.nativeDb!.openIModel(briefcase.pathname, briefcase.openParams.openMode);
        if (DbResult.BE_SQLITE_OK !== res)
          throw new IModelError(res, `Unable to reopen briefcase at ${briefcase.pathname}`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
      }
    } catch (error) {
      Logger.logError(loggerCategory, "Setting up a briefcase fails. Deleting it to allow retries", () => briefcase.getDebugInfo());
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();

      if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
        Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them to enable retries", () => briefcase.getDebugInfo());
        BriefcaseManager.deleteChangeSetsFromLocalDisk(briefcase.iModelId);
      }
      throw error;
    }
  }

  /** Close a briefcase, and delete from the hub if necessary */
  public static async close(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, keepBriefcase: KeepBriefcase): Promise<void> {
    requestContext.enter();
    assert(!briefcase.openParams.isStandalone, "Cannot use IModelDb.close() to close a standalone iModel. Use IModelDb.closeStandalone() instead");
    BriefcaseManager.closeBriefcase(briefcase, true);
    if (keepBriefcase === KeepBriefcase.No) {
      await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
    }
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

  /** Downloads the checkpoint file */
  private static async downloadCheckpoint(requestContext: AuthorizedClientRequestContext, checkpoint: Checkpoint, seedPathname: string): Promise<void> {
    requestContext.enter();
    if (IModelJsFs.existsSync(seedPathname))
      return;
    return BriefcaseManager.imodelClient.checkpoints.download(requestContext, checkpoint, seedPathname)
      .catch(async () => {
        requestContext.enter();
        throw new IModelError(BriefcaseStatus.CannotDownload, "Could not download checkpoint", Logger.logError, loggerCategory);
      });
  }

  /** Deletes a briefcase from the local disk (if it exists) */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseEntry) {
    if (briefcase.isOpen) {
      Logger.logError(loggerCategory, "Cannot delete an open briefcase from local disk", () => briefcase.getDebugInfo());
      return;
    }
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
    if (!briefcase.iModelId) {
      Logger.logError(loggerCategory, "Briefcase with invalid iModelId detected", () => briefcase.getDebugInfo());
      return;
    }

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
    Logger.logTrace(loggerCategory, "Started deleting briefcase", () => briefcase.getDebugInfo());
    BriefcaseManager.closeBriefcase(briefcase, false);
    BriefcaseManager.deleteBriefcaseFromCache(briefcase);
    await BriefcaseManager.deleteBriefcaseFromServer(requestContext, briefcase);
    requestContext.enter();
    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
    Logger.logTrace(loggerCategory, "Finished deleting briefcase", () => briefcase.getDebugInfo());
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

    const perfLogger = new PerfLogger("BriefcaseManager.downloadChangeSets", () => ({ iModelId, count: changeSets.length }));
    for (const changeSet of changeSets) {
      if (BriefcaseManager.wasChangeSetDownloaded(changeSet, changeSetsPath))
        continue;
      try {
        const changeSetsToDownload = new Array<ChangeSet>(changeSet);
        await BriefcaseManager.imodelClient.changeSets.download(requestContext, changeSetsToDownload, changeSetsPath);
        requestContext.enter();
      } catch {
        requestContext.enter();
        // Note: If the cache was shared across processes, it's possible that the download was completed by another process
        if (BriefcaseManager.wasChangeSetDownloaded(changeSet, changeSetsPath))
          continue;
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload, "Could not download changesets", Logger.logError, loggerCategory));
      }
    }
    perfLogger.dispose();
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

    const res = nativeDb.openIModel(pathname, openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, "Could not open standalone iModel", Logger.logError, loggerCategory, () => ({ pathname }));

    let briefcaseId: number = nativeDb.getBriefcaseId();
    if (enableTransactions) {
      if (briefcaseId === BriefcaseId.Illegal || briefcaseId === BriefcaseId.Master) {
        briefcaseId = BriefcaseId.Standalone;
        nativeDb.setBriefcaseId(briefcaseId);
      }
      assert(nativeDb.getBriefcaseId() !== BriefcaseId.Illegal || nativeDb.getBriefcaseId() !== BriefcaseId.Master);
    }

    const briefcase = new BriefcaseEntry("", nativeDb.getDbGuid(), nativeDb.getParentChangeSetId(), pathname, OpenParams.standalone(openMode), briefcaseId);
    briefcase.setNativeDb(nativeDb);

    BriefcaseManager._cache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Create a standalone iModel from the local disk */
  public static createStandalone(fileName: string, args: CreateIModelProps): BriefcaseEntry {
    if (BriefcaseManager._cache.findBriefcaseByToken(new IModelToken(fileName, undefined, undefined, undefined, OpenMode.ReadWrite)))
      throw new IModelError(DbResult.BE_SQLITE_ERROR_FileExists, "Could not create standalone iModel. File already exists", Logger.logError, loggerCategory, () => ({ fileName }));

    const nativeDb = new IModelHost.platform.DgnDb();

    let res: DbResult = nativeDb.createStandaloneIModel(fileName, JSON.stringify(args));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, "Could not create standalone iModel", Logger.logError, loggerCategory, () => ({ fileName }));

    res = nativeDb.setBriefcaseId(BriefcaseId.Standalone);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, "Could not set briefcaseId for standalone iModel", Logger.logError, loggerCategory, () => ({ fileName }));

    const briefcase = new BriefcaseEntry("", nativeDb.getDbGuid(), "", fileName, OpenParams.standalone(OpenMode.ReadWrite), BriefcaseId.Standalone);
    briefcase.setNativeDb(nativeDb);
    BriefcaseManager._cache.addBriefcase(briefcase);
    return briefcase;
  }

  /** Close the standalone briefcase */
  public static closeStandalone(briefcase: BriefcaseEntry) {
    assert(briefcase.openParams.isStandalone, "Can use IModelDb.closeStandalone() only to close a standalone iModel. Use IModelDb.close() instead");
    BriefcaseManager.closeBriefcase(briefcase, true);
    if (BriefcaseManager._cache.findBriefcase(briefcase))
      BriefcaseManager._cache.deleteBriefcase(briefcase);
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

  /** Purges the in-memory and disk caches -
   * * Closes any open briefcases.
   * * Deletes all briefcases (ignores ones that are locked by other processes).
   * * Releases any deleted briefcases acquired from the hub (by the supplied user).
   * * Removes the iModelDirectory if the aren't any briefcases left.
   */
  public static async purgeCache(requestContext: AuthorizedClientRequestContext) {
    await this.purgeInMemoryCache(requestContext);
    await this.purgeDiskCache(requestContext);
  }

  /** Purges the disk cache for a specific iModel starting with the briefcases.
   * Returns true if successful in deleting the entire folder, and false otherwise
   */
  private static async purgeDiskCacheForIModel(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<boolean> {
    requestContext.enter();

    const fixedVersionPath = this.getFixedVersionBriefcasePath(iModelId);
    let deletedFixedVersionBriefcases = true;
    if (IModelJsFs.existsSync(fixedVersionPath)) {
      for (const csetId of IModelJsFs.readdirSync(fixedVersionPath)) {
        const briefcaseDir = path.join(fixedVersionPath, csetId);
        try {
          this.deleteFolderRecursive(briefcaseDir);
        } catch (_error) {
          deletedFixedVersionBriefcases = false;
          continue;
        }
      }
      if (deletedFixedVersionBriefcases)
        this.deleteFolderRecursive(fixedVersionPath);
    }

    const pullAndPushPath = this.getPullAndPushBriefcasePath(iModelId);
    let deletedPullAndPushBriefcases = true;
    if (IModelJsFs.existsSync(pullAndPushPath)) {
      for (const bIdString of IModelJsFs.readdirSync(pullAndPushPath)) {
        const briefcaseId = +bIdString;
        try {
          await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcaseId));
          requestContext.enter();
          await BriefcaseManager.imodelClient.briefcases.delete(requestContext, iModelId, briefcaseId);
          requestContext.enter();
        } catch (error) {
          deletedPullAndPushBriefcases = false;
          continue;
        }
      }
      if (deletedPullAndPushBriefcases)
        this.deleteFolderRecursive(pullAndPushPath);
    }

    if (!deletedFixedVersionBriefcases || !deletedPullAndPushBriefcases)
      return false; // Don't do additional deletes - the folders are being used

    const iModelPath = this.getIModelPath(iModelId);
    try {
      this.deleteFolderRecursive(iModelPath);
    } catch (error) {
      return false;
    }

    return true;
  }

  /** Purges the cached briefcase, changeset and other files on disk */
  private static async purgeDiskCache(requestContext: AuthorizedClientRequestContext): Promise<boolean> {
    let deletedAllCacheDirs = true;
    for (const iModelId of IModelJsFs.readdirSync(BriefcaseManager.cacheDir)) {
      const deleted = await this.purgeDiskCacheForIModel(requestContext, iModelId);
      if (!deleted)
        deletedAllCacheDirs = false;
    }
    if (deletedAllCacheDirs) {
      this.deleteFolderRecursive(IModelHost.configuration!.briefcaseCacheDir);
    }
    return deletedAllCacheDirs;
  }

  /** Purge in-memory cache of briefcases */
  private static async purgeInMemoryCache(requestContext: AuthorizedClientRequestContext) {
    this.closeAllBriefcases();
    await this.deleteClosed(requestContext);
    requestContext.enter();
    this.clearCache();
  }

  /** Delete closed briefcases */
  private static async deleteClosed(requestContext: AuthorizedClientRequestContext) {
    requestContext.enter();
    const briefcases = this._cache.getFilteredBriefcases((briefcase: BriefcaseEntry) => !briefcase.isOpen);
    for (const briefcase of briefcases) {
      await this.deleteBriefcase(requestContext, briefcase);
      requestContext.enter();
    }
  }

  /** Find the existing briefcase */
  public static findBriefcaseByToken(iModelToken: IModelToken): BriefcaseEntry | undefined {
    return this._cache.findBriefcaseByToken(iModelToken);
  }

  private static closeBriefcase(briefcase: BriefcaseEntry, raiseOnCloseEvent: boolean) {
    if (!briefcase.isOpen) {
      Logger.logTrace(loggerCategory, "Briefcase already closed", () => briefcase.getDebugInfo());
      return;
    }
    if (raiseOnCloseEvent)
      briefcase.onBeforeClose.raiseEvent(briefcase);
    briefcase.nativeDb.closeIModel();
    briefcase.isOpen = false;
    if (BriefcaseManager._cache.findBriefcase(briefcase))
      BriefcaseManager._cache.deleteBriefcase(briefcase);
    Logger.logTrace(loggerCategory, "Closed briefcase ", () => briefcase.getDebugInfo());
  }

  private static async evaluateVersion(requestContext: AuthorizedClientRequestContext, version: IModelVersion, iModelId: string): Promise<{ changeSetId: string, changeSetIndex: number }> {
    requestContext.enter();

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, BriefcaseManager.imodelClient);
    requestContext.enter();

    const changeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(requestContext, iModelId, changeSetId);
    return { changeSetId, changeSetIndex };
  }

  private static async processChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, targetChangeSetId: string, targetChangeSetIndex: number): Promise<void> {
    requestContext.enter();
    if (!briefcase.nativeDb || !briefcase.isOpen)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    if (briefcase.openParams.openMode !== OpenMode.ReadWrite)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    if (briefcase.openParams.isStandalone)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot apply changes to a standalone file", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    assert(briefcase.nativeDb.getParentChangeSetId() === briefcase.parentChangeSetId, "Mismatch between briefcase and the native Db");
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
        if (targetChangeSetIndex > briefcase.parentChangeSetIndex!) {
          reinstateToId = briefcase.parentChangeSetId;
          reinstateToIndex = briefcase.parentChangeSetIndex;
          mergeToId = targetChangeSetId;
          mergeToIndex = targetChangeSetIndex;
        }
      }
    } else {
      if (targetChangeSetIndex < briefcase.parentChangeSetIndex!) {
        reverseToId = targetChangeSetId;
        reverseToIndex = targetChangeSetIndex;
      } else if (targetChangeSetIndex > briefcase.parentChangeSetIndex!) {
        mergeToId = targetChangeSetId;
        mergeToIndex = targetChangeSetIndex;
      }
    }

    // Reverse, reinstate and merge as necessary
    if (typeof reverseToId === "undefined" && typeof reinstateToId === "undefined" && typeof mergeToId === "undefined")
      return;
    const perfLogger = new PerfLogger("Processing change sets - applying change sets to meet requirements", () => ({}));
    if (typeof reverseToId !== "undefined") {
      Logger.logTrace(loggerCategory, "Started reversing changes to the briefcase", () => ({ reverseToId, ...briefcase.getDebugInfo() }));
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, reverseToId, reverseToIndex!, ChangeSetApplyOption.Reverse);
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Finished reversing changes to the briefcase", () => ({ reverseToId, ...briefcase.getDebugInfo() }));
    }
    if (typeof reinstateToId !== "undefined") {
      Logger.logTrace(loggerCategory, "Started reinstating changes to the briefcase", () => ({ reinstateToId, ...briefcase.getDebugInfo() }));
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, reinstateToId, reinstateToIndex!, ChangeSetApplyOption.Reinstate);
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Finished reinstating changes to the briefcase", () => ({ reinstateToId, ...briefcase.getDebugInfo() }));
    }
    if (typeof mergeToId !== "undefined") {
      Logger.logTrace(loggerCategory, "Started merging changes to the briefcase", () => ({ mergeToId, ...briefcase.getDebugInfo() }));
      await BriefcaseManager.applyChangeSets(requestContext, briefcase, mergeToId, mergeToIndex!, ChangeSetApplyOption.Merge);
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Finished merging changes to the briefcase", () => ({ mergeToId, ...briefcase.getDebugInfo() }));
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
    let perfLogger = new PerfLogger("Processing change sets - downloading change sets", () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(requestContext, briefcase.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    requestContext.enter();
    perfLogger.dispose();
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    // Close Db before merge (if there are schema changes)
    const containsSchemaChanges: boolean = changeSets.some((changeSet: ChangeSet) => changeSet.changesType === ChangesType.Schema);
    if (containsSchemaChanges && briefcase.isOpen)
      briefcase.onBeforeClose.raiseEvent(briefcase);

    // Apply the changes (one by one to avoid hogging up the event loop)
    const changeSetsPath = BriefcaseManager.getChangeSetsPath(briefcase.iModelId);
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      assert(IModelJsFs.existsSync(changeSetPathname), `Change set file ${changeSetPathname} does not exist`);
      const changeSetToken = new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType === ChangesType.Schema);

      perfLogger = new PerfLogger("Processing change sets - applying change set", () => ({ ...briefcase.getDebugInfo(), ...changeSetToken, fileSize: changeSet.fileSize }));

      const changeSetTokens = new Array<ChangeSetToken>(changeSetToken);
      const status: ChangeSetStatus = briefcase.nativeDb!.applyChangeSets(JSON.stringify(changeSetTokens), processOption);
      if (ChangeSetStatus.Success !== status)
        throw new IModelError(status, "Error applying changesets", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));

      perfLogger.dispose();
    }

    // Mark Db as reopened after merge (if there are schema changes)
    if (containsSchemaChanges)
      briefcase.isOpen = true;

    const oldKey = briefcase.getKey();
    switch (processOption) {
      case ChangeSetApplyOption.Merge:
        briefcase.parentChangeSetId = targetChangeSetId;
        briefcase.parentChangeSetIndex = targetChangeSetIndex;
        assert(briefcase.nativeDb.getParentChangeSetId() === briefcase.parentChangeSetId);
        break;
      case ChangeSetApplyOption.Reinstate:
        if (targetChangeSetIndex === briefcase.parentChangeSetIndex) {
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
    if (briefcase.openParams.syncMode === SyncMode.PullAndPush && this._cache.findBriefcaseByKey(oldKey)) {
      this._cache.deleteBriefcaseByKey(oldKey);
      this._cache.addBriefcase(briefcase);
    }

    briefcase.onChangesetApplied.raiseEvent();
  }

  public static async reverseChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reverseToVersion: IModelVersion): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams.openMode === OpenMode.Readonly)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changes in a ReadOnly briefcase", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, reverseToVersion, briefcase.iModelId);
    requestContext.enter();
    if (targetChangeSetIndex > briefcase.currentChangeSetIndex)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse to a later version", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));

    return BriefcaseManager.processChangeSets(requestContext, briefcase, targetChangeSetId, targetChangeSetIndex);
  }

  public static async reinstateChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, reinstateToVersion?: IModelVersion): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams.openMode === OpenMode.Readonly)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reinstate (or reverse) changes in a ReadOnly briefcase", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(briefcase.parentChangeSetId);

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, targetVersion, briefcase.iModelId);
    requestContext.enter();
    if (targetChangeSetIndex < briefcase.currentChangeSetIndex)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Can reinstate only to a later version", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));

    return BriefcaseManager.processChangeSets(requestContext, briefcase, targetChangeSetId, targetChangeSetIndex);
  }

  /** Pull and merge changes from the hub
   * @param requestContext The client request context
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   * @internal
   */
  public static async pullAndMergeChanges(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, mergeToVersion, briefcase.iModelId);
    requestContext.enter();
    if (targetChangeSetIndex < briefcase.currentChangeSetIndex)
      return Promise.reject(new IModelError(ChangeSetStatus.NothingToMerge, "Nothing to merge", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex })));

    await BriefcaseManager.updatePendingChangeSets(requestContext, briefcase);
    requestContext.enter();

    return BriefcaseManager.processChangeSets(requestContext, briefcase, targetChangeSetId, targetChangeSetIndex);
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

    const changeSetsPath = BriefcaseManager.getChangeSetsPath(briefcase.iModelId);

    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      const token = new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType === ChangesType.Schema);
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
   * @internal
   */
  public static createStandaloneChangeSet(briefcase: BriefcaseEntry): ChangeSetToken {
    if (!briefcase.openParams.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot call createStandaloneChangeSet() when the briefcase is not standalone", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcase);
    BriefcaseManager.finishCreateChangeSet(briefcase);

    return changeSetToken;
  }

  /** Applies a change set to a standalone iModel */
  public static applyStandaloneChangeSets(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): ChangeSetStatus {
    if (!briefcase.openParams.isStandalone)
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
    if (briefcase.openParams.openMode !== OpenMode.ReadWrite) {
      throw new IModelError(BriefcaseStatus.CannotUpload, "Cannot push from an IModelDb that's opened ReadOnly", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
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
      Logger.logWarning(loggerCategory, "pushChanges - Truncating description to 255 characters. " + changeSet.description, () => briefcase.getDebugInfo());
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
    briefcase.parentChangeSetId = postedChangeSet!.wsgId;
    briefcase.parentChangeSetIndex = +postedChangeSet!.index!;

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

  /** Create an iModel on iModelHub
   * @internal
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

  /** @internal */
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

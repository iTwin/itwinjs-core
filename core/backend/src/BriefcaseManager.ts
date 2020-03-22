/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import {
  Briefcase as HubBriefcase, IModelHubClient, ConnectClient, ChangeSet,
  ChangesType, Briefcase, HubCode, IModelHubError, AuthorizedClientRequestContext, CheckpointQuery, Checkpoint,
  BriefcaseQuery, ChangeSetQuery, ConflictingCodesError, IModelClient, HubIModel, CancelRequest, ProgressCallback,
  UserCancelledError,
} from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/imodelbank/IModelBankClient";
import { AzureFileHandler, IOSAzureFileHandler } from "@bentley/imodeljs-clients-backend";
import {
  ChangeSetApplyOption, BeEvent, DbResult, OpenMode, assert, Logger, ChangeSetStatus,
  BentleyStatus, IModelHubStatus, PerfLogger, GuidString, Id64, IModelStatus, AsyncMutex, BeDuration,
} from "@bentley/bentleyjs-core";
import { BriefcaseProps, BriefcaseStatus, CreateIModelProps, IModelError, IModelToken, IModelVersion, MobileRpcConfiguration } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelDb, OpenParams, SyncMode } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import * as path from "path";
import * as glob from "glob";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The Id assigned to a briefcase by iModelHub or one of the special reserved values that identify special kinds of iModels.
 * @see [[ReservedBriefcaseId]]
 * @public
 */
export type BriefcaseId = number;

/** The reserved BriefcaseId values used to identify special kinds of iModels.
 * @see [[BriefcaseId]]
 * @public
 */
export enum ReservedBriefcaseId {
  /** Indicates an invalid/illegal BriefcaseId */
  Illegal = 0xffffffff,

  /** BriefcaseIds must be less than this value
   * @internal
   */
  MaxRepo = 1 << 24,

  /** From a legacy perspective, 0 used to identify a master iModel. However, this value now means CheckpointSnapshot. This value is preserved for code that might encounter older iModels
   * @internal
   */
  LegacyMaster = 0,

  /** From a legacy perspective, 1 used to identify a standalone iModel. However, this value now means Snapshot. This value is preserved for code that might encounter older iModels
   * @internal
   */
  LegacyStandalone = 1,

  /** Reserve a fixed BriefcaseId for the new concept of a single-practitioner standalone iModel.
   * @note This will be renamed to Standalone once all source code has been updated.
   * @internal
   */
  FutureStandalone = ReservedBriefcaseId.MaxRepo - 2,

  /** A snapshot iModel is read-only once created. They are typically used for archival and data transfer purposes.
   * @note Legacy standalone iModels are now considered snapshots
   * @beta
   */
  Snapshot = 1,

  /** A checkpoint snapshot iModel is a snapshot of a point on the iModelHub timeline.
   * @note Legacy master briefcases are now considered checkpoint snapshots that match the beginning of the iModelHub timeline
   * @beta
   */
  CheckpointSnapshot = 0,
}

/** Option to keep briefcase when the imodel is closed
 * @public
 */
export enum KeepBriefcase {
  No = 0,
  Yes = 1,
}

/**
 * Result of validity check of a briefcase in cache or on disk
 */
enum BriefcaseValidity {
  Reuse, // the briefcase is valid and can be re-used as is, OR is invalid and cannot be updated/re-created
  Update, // the briefcase can be made valid by updating it
  Recreate, // the briefcase can be made valid by re-fetching it
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
  public constructor(contextId: GuidString, iModelId: GuidString, targetChangeSetId: GuidString, pathname: string, openParams: OpenParams, briefcaseId: BriefcaseId) {
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
  public briefcaseId: BriefcaseId;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen!: boolean;

  /** Promise that if specified, resolves when the briefcase is ready for use */
  public isPending?: Promise<void>;

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

  /** Event called right before the briefcase is about to be closed
   * @internal
   */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Event called right before the briefcase is about to be opened
   * @internal
   */
  public readonly onBeforeOpen = new BeEvent<(_requestContext: AuthorizedClientRequestContext) => void>();

  /** Event called after the briefcase was opened
   * @internal
   */
  public readonly onAfterOpen = new BeEvent<(_requestContext: AuthorizedClientRequestContext) => void>();

  /** Event called when the version of the briefcase has been updated
   * @internal
   */
  public readonly onBeforeVersionUpdate = new BeEvent<() => void>();

  /** Gets the path key to be used in the cache and iModelToken */
  public getKey(): string {
    if (this.openParams.isSnapshot)
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

  /** Progress downloading the briefcase
   * @internal
   */
  public downloadProgress?: ProgressCallback;

  /** Cancel downloading of briefcase
   * @internal
   */
  public cancelDownloadRequest: CancelRequest = {
    cancel: () => false,
  };

  /** Get debug information on this briefcase
   * @internal
   */
  public getDebugInfo(): any {
    return {
      ...this.toJson(),
      isOpen: this.isOpen,
      currentChangeSetId: this.currentChangeSetId,
      currentChangeSetIndex: this.currentChangeSetIndex,
    };
  }

  /** Get the information on this briefcase as JSON */
  public toJson(): any {
    return {
      key: this.getKey(),
      contextId: this.contextId,
      iModelId: this.iModelId,
      briefcaseId: this.briefcaseId,
      fileId: this.fileId,
      pathname: this.pathname,
      targetChangeSetId: this.targetChangeSetId,
      targetChangeSetIndex: this.targetChangeSetIndex,
      parentChangeSetId: this.parentChangeSetId,
      parentChangeSetIndex: this.parentChangeSetIndex,
      reversedChangeSetId: this.reversedChangeSetId,
      reversedChangeSetIndex: this.reversedChangeSetIndex,
      openParams: {
        ...this.openParams,
      },
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

  /** Find FixedVersion briefcase */
  public findBriefcaseByChangeSetId(iModelId: GuidString, changeSetId: GuidString): BriefcaseEntry | undefined {
    for (const entry of this._briefcases.values()) {
      if (entry.iModelId === iModelId && entry.targetChangeSetId === changeSetId && entry.openParams.syncMode === SyncMode.FixedVersion)
        return entry;
    }
    return undefined;
  }

  /** Find VariableVersion (PullAndPush or PullOnly) briefcase */
  public findBriefcaseByBriefcaseId(iModelId: GuidString, briefcaseId: BriefcaseId, openParams: OpenParams): BriefcaseEntry | undefined {
    for (const entry of this._briefcases.values()) {
      if (entry.iModelId === iModelId && entry.briefcaseId === briefcaseId && entry.openParams.syncMode === openParams.syncMode)
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
      if (!this._initialized)
        throw new Error("BriefcaseManager.initialize() should be called before any backend operations");
      this.setupDefaultIModelClient();
    }

    return this._imodelClient!;
  }

  private static _firstChangeSetDir: string = "first";
  private static _connectClient?: ConnectClient;

  /** Connect client to be used for all briefcase operations */
  public static get connectClient(): ConnectClient {
    return BriefcaseManager._connectClient!;
  }

  /** Get the local path of the root folder storing the imodel seed file, change sets and briefcases */
  private static getIModelPath(iModelId: GuidString): string {
    const pathname = path.join(BriefcaseManager.cacheDir, iModelId, "/");
    return path.normalize(pathname);
  }

  public static getChangeSetsPath(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), "csets"); }
  public static getChangeCachePathName(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }
  public static getChangedElementsPathName(iModelId: GuidString): string { return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.elems")); }

  /**
   * Initialize the cache of previously downloaded briefcases for native applications.
   * @param requestContext Context of the authorized user
   * @internal
   */
  public static initializeBriefcaseCacheFromDisk() {
    if (this._initBriefcaseCacheFromDisk)
      return;
    if (!IModelJsFs.existsSync(BriefcaseManager.cacheDir))
      return;

    const iModelDirs = IModelJsFs.readdirSync(BriefcaseManager.cacheDir);
    for (const iModelId of iModelDirs) {
      const iModelPath = path.join(BriefcaseManager.cacheDir, iModelId);
      if (!IModelJsFs.lstatSync(iModelPath)?.isDirectory)
        continue;

      const bcRootPaths = [
        this.getFixedVersionBriefcasePath(iModelId),
        this.getVariableVersionBriefcasePath(iModelId, SyncMode.PullAndPush),
        this.getVariableVersionBriefcasePath(iModelId, SyncMode.PullOnly),
      ];

      for (const bcRootPath of bcRootPaths) {
        if (!IModelJsFs.existsSync(bcRootPath))
          continue;

        const bcDirs = IModelJsFs.readdirSync(bcRootPath);
        for (const bcDir of bcDirs) {
          const briefcasePath = path.join(bcRootPath, bcDir);
          if (!IModelJsFs.lstatSync(briefcasePath)?.isDirectory)
            continue;

          this.initializeBriefcaseOffline(briefcasePath);
        }
      }
    }
    this._initBriefcaseCacheFromDisk = true;
  }

  private static getFixedVersionBriefcasePath(iModelId: GuidString) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc", "FixedVersion");
  }

  private static getVariableVersionBriefcasePath(iModelId: GuidString, syncMode: SyncMode) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "bc", syncMode === SyncMode.PullOnly ? "PullOnly" : "PullAndPush");
  }

  private static buildFixedVersionBriefcasePath(iModelId: GuidString, changeSetId: GuidString): string {
    const pathBaseName: string = BriefcaseManager.getFixedVersionBriefcasePath(iModelId);
    return path.join(pathBaseName, changeSetId || this._firstChangeSetDir, "bc.bim");
  }

  private static buildVariableVersionBriefcasePath(iModelId: GuidString, briefcaseId: BriefcaseId, syncMode: SyncMode): string {
    const pathBaseName: string = BriefcaseManager.getVariableVersionBriefcasePath(iModelId, syncMode);
    return path.join(pathBaseName, briefcaseId.toString(), "bc.bim");
  }

  private static findFixedVersionBriefcaseInCache(iModelId: GuidString, changeSetId: string): BriefcaseEntry | undefined {
    return this._cache.findBriefcaseByChangeSetId(iModelId, changeSetId);
  }

  private static initializeFixedVersionBriefcaseOnDisk(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, openParams: OpenParams): BriefcaseEntry | undefined {
    const pathname = this.buildFixedVersionBriefcasePath(iModelId, changeSetId);
    if (!IModelJsFs.existsSync(pathname))
      return;
    const briefcase = this.initializeBriefcase(requestContext, contextId, iModelId, changeSetId, pathname, openParams, ReservedBriefcaseId.LegacyStandalone);
    return briefcase;
  }

  private static findVariableVersionBriefcaseInCache(iModelId: GuidString, hubBriefcases: HubBriefcase[], openParams: OpenParams): BriefcaseEntry | undefined {
    for (const hubBriefcase of hubBriefcases) {
      const briefcase = this._cache.findBriefcaseByBriefcaseId(iModelId, hubBriefcase.briefcaseId!, openParams);
      if (briefcase)
        return briefcase;
    }
    return undefined;
  }

  private static findVariableVersionBriefcaseOnDisk(iModelId: GuidString, hubBriefcases: HubBriefcase[], syncMode: SyncMode): { pathname: string, briefcaseId: BriefcaseId } | undefined {
    for (const hubBriefcase of hubBriefcases) {
      const pathname = this.buildVariableVersionBriefcasePath(iModelId, hubBriefcase.briefcaseId!, syncMode);
      if (IModelJsFs.existsSync(pathname))
        return { pathname, briefcaseId: hubBriefcase.briefcaseId! };
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

  private static _initialized?: boolean;

  /**
   * Required for native apps only in order to read model that is stored in cache
   */
  private static _initBriefcaseCacheFromDisk: boolean;

  private static setupDefaultIModelClient() {
    if (MobileRpcConfiguration.isMobileBackend)
      this._imodelClient = new IModelHubClient(new IOSAzureFileHandler());
    else
      this._imodelClient = new IModelHubClient(new AzureFileHandler());
  }

  private static setupConnectClient() {
    BriefcaseManager._connectClient = new ConnectClient();
  }

  /** Initialize BriefcaseManager */
  public static initialize(cacheRootDir: string, iModelClient?: IModelClient) {
    if (this._initialized)
      return;
    this._imodelClient = iModelClient;
    BriefcaseManager.setupCacheDir(cacheRootDir);
    BriefcaseManager.setupConnectClient();
    IModelHost.onBeforeShutdown.addListener(BriefcaseManager.finalize);
    this._initialized = true;
  }

  /** Finalize/Reset BriefcaseManager */
  private static finalize() {
    BriefcaseManager.closeAllBriefcases();
    BriefcaseManager.clearCache();
    IModelHost.onBeforeShutdown.removeListener(BriefcaseManager.finalize);
    BriefcaseManager._imodelClient = undefined;
    BriefcaseManager._connectClient = undefined;
    BriefcaseManager.clearCacheDir();
    BriefcaseManager._initialized = false;
  }

  /** Create a folder, recursively setting up the path as necessary */
  private static createFolder(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    const parentPath = path.dirname(dirPath);
    if (parentPath !== dirPath)
      BriefcaseManager.createFolder(parentPath);
    IModelJsFs.mkdirSync(dirPath);
  }

  private static readonly _cacheMajorVersion: number = 4;
  private static readonly _cacheMinorVersion: number = 0;

  private static buildCacheSubDir(): string {
    return `v${BriefcaseManager._cacheMajorVersion}_${BriefcaseManager._cacheMinorVersion}`;
  }

  private static findCacheSubDir(cacheRootDir: string): string | undefined {
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

  private static _cacheRootDir?: string;
  private static _cacheDir?: string;
  public static get cacheDir(): string {
    return BriefcaseManager._cacheDir!;
  }

  private static setupCacheDir(cacheRootDir: string) {
    this._cacheRootDir = cacheRootDir;

    const cacheSubDirOnDisk = BriefcaseManager.findCacheSubDir(cacheRootDir);
    const cacheSubDir = BriefcaseManager.buildCacheSubDir();
    const cacheDir = path.join(cacheRootDir, cacheSubDir);

    if (!cacheSubDirOnDisk) {
      // For now, just recreate the entire cache if the directory for the major version is not found
      // Note: This will not work if there are multiple iModel.js instances sharing the same cacheRoot directory, but are running different cache major versions
      BriefcaseManager.deleteFolderContents(cacheRootDir);
    } else if (cacheSubDirOnDisk !== cacheSubDir) {
      const cacheDirOnDisk = path.join(cacheRootDir, cacheSubDirOnDisk);
      BriefcaseManager.deleteFolderAndContents(cacheDirOnDisk);
    }

    if (!IModelJsFs.existsSync(cacheDir))
      BriefcaseManager.createFolder(cacheDir);

    BriefcaseManager._cacheDir = cacheDir;
  }

  private static clearCacheDir() {
    this._cacheRootDir = undefined;
    this._cacheDir = undefined;
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

  private static _asyncMutex = new AsyncMutex();

  /** Open a briefcase */
  public static async download(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, openParams: OpenParams, changeSetId: GuidString): Promise<BriefcaseEntry> {
    requestContext.enter();

    if (openParams.syncMode === SyncMode.FixedVersion)
      return this.downloadFixedVersion(requestContext, contextId, iModelId, changeSetId, openParams);

    const unlock = await this._asyncMutex.lock();
    try {
      // Note: It's important that the code below is called only once at a time - see docs with the method for more info
      return await this.downloadVariableVersion(requestContext, contextId, iModelId, changeSetId, openParams);
    } finally {
      unlock();
    }
  }

  /**
   * Get briefcases (no standalone or snapshots) for native applications
   *  - Waits for all the briefcases to get downloaded and initialized.
   * @internal
   */
  public static async getBriefcasesFromDisk(): Promise<BriefcaseProps[]> {
    assert(this._initBriefcaseCacheFromDisk, "Briefcase cache must have been initialized from disk");

    const filterFn = (value: BriefcaseEntry) => value.openParams.isBriefcase; // no standalone files or snapshots
    const briefcases = this._cache.getFilteredBriefcases(filterFn);

    const briefcaseProps = new Array<BriefcaseProps>();
    for (const briefcase of briefcases) {
      if (briefcase.isPending !== undefined) {
        await briefcase.isPending;
        briefcase.isPending = undefined;
      }

      let fz: number | undefined;
      try {
        const stat = IModelJsFs.lstatSync(briefcase.pathname);
        if (stat)
          fz = stat.size;
      } catch {
        Logger.logError(loggerCategory, "Failed to determine size of the file", () => briefcase.getDebugInfo());
      }

      briefcaseProps.push({
        key: briefcase.getKey(),
        contextId: briefcase.contextId,
        iModelId: briefcase.iModelId,
        changeSetId: briefcase.currentChangeSetId,
        openMode: briefcase.openParams.openMode,
        isOpen: briefcase.isOpen,
        fileSize: fz,
      });
    }
    return briefcaseProps;
  }

  /** Open a downloaded briefcase */
  public static openBriefcase(briefcase: BriefcaseEntry) {
    const res: DbResult = briefcase.nativeDb!.openIModel(briefcase.pathname, briefcase.openParams.openMode);
    briefcase.isOpen = true;
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, `Unable to reopen briefcase at ${briefcase.pathname}`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
  }

  private static async downloadFixedVersion(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, openParams: OpenParams): Promise<BriefcaseEntry> {
    requestContext.enter();

    /*
     * Note: It's important that there are no await-s between cache lookup and cache update!!
     *                 -- so the calls below should be kept synchronous --
     */

    // Find briefcase in cache, or add a new entry
    const cachedBriefcase = this.findFixedVersionBriefcaseInCache(iModelId, changeSetId);
    if (cachedBriefcase) {
      Logger.logTrace(loggerCategory, "BriefcaseManager.downloadFixedVersion - found briefcase in cache", () => cachedBriefcase.getDebugInfo());
      return cachedBriefcase;
    }

    // Find matching briefcase on disk if available (and add it to the cache)
    const diskBriefcase = this.initializeFixedVersionBriefcaseOnDisk(requestContext, contextId, iModelId, changeSetId, openParams);
    if (diskBriefcase) {
      Logger.logTrace(loggerCategory, "BriefcaseManager.downloadFixedVersion - opening briefcase from disk", () => diskBriefcase.getDebugInfo());
      return diskBriefcase;
    }

    // Create a new briefcase (and it to the cache)
    const newBriefcase = this.createFixedVersionBriefcase(requestContext, contextId, iModelId, changeSetId, openParams);
    Logger.logTrace(loggerCategory, "BriefcaseManager.downloadFixedVersion - creating a new briefcase", () => newBriefcase.getDebugInfo());
    return newBriefcase;
  }

  /** Open (or create) a briefcase for pull and push workflows
   * Note: It's important that this method ibe made atomic - i.e., there should never be a case where there are two asynchronous calls to this method
   * being processed at the same time. Otherwise there may be multiple briefcases that are acquired and downloaded for the same user.
   */
  private static async downloadVariableVersion(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, openParams: OpenParams): Promise<BriefcaseEntry> {
    requestContext.enter();

    const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    requestContext.enter();

    let briefcaseId: BriefcaseId | undefined;
    if (hubBriefcases.length > 0) {
      /** Find any of the briefcases in cache */
      const cachedBriefcase = this.findVariableVersionBriefcaseInCache(iModelId, hubBriefcases, openParams);
      if (cachedBriefcase) {
        if (cachedBriefcase.isPending !== undefined) {
          Logger.logTrace(loggerCategory, "BriefcaseManager.downloadVariableVersion - found briefcase in cache", () => cachedBriefcase.getDebugInfo());
          return cachedBriefcase;
        }

        const briefcaseValidity = this.validateBriefcase(cachedBriefcase, changeSetId, cachedBriefcase.briefcaseId);
        if (briefcaseValidity === BriefcaseValidity.Reuse) {
          Logger.logTrace(loggerCategory, "BriefcaseManager.downloadVariableVersion - reusing briefcase in cache", () => cachedBriefcase.getDebugInfo());
          return cachedBriefcase;
        }

        if (cachedBriefcase.isOpen) {
          Logger.logError(loggerCategory, "Briefcase found is not of the required version, but is already open. Cannot update or recreate it!", ({ ...cachedBriefcase.getDebugInfo(), requiredChangeSetId: changeSetId }));
          return cachedBriefcase;
        }

        assert(!cachedBriefcase.isOpen);

        // Remove the briefcase from cache so that it can be re-located or re-created and re-added to the cache
        BriefcaseManager.deleteBriefcaseFromCache(cachedBriefcase);

        // Remove the briefcase from the local disk so that it can be re-created
        if (briefcaseValidity === BriefcaseValidity.Recreate) {
          briefcaseId = cachedBriefcase.briefcaseId; // Reuse the briefcase id if it gets re-created
          BriefcaseManager.deleteBriefcaseFromLocalDisk(cachedBriefcase);
        }
      }

      /** Find matching briefcase on disk if available (and add it to the cache) */
      if (briefcaseId === undefined) { // i.e., it's not the case of re-creating a briefcase
        const foundEntry: { pathname: string, briefcaseId: BriefcaseId } | undefined = this.findVariableVersionBriefcaseOnDisk(iModelId, hubBriefcases, openParams.syncMode!);
        if (foundEntry !== undefined) {
          briefcaseId = foundEntry.briefcaseId; // Reuse the briefcase id
          const diskBriefcase = this.initializeBriefcase(requestContext, contextId, iModelId, changeSetId, foundEntry.pathname, openParams, briefcaseId);
          if (diskBriefcase) {
            Logger.logTrace(loggerCategory, "BriefcaseManager.downloadVariableVersion - opening briefcase from disk", () => diskBriefcase.getDebugInfo());
            return diskBriefcase;
          }
        }
      }
    }

    /** Acquire a new briefcase if necessary */
    if (briefcaseId === undefined) {
      const acquiredBriefcase = await BriefcaseManager.acquireBriefcase(requestContext, iModelId);
      requestContext.enter();
      briefcaseId = acquiredBriefcase.briefcaseId!;
    }

    // Set up the briefcase and add it to the cache
    const newBriefcase = this.createVariableVersionBriefcase(requestContext, contextId, iModelId, changeSetId, briefcaseId, openParams);
    Logger.logTrace(loggerCategory, "BriefcaseManager.downloadVariableVersion - creating a new briefcase.", () => newBriefcase.getDebugInfo());
    return newBriefcase;
  }

  private static validateBriefcase(briefcase: BriefcaseEntry, requiredChangeSetId: GuidString, requiredBriefcaseId: BriefcaseId): BriefcaseValidity {
    if (briefcase.briefcaseId !== requiredBriefcaseId) {
      Logger.logError(loggerCategory, "Briefcase found does not have the expected briefcase id. Must recreate it.", () => ({ ...briefcase.getDebugInfo(), requiredBriefcaseId }));
      return BriefcaseValidity.Recreate;
    }

    if (briefcase.currentChangeSetId === requiredChangeSetId) {
      Logger.logTrace(loggerCategory, "Briefcase found is of the required version and briefcaseId.", () => ({ ...briefcase.getDebugInfo(), requiredChangeSetId, requiredBriefcaseId }));
      return BriefcaseValidity.Reuse;
    }

    if (briefcase.openParams.syncMode === SyncMode.FixedVersion) {
      Logger.logError(loggerCategory, "Briefcase found is not of the required version. Must recreate it.", () => ({ ...briefcase.getDebugInfo(), requiredChangeSetId }));
      return BriefcaseValidity.Recreate;
    }

    // PullOnly or PullAndPush, and the required version doesn't match the current version
    Logger.logWarning(loggerCategory, "Briefcase found is not of the required version. Must be updated before use", ({ ...briefcase.getDebugInfo(), requiredChangeSetId }));
    return BriefcaseValidity.Update;
  }

  private static initializeBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, pathname: string, openParams: OpenParams, briefcaseId: BriefcaseId): BriefcaseEntry | undefined {
    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, openParams, briefcaseId);

    const nativeDb = new IModelHost.platform.DgnDb();
    const res = nativeDb.openIModel(pathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res) {
      Logger.logError(loggerCategory, "Cannot open briefcase. Deleting it to allow retries.", () => briefcase.getDebugInfo());
      BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
      return undefined;
    }
    briefcase.setNativeDb(nativeDb); // Note: Sets briefcaseId, currentChangeSetId in BriefcaseEntry by reading the values from nativeDb
    assert(briefcase.isOpen);

    const briefcaseValidity = this.validateBriefcase(briefcase, briefcase.targetChangeSetId, briefcaseId);
    if (briefcaseValidity === BriefcaseValidity.Recreate) {
      Logger.logError(loggerCategory, "Deleting briefcase to recreate.", () => briefcase.getDebugInfo());
      BriefcaseManager.closeBriefcase(briefcase, false);
      BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
      return undefined;
    }

    assert(!this._cache.findBriefcase(briefcase), "Attempting to open or create briefcase twice");
    BriefcaseManager._cache.addBriefcase(briefcase);

    briefcase.isPending = this.finishInitializeBriefcase(requestContext, briefcase);
    return briefcase;
  }

  private static initializeBriefcaseOffline(briefcasePath: string) {
    const briefcasePathname = path.join(briefcasePath, "bc.bim");
    if (!IModelJsFs.existsSync(briefcasePathname))
      return;

    const briefcaseInfo = this.readCachedBriefcaseInfo(briefcasePath);

    const openParams = new OpenParams(briefcaseInfo.openParams.openMode, briefcaseInfo.openParams.syncMode);
    const briefcase = new BriefcaseEntry(briefcaseInfo.contextId, briefcaseInfo.iModelId, briefcaseInfo.targetChangeSetId, briefcasePathname, openParams, briefcaseInfo.briefcaseId);
    briefcase.targetChangeSetIndex = briefcaseInfo.targetChangeSetIndex;
    briefcase.parentChangeSetIndex = briefcaseInfo.parentChangeSetIndex;
    briefcase.reversedChangeSetIndex = briefcaseInfo.reversedChangeSetIndex;

    const nativeDb = new IModelHost.platform.DgnDb();
    const res = nativeDb.openIModel(briefcasePathname, openParams.openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res, "Cannot open briefcase", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    briefcase.setNativeDb(nativeDb); // Note: Sets briefcaseId, currentChangeSetId in BriefcaseEntry by reading the values from nativeDb
    assert(briefcase.isOpen);

    if (briefcaseInfo.parentChangeSetId !== briefcase.parentChangeSetId || briefcaseInfo.reversedChangeSetId !== briefcase.reversedChangeSetId)
      throw new IModelError(res, "Briefcase does not match the cached info", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    assert(!this._cache.findBriefcase(briefcase), "Attempting to open or create briefcase twice");
    BriefcaseManager._cache.addBriefcase(briefcase);

    return briefcase;
  }

  private static async finishInitializeBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry) {
    requestContext.enter();

    const briefcaseHasChanges = briefcase.nativeDb!.hasSavedChanges();
    try {
      await this.initBriefcaseChangeSetIndexes(requestContext as AuthorizedClientRequestContext, briefcase);
      requestContext.enter();
      await this.initBriefcaseFileId(requestContext as AuthorizedClientRequestContext, briefcase);
      requestContext.enter();

      // Apply change sets if necessary
      if (briefcase.currentChangeSetId !== briefcase.targetChangeSetId) {
        const backupOpenParams = briefcase.openParams;
        if (briefcase.openParams.openMode !== OpenMode.ReadWrite)
          briefcase.openParams = new OpenParams(OpenMode.ReadWrite, backupOpenParams.syncMode); // Set briefcase to rewrite to be able to process change sets
        await BriefcaseManager.processChangeSets(requestContext, briefcase, briefcase.targetChangeSetId, briefcase.targetChangeSetIndex!);
        requestContext.enter();
        briefcase.openParams = backupOpenParams;
      }

      // Close the briefcase to complete the download/initialization
      BriefcaseManager.closeBriefcase(briefcase, false);
    } catch (error) {
      requestContext.enter();
      if (briefcaseHasChanges && briefcase.openParams.syncMode === SyncMode.PullAndPush)
        Logger.logError(loggerCategory, "Unable to update existing briefcase to the required version. Since it has changes that may have to be pushed, leaving it as is.", () => briefcase.getDebugInfo());
      else {
        Logger.logError(loggerCategory, "Initializing a briefcase fails - deleting it to allow retries", () => briefcase.getDebugInfo());
        await BriefcaseManager.deleteBriefcase(requestContext as AuthorizedClientRequestContext, briefcase);
        requestContext.enter();
        throw error;
      }
    }
  }

  private static async initBriefcaseChangeSetIndexes(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry) {
    requestContext.enter();
    briefcase.targetChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.targetChangeSetId);
    requestContext.enter();
    briefcase.parentChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.parentChangeSetId);
    requestContext.enter();
    if (typeof briefcase.reversedChangeSetId !== "undefined") {
      briefcase.reversedChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, briefcase.iModelId, briefcase.reversedChangeSetId);
      requestContext.enter();
    } else
      briefcase.reversedChangeSetIndex = undefined;
  }

  private static async initBriefcaseFileId(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry) {
    if (briefcase.briefcaseId === ReservedBriefcaseId.LegacyStandalone)
      return;

    const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, briefcase.iModelId, new BriefcaseQuery().byId(briefcase.briefcaseId));
    requestContext.enter();
    if (hubBriefcases.length === 0)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unable to find briefcase on the Hub (for the current user)`, Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
    briefcase.fileId = hubBriefcases[0].fileId!.toString();
  }

  private static createFixedVersionBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, openParams: OpenParams): BriefcaseEntry {
    const pathname = this.buildFixedVersionBriefcasePath(iModelId, changeSetId);
    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, OpenParams.fixedVersion(), ReservedBriefcaseId.LegacyStandalone);
    briefcase.downloadProgress = openParams.downloadProgress;

    briefcase.isPending = this.finishCreateBriefcase(requestContext, briefcase);

    assert(!this._cache.findBriefcase(briefcase), "Attempting to open or create briefcase twice");
    BriefcaseManager._cache.addBriefcase(briefcase);

    return briefcase;
  }

  private static createVariableVersionBriefcase(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, changeSetId: GuidString, briefcaseId: BriefcaseId, openParams: OpenParams): BriefcaseEntry {
    const pathname = this.buildVariableVersionBriefcasePath(iModelId, briefcaseId, openParams.syncMode!);
    const briefcase = new BriefcaseEntry(contextId, iModelId, changeSetId, pathname, openParams, briefcaseId);
    briefcase.downloadProgress = openParams.downloadProgress;

    briefcase.isPending = this.finishCreateBriefcase(requestContext, briefcase);

    assert(!this._cache.findBriefcase(briefcase), "Attempting to open or create briefcase twice");
    BriefcaseManager._cache.addBriefcase(briefcase);

    return briefcase;
  }

  /** Cache briefcase meta data */
  private static writeCachedBriefcaseInfo(briefcase: BriefcaseEntry) {
    const briefcaseInfoPathname = path.join(path.dirname(briefcase.pathname), "bc.json");
    const briefcaseInfo = briefcase.toJson();
    IModelJsFs.writeFileSync(briefcaseInfoPathname, JSON.stringify(briefcaseInfo));
  }

  /** Read the cached briefcase meta data.
   * @return The cached meta data
   * @throws Error if there was no file containing the meta data, or there was an error reading it
   */
  private static readCachedBriefcaseInfo(briefcasePath: string): any {
    const briefcaseInfoPathname = path.join(briefcasePath, "bc.json");
    if (!IModelJsFs.existsSync(briefcaseInfoPathname))
      throw new IModelError(BentleyStatus.ERROR, "No cached information for briefcase", Logger.logError, loggerCategory, () => ({ briefcaseInfoPathname }));

    try {
      const str = IModelJsFs.readFileSync(briefcaseInfoPathname);
      return JSON.parse(str as string);
    } catch (err) {
      Logger.logError(loggerCategory, "Error reading cached briefcase meta data", () => ({ briefcaseInfoPathname }));
      throw err;
    }
  }

  private static async finishCreateBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry): Promise<void> {
    requestContext.enter();

    try {
      // Download checkpoint
      let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
      checkpointQuery = checkpointQuery.precedingCheckpoint(briefcase.targetChangeSetId);
      const checkpoints: Checkpoint[] = await BriefcaseManager.imodelClient.checkpoints.get(requestContext, briefcase.iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length === 0)
        throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
      const checkpoint = checkpoints[0];
      if (checkpoint.fileId)
        briefcase.fileId = checkpoint.fileId.toString();

      await BriefcaseManager.downloadCheckpoint(requestContext, checkpoint, briefcase.pathname, briefcase.downloadProgress, briefcase.cancelDownloadRequest);
      requestContext.enter();

      const perfLogger = new PerfLogger("Opening iModel - setting up context/iModel/briefcase ids", () => briefcase.getDebugInfo());
      // Setup briefcase
      // TODO: Only need to setup briefcase id for the ReadWrite case after the hub properly sets up these checkpoints
      // The following function set the briefcaseId with  sync=off which should be safe for this case. It make open faster.
      let res: DbResult = IModelHost.platform.DgnDb.unsafeSetBriefcaseId(briefcase.pathname, briefcase.briefcaseId, briefcase.iModelId, briefcase.contextId);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable setup briefcase id", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));
      perfLogger.dispose();

      // Open checkpoint
      const nativeDb = new IModelHost.platform.DgnDb();
      res = nativeDb.openIModel(briefcase.pathname, OpenMode.ReadWrite);
      if (DbResult.BE_SQLITE_OK !== res)
        throw new IModelError(res, "Unable to open Db", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), result: res }));
      assert(nativeDb.getParentChangeSetId() === checkpoint.mergedChangeSetId, "The parentChangeSetId of the checkpoint was not correctly set by iModelHub");

      // verify that all following values were set correctly by unsafeSetBriefcaseId()
      assert(nativeDb.getBriefcaseId() === briefcase.briefcaseId);
      assert(nativeDb.getDbGuid() === briefcase.iModelId);
      assert(nativeDb.queryProjectGuid() === briefcase.contextId);

      briefcase.setNativeDb(nativeDb);
      await this.initBriefcaseChangeSetIndexes(requestContext, briefcase);
      requestContext.enter();

      // Apply change sets if necessary
      if (briefcase.currentChangeSetId !== briefcase.targetChangeSetId) {
        const backupOpenParams = briefcase.openParams;
        if (briefcase.openParams.openMode !== OpenMode.ReadWrite)
          briefcase.openParams = new OpenParams(OpenMode.ReadWrite, backupOpenParams.syncMode); // Set briefcase to rewrite to be able to process change sets
        await BriefcaseManager.processChangeSets(requestContext, briefcase, briefcase.targetChangeSetId, briefcase.targetChangeSetIndex!);
        requestContext.enter();
        briefcase.openParams = backupOpenParams;
      }

      // Cache information on the briefcase
      BriefcaseManager.writeCachedBriefcaseInfo(briefcase);

      // Close the briefcase to complete the download/initialization
      BriefcaseManager.closeBriefcase(briefcase, false);
    } catch (error) {
      requestContext.enter();
      Logger.logWarning(loggerCategory, "Error downloading briefcase - deleting it", () => briefcase.getDebugInfo());

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
    assert(!briefcase.openParams.isSnapshot, "Cannot use IModelDb.close() to close a standalone iModel. Use IModelDb.closeStandalone() instead");
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
  private static async downloadCheckpoint(requestContext: AuthorizedClientRequestContext, checkpoint: Checkpoint, seedPathname: string, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    requestContext.enter();
    if (IModelJsFs.existsSync(seedPathname))
      return;

    try {
      await BriefcaseManager.imodelClient.checkpoints.download(requestContext, checkpoint, seedPathname, progressCallback, cancelRequest);
    } catch (error) {
      requestContext.enter();
      if (!(error instanceof UserCancelledError))
        Logger.logError(loggerCategory, "Could not download checkpoint");
      throw error;
    }
  }

  /** Deletes a briefcase from the local disk (if it exists) */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseEntry) {
    if (briefcase.isOpen) {
      Logger.logError(loggerCategory, "Cannot delete an open briefcase from local disk", () => briefcase.getDebugInfo());
      return;
    }
    const dirName = path.dirname(briefcase.pathname);
    if (BriefcaseManager.deleteFolderAndContents(dirName))
      Logger.logTrace(loggerCategory, "Deleted briefcase from local disk", () => briefcase.getDebugInfo());
  }

  /** Deletes change sets of an iModel from local disk */
  private static deleteChangeSetsFromLocalDisk(iModelId: string) {
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    if (BriefcaseManager.deleteFolderAndContents(changeSetsPath))
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
      } catch (error) {
        requestContext.enter();
        // Note: If the cache was shared across processes, it's possible that the download was completed by another process
        if (BriefcaseManager.wasChangeSetDownloaded(changeSet, changeSetsPath))
          continue;
        Logger.logError(loggerCategory, "Could not download changesets", () => ({ iModelId }));
        throw error;
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

  /** Deletes a file
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFile(pathname: string): boolean {
    try {
      IModelJsFs.unlinkSync(pathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete file ${pathname}`);
      return false;
    }
    return true;
  }

  /** Deletes a folder that's assumed to be empty
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFolder(folderPathname: string): boolean {
    try {
      IModelJsFs.rmdirSync(folderPathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete folder: ${folderPathname}`);
      return false;
    }
    return true;
  }

  /** Deletes the contents of a folder, but not the folder itself
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderContents(folderPathname: string): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return false;

    let status = true;
    const files = IModelJsFs.readdirSync(folderPathname);
    for (const file of files) {
      const curPath = path.join(folderPathname, file);
      const locStatus = (IModelJsFs.lstatSync(curPath)!.isDirectory) ? BriefcaseManager.deleteFolderAndContents(curPath) : BriefcaseManager.deleteFile(curPath);
      if (!locStatus)
        status = false;
    }
    return status;
  }

  /** Deletes a folder and all it's contents.
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderAndContents(folderPathname: string): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return true;

    let status = false;
    status = BriefcaseManager.deleteFolderContents(folderPathname);
    if (!status)
      return false;

    status = BriefcaseManager.deleteFolder(folderPathname);
    return status;
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

  private static purgeFixedVersionBriefcases(iModelId: GuidString): boolean {
    const fixedVersionPath = this.getFixedVersionBriefcasePath(iModelId);
    if (!IModelJsFs.existsSync(fixedVersionPath))
      return true;

    let status = true;
    for (const csetId of IModelJsFs.readdirSync(fixedVersionPath)) {
      const briefcaseDir = path.join(fixedVersionPath, csetId);
      try {
        this.deleteFolderAndContents(briefcaseDir);
      } catch (_error) {
        status = false;
        continue;
      }
    }

    if (status)
      this.deleteFolderAndContents(fixedVersionPath);

    return status;
  }

  private static async purgeVariableVersionBriefcases(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, syncMode: SyncMode): Promise<boolean> {
    const variableVersionPath = this.getVariableVersionBriefcasePath(iModelId, syncMode);
    if (!IModelJsFs.existsSync(variableVersionPath))
      return true;

    // Delete all briefcases from the server
    for (const bIdString of IModelJsFs.readdirSync(variableVersionPath)) {
      const briefcaseId = +bIdString;
      try {
        await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcaseId));
        requestContext.enter();
        await BriefcaseManager.imodelClient.briefcases.delete(requestContext, iModelId, briefcaseId);
        requestContext.enter();
      } catch (error) {
        // Best effort - it could well be that the iModel has been deleted
        continue;
      }
    }

    try {
      this.deleteFolderAndContents(variableVersionPath);
    } catch (error) {
      return false;
    }
    return true;
  }

  /** Purges the disk cache for a specific iModel starting with the briefcases.
   * Returns true if successful in deleting the entire folder, and false otherwise
   */
  private static async purgeDiskCacheForIModel(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<boolean> {
    requestContext.enter();

    const deletedFixedVersionBriefcases = this.purgeFixedVersionBriefcases(iModelId);
    const deletedPullAndPushBriefcases = await this.purgeVariableVersionBriefcases(requestContext, iModelId, SyncMode.PullAndPush);
    requestContext.enter();
    const deletedPullOnlyBriefcases = await this.purgeVariableVersionBriefcases(requestContext, iModelId, SyncMode.PullOnly);
    requestContext.enter();
    if (!deletedFixedVersionBriefcases || !deletedPullAndPushBriefcases || !deletedPullOnlyBriefcases)
      return false; // Don't do additional deletes - the folders are being used

    const iModelPath = this.getIModelPath(iModelId);
    try {
      this.deleteFolderAndContents(iModelPath);
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
      this.deleteFolderContents(this._cacheRootDir!);
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
      briefcase.onBeforeClose.raiseEvent();
    briefcase.nativeDb.closeIModel();
    briefcase.isOpen = false;
    Logger.logTrace(loggerCategory, "Closed briefcase ", () => briefcase.getDebugInfo());
  }

  private static async evaluateVersion(requestContext: AuthorizedClientRequestContext, version: IModelVersion, iModelId: string): Promise<{ changeSetId: string, changeSetIndex: number }> {
    requestContext.enter();

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, BriefcaseManager.imodelClient);
    requestContext.enter();

    const changeSetIndex: number = await BriefcaseManager.getChangeSetIndexFromId(requestContext, iModelId, changeSetId);
    return { changeSetId, changeSetIndex };
  }

  /** Processes (merges, reverses, reinstates) change sets to get the briefcase to the specified target version.
   * Note: The briefcase must have been opened ReadWrite, and the method keeps it in the same state.
   */
  private static async processChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, targetChangeSetId: string, targetChangeSetIndex: number): Promise<void> {
    requestContext.enter();
    if (!briefcase.nativeDb || !briefcase.isOpen)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    if (briefcase.openParams.openMode !== OpenMode.ReadWrite)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
    if (briefcase.openParams.isSnapshot)
      return Promise.reject(new IModelError(ChangeSetStatus.ApplyError, "Cannot apply changes to a snapshot file", Logger.logError, loggerCategory, () => briefcase.getDebugInfo()));
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
    if (typeof reverseToId === "undefined" && typeof reinstateToId === "undefined" && typeof mergeToId === "undefined")
      return;

    // Reverse, reinstate and merge as necessary
    const perfLogger = new PerfLogger("Processing change sets", () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));
    try {
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
    } finally {
      perfLogger.dispose();

      // Setup all change set ids and indexes
      briefcase.parentChangeSetId = briefcase.nativeDb.getParentChangeSetId();
      briefcase.reversedChangeSetId = briefcase.nativeDb.getReversedChangeSetId();
      await this.initBriefcaseChangeSetIndexes(requestContext, briefcase);
      requestContext.enter();
    }
  }

  private static async applyChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, targetChangeSetId: string, targetChangeSetIndex: number, processOption: ChangeSetApplyOption): Promise<void> {
    requestContext.enter();

    const currentChangeSetId: string = briefcase.currentChangeSetId;
    const currentChangeSetIndex: number = briefcase.currentChangeSetIndex;
    if (targetChangeSetIndex === currentChangeSetIndex)
      return Promise.resolve(); // nothing to apply

    // Download change sets
    const reverse: boolean = (targetChangeSetIndex < currentChangeSetIndex);
    let perfLogger = new PerfLogger("Processing change sets - downloading change sets", () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(requestContext, briefcase.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    requestContext.enter();
    perfLogger.dispose();
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    // Gather the changeset tokens
    const changeSetTokens = new Array<ChangeSetToken>();
    const changeSetsPath = BriefcaseManager.getChangeSetsPath(briefcase.iModelId);
    let maxFileSize: number = 0;
    let containsSchemaChanges: boolean = false;
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      assert(IModelJsFs.existsSync(changeSetPathname), `Change set file ${changeSetPathname} does not exist`);
      const changeSetToken = new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType === ChangesType.Schema);
      changeSetTokens.push(changeSetToken);
      if (+changeSet.fileSize! > maxFileSize)
        maxFileSize = +changeSet.fileSize!;
      if (changeSet.changesType === ChangesType.Schema)
        containsSchemaChanges = true;
    });

    /* Apply change sets
     * If any of the change sets contain schema changes, or are otherwise too large, we process them asynchronously
     * to avoid blocking the main-thread/event-loop and keep the backend responsive. However, this will be an invasive
     * operation that will force the Db to be closed and reopened.
     * If the change sets are processed synchronously, they are applied one-by-one to avoid blocking the main
     * thread and the event loop. Even so, if any single change set too long to process that will again cause the
     * cause the event loop to be blocked. Also if any of the change sets contain schema changes, that will cause
     * the Db to be closed and reopened.
     */
    perfLogger = new PerfLogger("Processing change sets - applying change sets", () => ({ ...briefcase.getDebugInfo() }));
    let status: ChangeSetStatus;
    if (containsSchemaChanges || maxFileSize > 1024 * 1024) {
      status = await this.applyChangeSetsToNativeDbAsync(requestContext, briefcase, changeSetTokens, processOption);
      requestContext.enter();
    } else {
      status = await this.applyChangeSetsToNativeDbSync(briefcase, changeSetTokens, processOption);
    }
    perfLogger.dispose();

    if (ChangeSetStatus.Success !== status)
      throw new IModelError(status, "Error applying changesets", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), targetChangeSetId, targetChangeSetIndex }));
    briefcase.onChangesetApplied.raiseEvent();
  }

  /** Apply change sets synchronously
   * - change sets are applied one-by-one to avoid blocking the main thread
   * - must NOT be called if some of the change sets are too large since that will also block the main thread and leave the backend unresponsive
   * - may cause the Db to close and reopen *if* the change sets contain schema changes
   */
  private static async applyChangeSetsToNativeDbSync(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): Promise<ChangeSetStatus> {
    // Apply the changes (one by one to avoid blocking the event loop)
    for (const changeSetToken of changeSetTokens) {
      const tempChangeSetTokens = new Array<ChangeSetToken>(changeSetToken);
      const status = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(briefcase.nativeDb, JSON.stringify(tempChangeSetTokens), processOption);
      if (ChangeSetStatus.Success !== status)
        return status;
      await BeDuration.wait(0); // Just turns this operation asynchronous to avoid blocking the event loop
    }
    return ChangeSetStatus.Success;
  }

  /** Apply change sets asynchronously
   * - invasive operation that closes/reopens the Db
   * - must be called if some of the change sets are too large and the synchronous call will leave the backend unresponsive
   */
  private static async applyChangeSetsToNativeDbAsync(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): Promise<ChangeSetStatus> {
    requestContext.enter();

    const applyRequest = new IModelHost.platform.ApplyChangeSetsRequest(briefcase.nativeDb);

    let status: ChangeSetStatus = applyRequest.readChangeSets(JSON.stringify(changeSetTokens));
    if (status !== ChangeSetStatus.Success)
      return status;

    briefcase.onBeforeClose.raiseEvent();
    applyRequest.closeBriefcase();

    const doApply = new Promise<ChangeSetStatus>((resolve, _reject) => {
      applyRequest.doApplyAsync(resolve, processOption);
    });
    status = await doApply;
    requestContext.enter();

    briefcase.onBeforeOpen.raiseEvent(requestContext);
    const result = applyRequest.reopenBriefcase(briefcase.openParams.openMode);
    if (result !== DbResult.BE_SQLITE_OK)
      status = ChangeSetStatus.ApplyError;
    else
      briefcase.onAfterOpen.raiseEvent(requestContext);

    return status;
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
      Logger.logError(loggerCategory, `Relinquishing codes or locks has failed with: ${error}`, () => briefcase.getDebugInfo());
    }

    // Remove ChangeSet id if it succeeded or failed with conflicts
    if (!failedUpdating)
      BriefcaseManager.removePendingChangeSet(briefcase, changeSet.id!);
  }

  /** Creates a change set file from the changes in a standalone iModel
   * @return Path to the standalone change set file
   * @internal
   */
  public static createStandaloneChangeSet(iModelDb: IModelDb): ChangeSetToken {
    if (!iModelDb.isSnapshot && !iModelDb.isStandalone) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot call createStandaloneChangeSet() when the briefcase is not a snapshot", Logger.logError, loggerCategory);
    }
    const briefcaseEntry = new BriefcaseEntry("", iModelDb.nativeDb.getDbGuid(), iModelDb.nativeDb.getParentChangeSetId(), iModelDb.nativeDb.getFilePath(), iModelDb.openParams, iModelDb.getBriefcaseId());
    briefcaseEntry.setNativeDb(iModelDb.nativeDb);
    briefcaseEntry.iModelDb = iModelDb;
    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(briefcaseEntry);
    BriefcaseManager.finishCreateChangeSet(briefcaseEntry);
    return changeSetToken;
  }

  /** Applies a change set to a standalone iModel
   * @internal
   */
  public static applyStandaloneChangeSets(briefcase: BriefcaseEntry, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): ChangeSetStatus {
    if (!briefcase.openParams.isSnapshot)
      throw new IModelError(BentleyStatus.ERROR, "Cannot call applyStandaloneChangeSets() when the briefcase is not a snapshot", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

    // Apply the changes one by one for debugging
    for (const changeSetToken of changeSetTokens) {
      const tempChangeSetTokens = new Array<ChangeSetToken>(changeSetToken);
      const status = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(briefcase.nativeDb, JSON.stringify(tempChangeSetTokens), processOption);
      if (ChangeSetStatus.Success !== status)
        return status;
    }
    return ChangeSetStatus.Success;
  }

  /** Dumps a change set */
  public static dumpChangeSet(nativeDb: IModelJsNative.DgnDb, changeSetToken: ChangeSetToken) {
    nativeDb.dumpChangeSet(JSON.stringify(changeSetToken));
  }

  /** Attempt to push a ChangeSet to iModel Hub */
  private static async pushChangeSet(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseEntry, description: string, relinquishCodesLocks: boolean): Promise<void> {
    requestContext.enter();
    if (briefcase.openParams.syncMode !== SyncMode.PullAndPush)
      throw new IModelError(BentleyStatus.ERROR, "Invalid to call pushChanges when the briefcase was not opened with SyncMode = PullAndPush", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());

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
      let pushed = false;
      let error: any;
      try {
        await BriefcaseManager.pushChangesOnce(requestContext, briefcase, description, relinquishCodesLocks);
        requestContext.enter();
        pushed = true;
      } catch (err) {
        requestContext.enter();
        error = err;
      }
      if (pushed)
        return;

      if (!BriefcaseManager.shouldRetryPush(error)) {
        return Promise.reject(error);
      }
      const delay = Math.floor(Math.random() * 4800) + 200;
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

    const hubIModel: HubIModel = await BriefcaseManager.imodelClient.iModels.create(requestContext, contextId, iModelName, { description: args.rootSubject.description });
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

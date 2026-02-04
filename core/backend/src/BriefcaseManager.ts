/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore cset csets ecchanges

import * as path from "node:path";
import * as os from "node:os";
import {
  AccessToken, BeDuration, ChangeSetStatus, DbResult, GuidString, Id64String, IModelHubStatus, IModelStatus, Logger, OpenMode, Optional, StopWatch
} from "@itwin/core-bentley";
import {
  BriefcaseId, BriefcaseIdValue, BriefcaseProps, ChangesetFileProps, ChangesetIndex, ChangesetIndexOrId, ChangesetProps, ChangesetRange, ChangesetType, IModelError, IModelVersion, LocalBriefcaseProps,
  LocalDirName, LocalFileName, RequestNewBriefcaseProps,
  TxnProps,
} from "@itwin/core-common";
import { AcquireNewBriefcaseIdArg, DownloadChangesetArg, DownloadChangesetRangeArg, IModelNameArg } from "./BackendHubAccess";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { CheckpointManager, CheckpointProps, ProgressFunction } from "./CheckpointManager";
import { BriefcaseDb, IModelDb, TokenArg } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { SchemaSync } from "./SchemaSync";
import { _hubAccess, _nativeDb, _releaseAllLocks } from "./internal/Symbols";
import { IModelNative } from "./internal/NativePlatform";
import { StashManager, StashProps } from "./StashManager";
import { ChangedECInstance, ChangesetECAdaptor, ECChangeUnifierCache, PartialECChangeUnifier } from "./ChangesetECAdaptor";
import { ECSqlRow } from "./Entity";
import { SqliteChangesetReader } from "./SqliteChangesetReader";

const loggerCategory = BackendLoggerCategory.IModelDb;

/**
 * The argument for identifying an Patch Instance Key
 * @internal
 */
type PatchInstanceKey = {
  id: Id64String;
  classFullName: string;
}

/**
 * wrapper around ChangedECInstance to indicate if the change was indirect
 * @internal
 */
type ChangedInstanceForSemanticRebase = {
  isIndirect: boolean;
  instance: ChangedECInstance;
}

/** The argument for patch instances during high level rebase application
 * @internal
*/
export type InstancePatch = {
  key: PatchInstanceKey;
  op: "Inserted" | "Updated" | "Deleted";
  isIndirect: boolean;
  props?: ECSqlRow
}

/** The argument for [[BriefcaseManager.downloadBriefcase]]
 * @public
*/
export interface RequestNewBriefcaseArg extends TokenArg, RequestNewBriefcaseProps {
  /** If present, a function called periodically during the download to indicate progress.
   * @note return non-zero from this function to abort the download.
   */
  onProgress?: ProgressFunction;
}

/**
 * Parameters for pushing changesets to iModelHub
 * @public
 */
export interface PushChangesArgs extends TokenArg {
  /** A description of the changes. This is visible on the iModel's timeline. */
  description: string;
  /** if present, the locks are retained after the operation. Otherwise, *all* locks are released after the changeset is successfully pushed. */
  retainLocks?: true;
  /** number of times to retry pull/merge if other users are pushing at the same time. Default is 5 */
  mergeRetryCount?: number;
  /** delay to wait between pull/merge retry attempts. Default is 3 seconds */
  mergeRetryDelay?: BeDuration;
  /** the number of time to attempt to retry to push the changeset upon failure. Default is 3 */
  pushRetryCount?: number;
  /** The delay to wait between retry attempts on failed pushes. Default is 3 seconds. */
  pushRetryDelay?: BeDuration;
  /**
   *  (unused)
   * @deprecated in 5.1.8 - will not be removed until after 2026-10-01. Not used by BriefcaseManager. Caller should remove this flag.
   * @internal
   */
  noFastForward?: true;
}

/**
 * Specifies a specific index for pulling changes.
 * @public
 */
export interface ToChangesetArgs extends TokenArg {
  /** The last ChangesetIndex to pull. If not present, pull *all* newer changesets. */
  toIndex?: ChangesetIndex;
}

/** Arguments for [[BriefcaseManager.pullAndApplyChangesets]]
 * @public
 */
export type PullChangesArgs = ToChangesetArgs & {
  /** If present, a function called periodically during the download to indicate progress.
   * @note return non-zero from this function to abort the download.
   */
  onProgress?: ProgressFunction;
  /**
   *  (unused)
   * @deprecated in 5.1.8 - will not be removed until after 2026-10-01. Not used by BriefcaseManager. Caller should remove this flag.
   * @internal
   */
  noFastForward?: true;
};

/** Arguments for [[BriefcaseManager.revertTimelineChanges]]
 * @public
 */
export type RevertChangesArgs = Optional<PushChangesArgs, "description"> & {
  /** If present, a function called periodically during the download to indicate progress.
   * @note return non-zero from this function to abort the download.
   */
  onProgress?: ProgressFunction;
  /** The index of the changeset to revert to */
  toIndex: ChangesetIndex;
  /** If present, schema changes are skipped during the revert operation. */
  skipSchemaChanges?: true;
};

/** Manages downloading Briefcases and downloading and uploading changesets.
 * @public
 */
export class BriefcaseManager {
  /** @internal */
  public static readonly PULL_MERGE_RESTORE_POINT_NAME = "$pull_merge_restore_point";

  /** Get the local path of the folder storing files that are associated with an imodel */
  public static getIModelPath(iModelId: GuidString): LocalDirName { return path.join(this._cacheDir, iModelId); }

  /** @internal */
  public static getChangeSetsPath(iModelId: GuidString): LocalDirName { return path.join(this.getIModelPath(iModelId), "changesets"); }

  /** @internal */
  public static getChangeCachePathName(iModelId: GuidString): LocalFileName { return path.join(this.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }

  /** @internal */
  public static getChangedElementsPathName(iModelId: GuidString): LocalFileName { return path.join(this.getIModelPath(iModelId), iModelId.concat(".bim.elems")); }

  private static _briefcaseSubDir = "briefcases";
  /** Get the local path of the folder storing briefcases associated with the specified iModel. */
  public static getBriefcaseBasePath(iModelId: GuidString): LocalDirName {
    return path.join(this.getIModelPath(iModelId), this._briefcaseSubDir);
  }

  /** Get the name of the local file that holds, or will hold, a local briefcase in the briefcase cache.
   * @note The briefcase cache is a local directory established in the call to [[BriefcaseManager.initialize]].
   * @param briefcase the iModelId and BriefcaseId for the filename
   * @see getIModelPath
   */
  public static getFileName(briefcase: BriefcaseProps): LocalFileName {
    return path.join(this.getBriefcaseBasePath(briefcase.iModelId), `${briefcase.briefcaseId}.bim`);
  }

  private static setupCacheDir(cacheRootDir: LocalDirName) {
    this._cacheDir = cacheRootDir;
    IModelJsFs.recursiveMkDirSync(this._cacheDir);
  }

  private static _initialized?: boolean;
  /** Initialize BriefcaseManager
   * @param cacheRootDir The root directory for storing a cache of downloaded briefcase files on the local computer.
   * Briefcases are stored relative to this path in sub-folders organized by IModelId.
   * @note It is perfectly valid for applications to store briefcases in locations they manage, outside of `cacheRootDir`.
   */
  public static initialize(cacheRootDir: LocalDirName) {
    if (this._initialized)
      return;
    this.setupCacheDir(cacheRootDir);
    IModelHost.onBeforeShutdown.addOnce(() => this.finalize());
    this._initialized = true;
  }

  private static finalize() {
    this._initialized = false;
  }

  /** Get a list of the local briefcase held in the briefcase cache, optionally for a single iModelId
   * @param iModelId if present, only briefcases for this iModelId are returned, otherwise all briefcases for all
   * iModels in the briefcase cache are returned.
   * @note usually there should only be one briefcase per iModel.
   */
  public static getCachedBriefcases(iModelId?: GuidString): LocalBriefcaseProps[] {
    const briefcaseList: LocalBriefcaseProps[] = [];
    const iModelDirs = IModelJsFs.readdirSync(this._cacheDir);
    for (const iModelDir of iModelDirs) {
      if (iModelId && iModelId !== iModelDir)
        continue;
      const bcPath = path.join(this._cacheDir, iModelDir, this._briefcaseSubDir);
      try {
        if (!IModelJsFs.lstatSync(bcPath)?.isDirectory)
          continue;
      } catch {
        continue;
      }

      const briefcases = IModelJsFs.readdirSync(bcPath);
      for (const briefcaseName of briefcases) {
        if (briefcaseName.endsWith(".bim")) {
          try {
            const fileName = path.join(bcPath, briefcaseName);
            const fileSize = IModelJsFs.lstatSync(fileName)?.size ?? 0;
            const db = IModelDb.openDgnDb({ path: fileName }, OpenMode.Readonly);
            briefcaseList.push({ fileName, iTwinId: db.getITwinId(), iModelId: db.getIModelId(), briefcaseId: db.getBriefcaseId(), changeset: db.getCurrentChangeset(), fileSize });
            db.closeFile();
          } catch { }
        }
      }
    }
    return briefcaseList;
  }

  private static _cacheDir: LocalDirName;
  /** Get the root directory for the briefcase cache */
  public static get cacheDir(): LocalDirName { return this._cacheDir; }

  /** Determine whether the supplied briefcaseId is in the range of assigned BriefcaseIds issued by iModelHub
   * @note this does check whether the id was actually acquired by the caller.
   */
  public static isValidBriefcaseId(id: BriefcaseId) {
    return id >= BriefcaseIdValue.FirstValid && id <= BriefcaseIdValue.LastValid;
  }

  /** Acquire a new briefcaseId from iModelHub for the supplied iModelId
   * @note usually there should only be one briefcase per iModel per user. If a single user acquires more than one briefcaseId,
   * it's a good idea to supply different aliases for each of them.
   */
  public static async acquireNewBriefcaseId(arg: AcquireNewBriefcaseIdArg): Promise<BriefcaseId> {
    return IModelHost[_hubAccess].acquireNewBriefcaseId(arg);
  }

  /**
   * Download a new briefcase from iModelHub for the supplied iModelId.
   *
   * Briefcases are local files holding a copy of an iModel.
   * Briefcases may either be specific to an individual user (so that it can be modified to create changesets), or it can be readonly so it can accept but not create changesets.
   * Every briefcase internally holds its [[BriefcaseId]]. Writeable briefcases have a `BriefcaseId` "assigned" to them by iModelHub. No two users will ever have the same BriefcaseId.
   * Readonly briefcases are "unassigned" with the special value [[BriefcaseId.Unassigned]].
   *
   * Typically a given user will have only one briefcase on their machine for a given iModelId. Rarely, it may be necessary to use more than one
   * briefcase to make isolated independent sets of changes, but that is exceedingly complicated and rare.
   *
   * Callers of this method may supply a BriefcaseId, or if none is supplied, a new one is acquired from iModelHub.
   *
   * @param arg The arguments that specify the briefcase file to be downloaded.
   * @returns The properties of the local briefcase in a Promise that is resolved after the briefcase is fully downloaded and the briefcase file is ready for use via [BriefcaseDb.open]($backend).
   * @note The location of the local file to hold the briefcase is arbitrary and may be any valid *local* path on your machine. If you don't supply
   * a filename, the local briefcase cache is used by creating a file with the briefcaseId as its name in the `briefcases` folder below the folder named
   * for the IModelId.
   * @note *It is invalid to edit briefcases on a shared network drive* and that is a sure way to corrupt your briefcase (see https://www.sqlite.org/howtocorrupt.html)
   */
  public static async downloadBriefcase(arg: RequestNewBriefcaseArg): Promise<LocalBriefcaseProps> {
    const briefcaseId = arg.briefcaseId ?? await this.acquireNewBriefcaseId({ deviceName: `${os.hostname()}:${os.type()}:${os.arch()}`, ...arg });
    const fileName = arg.fileName ?? this.getFileName({ ...arg, briefcaseId });

    if (IModelJsFs.existsSync(fileName))
      throw new IModelError(IModelStatus.FileAlreadyExists, `Briefcase "${fileName}" already exists`);

    const asOf = arg.asOf ?? IModelVersion.latest().toJSON();
    const changeset = await IModelHost[_hubAccess].getChangesetFromVersion({ ...arg, version: IModelVersion.fromJSON(asOf) });
    const checkpoint: CheckpointProps = { ...arg, changeset };

    try {
      await CheckpointManager.downloadCheckpoint({ localFile: fileName, checkpoint, onProgress: arg.onProgress });
    } catch (error: unknown) {
      const errorMessage = `Failed to download briefcase to ${fileName}, errorMessage: ${(error as Error).message}`;
      if (arg.accessToken && arg.briefcaseId === undefined) {
        Logger.logInfo(loggerCategory, `${errorMessage}, releasing the briefcaseId...`);
        await this.releaseBriefcase(arg.accessToken, { briefcaseId, iModelId: arg.iModelId });
      }
      if (IModelJsFs.existsSync(fileName)) {
        if (arg.accessToken && arg.briefcaseId === undefined)
          Logger.logTrace(loggerCategory, `Deleting the file: ${fileName}...`);
        else
          Logger.logInfo(loggerCategory, `${errorMessage}, deleting the file...`);
        try {
          IModelJsFs.unlinkSync(fileName);
          Logger.logInfo(loggerCategory, `Deleted ${fileName}`);
        } catch (deleteError: unknown) {
          Logger.logWarning(loggerCategory, `Failed to delete ${fileName}. errorMessage: ${(deleteError as Error).message}`);
        }
      }
      throw error;
    }

    const fileSize = IModelJsFs.lstatSync(fileName)?.size ?? 0;
    const response: LocalBriefcaseProps = {
      fileName,
      briefcaseId,
      iModelId: arg.iModelId,
      iTwinId: arg.iTwinId,
      changeset: checkpoint.changeset,
      fileSize,
    };

    // now open the downloaded checkpoint and reset its BriefcaseId
    const nativeDb = new IModelNative.platform.DgnDb();
    try {
      nativeDb.openIModel(fileName, OpenMode.ReadWrite);
    } catch (err: any) {
      throw new IModelError(err.errorNumber, `Could not open downloaded briefcase for write access: ${fileName}, err=${err.message}`);
    }
    try {
      nativeDb.enableWalMode(); // local briefcases should use WAL journal mode
      nativeDb.resetBriefcaseId(briefcaseId);
      if (nativeDb.getCurrentChangeset().id !== checkpoint.changeset.id)
        throw new IModelError(IModelStatus.InvalidId, `Downloaded briefcase has wrong changesetId: ${fileName}`);
    } finally {
      nativeDb.saveChanges();
      nativeDb.closeFile();
    }
    return response;
  }

  /** Deletes change sets of an iModel from local disk
   * @internal
   */
  public static deleteChangeSetsFromLocalDisk(iModelId: string) {
    const changesetsPath = BriefcaseManager.getChangeSetsPath(iModelId);
    BriefcaseManager.deleteFolderAndContents(changesetsPath);
  }

  /** Releases a briefcaseId from iModelHub. After this call it is illegal to generate changesets for the released briefcaseId.
   * @note generally, this method should not be called directly. Instead use [[deleteBriefcaseFiles]].
   * @see deleteBriefcaseFiles
   */
  public static async releaseBriefcase(accessToken: AccessToken, briefcase: BriefcaseProps): Promise<void> {
    if (this.isValidBriefcaseId(briefcase.briefcaseId))
      return IModelHost[_hubAccess].releaseBriefcase({ accessToken, iModelId: briefcase.iModelId, briefcaseId: briefcase.briefcaseId });
  }

  /**
   * Delete and clean up a briefcase and all of its associated files. First, this method opens the supplied filename to determine its briefcaseId.
   * Then, if a requestContext is supplied, it releases a BriefcaseId from iModelHub. Finally it deletes the local briefcase file and
   * associated files (that is, all files in the same directory that start with the briefcase name).
   * @param filePath the full file name of the Briefcase to delete
   * @param accessToken for releasing the briefcaseId
   */
  public static async deleteBriefcaseFiles(filePath: LocalFileName, accessToken?: AccessToken): Promise<void> {
    try {
      const db = IModelDb.openDgnDb({ path: filePath }, OpenMode.Readonly);
      const briefcase: BriefcaseProps = {
        iModelId: db.getIModelId(),
        briefcaseId: db.getBriefcaseId(),
      };
      db.closeFile();

      if (this.isValidBriefcaseId(briefcase.briefcaseId))
        this.cleanupRebaseFolders(filePath, briefcase.briefcaseId); // cleanup rebase folders

      if (accessToken) {
        if (this.isValidBriefcaseId(briefcase.briefcaseId)) {
          await BriefcaseManager.releaseBriefcase(accessToken, briefcase);
        }
      }
    } catch { }

    // first try to delete the briefcase file
    try {
      if (IModelJsFs.existsSync(filePath))
        IModelJsFs.unlinkSync(filePath);
    } catch (err) {
      throw new IModelError(IModelStatus.BadRequest, `cannot delete briefcase file ${String(err)}`);
    }

    // next, delete all files that start with the briefcase's filePath (e.g. "a.bim-locks", "a.bim-journal", etc.)
    try {
      const dirName = path.dirname(filePath);
      const fileName = path.basename(filePath);
      const files = IModelJsFs.readdirSync(dirName);
      for (const file of files) {
        if (file.startsWith(fileName))
          this.deleteFile(path.join(dirName, file)); // don't throw on error
      }
    } catch { }
  }

  /** Deletes a file
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFile(pathname: LocalFileName): boolean {
    try {
      IModelJsFs.unlinkSync(pathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete file ${pathname}, ${String(error)}`);
      return false;
    }
    return true;
  }

  /** Deletes a folder, checking if it's empty
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFolderIfEmpty(folderPathname: LocalDirName): boolean {
    try {
      const files = IModelJsFs.readdirSync(folderPathname);
      if (files.length > 0)
        return false;

      IModelJsFs.rmdirSync(folderPathname);
    } catch {
      Logger.logError(loggerCategory, `Cannot delete folder: ${folderPathname}`);
      return false;
    }
    return true;
  }

  /** Deletes the contents of a folder, but not the folder itself
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderContents(folderPathname: LocalDirName): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return false;

    let status = true;
    const files = IModelJsFs.readdirSync(folderPathname);
    for (const file of files) {
      const curPath = path.join(folderPathname, file);
      const locStatus = (IModelJsFs.lstatSync(curPath)?.isDirectory) ? BriefcaseManager.deleteFolderAndContents(curPath) : BriefcaseManager.deleteFile(curPath);
      if (!locStatus)
        status = false;
    }
    return status;
  }

  /** Download all the changesets in the specified range.
   * @beta
   */
  public static async downloadChangesets(arg: DownloadChangesetRangeArg): Promise<ChangesetFileProps[]> {
    return IModelHost[_hubAccess].downloadChangesets(arg);
  }

  /** Download a single changeset.
   * @beta
   */
  public static async downloadChangeset(arg: DownloadChangesetArg): Promise<ChangesetFileProps> {
    return IModelHost[_hubAccess].downloadChangeset(arg);
  }

  /** Query the hub for the properties for a ChangesetIndex or ChangesetId  */
  public static async queryChangeset(arg: { iModelId: GuidString, changeset: ChangesetIndexOrId }): Promise<ChangesetProps> {
    return IModelHost[_hubAccess].queryChangeset({ ...arg, accessToken: await IModelHost.getAccessToken() });
  }

  /** Query the hub for an array of changeset properties given a ChangesetRange */
  public static async queryChangesets(arg: { iModelId: GuidString, range: ChangesetRange }): Promise<ChangesetProps[]> {
    return IModelHost[_hubAccess].queryChangesets({ ...arg, accessToken: await IModelHost.getAccessToken() });
  }

  /** Query the hub for the ChangesetProps of the most recent changeset */
  public static async getLatestChangeset(arg: { iModelId: GuidString }): Promise<ChangesetProps> {
    return IModelHost[_hubAccess].getLatestChangeset({ ...arg, accessToken: await IModelHost.getAccessToken() });
  }

  /** Query the Id of an iModel by name.
   * @param arg Identifies the iModel of interest
   * @returns the Id of the corresponding iModel, or `undefined` if no such iModel exists.
   */
  public static async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    return IModelHost[_hubAccess].queryIModelByName(arg);
  }

  /** Deletes a folder and all it's contents.
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderAndContents(folderPathname: LocalDirName): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return true;

    let status = false;
    status = BriefcaseManager.deleteFolderContents(folderPathname);
    if (!status)
      return false;

    status = BriefcaseManager.deleteFolderIfEmpty(folderPathname);
    return status;
  }

  private static async applySingleChangeset(db: IModelDb, changesetFile: ChangesetFileProps, fastForward: boolean) {
    if (changesetFile.changesType === ChangesetType.Schema || changesetFile.changesType === ChangesetType.SchemaSync)
      db.clearCaches(); // for schema changesets, statement caches may become invalid. Do this *before* applying, in case db needs to be closed (open statements hold db open.)

    db[_nativeDb].applyChangeset(changesetFile, fastForward);
    db.changeset = db[_nativeDb].getCurrentChangeset();

    // we're done with this changeset, delete it
    IModelJsFs.removeSync(changesetFile.pathname);
  }

  /** @internal */
  public static async revertTimelineChanges(db: IModelDb, arg: RevertChangesArgs): Promise<void> {
    if (!db.isOpen || db[_nativeDb].isReadonly())
      throw new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to revert timeline changes");

    let currentIndex = db.changeset.index;
    if (currentIndex === undefined)
      currentIndex = (await IModelHost[_hubAccess].queryChangeset({ accessToken: arg.accessToken, iModelId: db.iModelId, changeset: { id: db.changeset.id } })).index;

    if (!arg.toIndex) {
      throw new IModelError(ChangeSetStatus.ApplyError, "toIndex must be specified to revert changesets");
    }
    if (arg.toIndex > currentIndex) {
      throw new IModelError(ChangeSetStatus.ApplyError, "toIndex must be less than or equal to the current index");
    }
    if (!db.holdsSchemaLock) {
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot revert timeline changesets without holding a schema lock");
    }

    // Download change sets
    const changesets = await IModelHost[_hubAccess].downloadChangesets({
      accessToken: arg.accessToken,
      iModelId: db.iModelId,
      range: { first: arg.toIndex, end: currentIndex },
      targetDir: BriefcaseManager.getChangeSetsPath(db.iModelId),
      progressCallback: arg.onProgress,
    });

    if (changesets.length === 0)
      return;

    changesets.reverse();
    db.clearCaches();

    const stopwatch = new StopWatch(`Reverting changes`, true);
    Logger.logInfo(loggerCategory, `Starting reverting timeline changes from ${arg.toIndex} to ${currentIndex}`);

    /**
     * Revert timeline changes from the current index to the specified index.
     * It does not change parent of the current changeset.
     * All changes during revert operation are stored in a new changeset.
     * Revert operation require schema lock as we do not acquire individual locks for each element.
     * Optionally schema changes can be skipped (required for schema sync case).
     */
    db[_nativeDb].revertTimelineChanges(changesets, arg.skipSchemaChanges ?? false);
    Logger.logInfo(loggerCategory, `Reverted timeline changes from ${arg.toIndex} to ${currentIndex} (${stopwatch.elapsedSeconds} seconds)`);

    changesets.forEach((changeset) => {
      IModelJsFs.removeSync(changeset.pathname);
    });
    db.notifyChangesetApplied();
  }

  /**
   * @internal
   * Pulls and applies changesets from the iModelHub to the specified IModelDb instance.
   *
   * This method downloads and applies all changesets required to bring the local briefcase up to the specified changeset index.
   * It supports both forward and reverse application of changesets, depending on the `toIndex` argument.
   * If there are pending local transactions and a reverse operation is requested, an error is thrown.
   * The method manages restore points for safe merging, handles local transaction reversal, applies each changeset in order,
   * and resumes or rebases local changes as appropriate for the type of database.
   *
   * @param db The IModelDb instance to which changesets will be applied. Must be open and writable.
   * @param arg The arguments for pulling changesets, including access token, target changeset index, and optional progress callback.
   * @throws IModelError If the briefcase is not open in read-write mode, if there are pending transactions when reversing, or if applying a changeset fails.
   * @returns A promise that resolves when all required changesets have been applied.
   */
  public static async pullAndApplyChangesets(db: IModelDb, arg: PullChangesArgs): Promise<void> {
    const briefcaseDb = db instanceof BriefcaseDb ? db : undefined;
    const nativeDb = db[_nativeDb];

    if (!db.isOpen || nativeDb.isReadonly()) // don't use db.isReadonly - we reopen the file writable just for this operation but db.isReadonly is still true
      throw new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets");

    let currentIndex = db.changeset.index;
    if (currentIndex === undefined)
      currentIndex = (await IModelHost[_hubAccess].queryChangeset({ accessToken: arg.accessToken, iModelId: db.iModelId, changeset: { id: db.changeset.id } })).index;

    const reverse = (arg.toIndex && arg.toIndex < currentIndex) ? true : false;
    const isPullMerge = briefcaseDb && !reverse;
    if (nativeDb.hasPendingTxns() && reverse) {
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changesets when there are pending changes");
    }

    if (isPullMerge) {
      if (briefcaseDb.txns.rebaser.isRebasing) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot pull and apply changeset while rebasing");
      }
      if (briefcaseDb.txns.isIndirectChanges) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot pull and apply changeset while in an indirect change scope");
      }
      briefcaseDb.txns.rebaser.notifyPullMergeBegin(briefcaseDb.changeset);
      briefcaseDb.txns.rebaser.notifyDownloadChangesetsBegin();
    }

    // Download change sets
    const changesets = await IModelHost[_hubAccess].downloadChangesets({
      accessToken: arg.accessToken,
      iModelId: db.iModelId,
      range: { first: reverse ? arg.toIndex! + 1 : currentIndex + 1, end: reverse ? currentIndex : arg.toIndex }, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      targetDir: BriefcaseManager.getChangeSetsPath(db.iModelId),
      progressCallback: arg.onProgress,
    });

    if (isPullMerge) {
      briefcaseDb.txns.rebaser.notifyDownloadChangesetsEnd();
    }

    if (changesets.length === 0) {
      if (isPullMerge) {
        briefcaseDb.txns.rebaser.notifyPullMergeEnd(briefcaseDb.changeset);
      }
      return; // nothing to apply
    }

    if (reverse)
      changesets.reverse();

    if (isPullMerge && briefcaseDb.txns.hasPendingTxns && !briefcaseDb.txns.hasPendingSchemaChanges && !IModelHost.configuration?.disableRestorePointOnPullMerge) {
      Logger.logInfo(loggerCategory, `Creating restore point ${this.PULL_MERGE_RESTORE_POINT_NAME}`);
      await this.createRestorePoint(briefcaseDb, this.PULL_MERGE_RESTORE_POINT_NAME);
    }

    const hasIncomingSchemaChange: boolean = changesets.some((changeset) => changeset.changesType === ChangesetType.Schema);
    const useSemanticRebase: boolean =
      briefcaseDb !== undefined &&
      IModelHost.useSemanticRebase &&
      (hasIncomingSchemaChange || briefcaseDb.checkIfSchemaTxnExists());

    if (!reverse) {
      if (briefcaseDb) {
        if (briefcaseDb && useSemanticRebase) {
          this.capturePatchInstances(briefcaseDb);
        }
        briefcaseDb.txns.rebaser.notifyReverseLocalChangesBegin();
        const reversedTxns = nativeDb.pullMergeReverseLocalChanges();
        const reversedTxnProps = reversedTxns.map((txn) => briefcaseDb.txns.getTxnProps(txn)).filter((props): props is TxnProps => props !== undefined);
        briefcaseDb.txns.rebaser.notifyReverseLocalChangesEnd(reversedTxnProps);
        Logger.logInfo(loggerCategory, `Reversed ${reversedTxns.length} local changes`);
      } else {
        nativeDb.pullMergeReverseLocalChanges();
      }
    }

    if (isPullMerge) {
      briefcaseDb.txns.rebaser.notifyApplyIncomingChangesBegin(changesets);
    }

    // apply incoming changes
    for (const changeset of changesets) {
      const stopwatch = new StopWatch(`[${changeset.id}]`, true);
      Logger.logInfo(loggerCategory, `Starting application of changeset with id ${stopwatch.description}`);
      try {
        await this.applySingleChangeset(db, changeset, false);
        Logger.logInfo(loggerCategory, `Applied changeset with id ${stopwatch.description} (${stopwatch.elapsedSeconds} seconds)`);
      } catch (err: any) {
        if (err instanceof Error) {
          Logger.logError(loggerCategory, `Error applying changeset with id ${stopwatch.description}: ${err.message}`);
        }
        db.abandonChanges();
        throw err;
      }
    }
    if (isPullMerge) {
      briefcaseDb.txns.rebaser.notifyApplyIncomingChangesEnd(changesets);
    }
    if (!reverse) {
      if (briefcaseDb) {
        if (useSemanticRebase)
          await briefcaseDb.txns.rebaser.resumeSemantic();
        else
          await briefcaseDb.txns.rebaser.resume();
      } else {
        // Only Briefcase has change management. Following is
        // for test related to standalone db with txn enabled.
        nativeDb.pullMergeRebaseBegin();
        let txnId = nativeDb.pullMergeRebaseNext();
        while (txnId) {
          nativeDb.pullMergeRebaseReinstateTxn();
          nativeDb.pullMergeRebaseUpdateTxn();
          txnId = nativeDb.pullMergeRebaseNext();
        }
        nativeDb.pullMergeRebaseEnd();
        if (!nativeDb.isReadonly) {
          nativeDb.saveChanges("Merge.");
        }
      }

      if (briefcaseDb && this.containsRestorePoint(briefcaseDb, this.PULL_MERGE_RESTORE_POINT_NAME)) {
        Logger.logInfo(loggerCategory, `Dropping restore point ${this.PULL_MERGE_RESTORE_POINT_NAME}`);
        this.dropRestorePoint(briefcaseDb, this.PULL_MERGE_RESTORE_POINT_NAME);
      }
    }
    // notify listeners
    db.notifyChangesetApplied();
  }

  /**
   * @internal
   * Creates a restore point for the specified briefcase database.
   *
   * @param db - The {@link BriefcaseDb} instance for which to create the restore point.
   * @param name - The unique name for the restore point. Must be a non-empty string.
   * @returns A promise that resolves to the created stash object representing the restore point.
   */
  public static async createRestorePoint(db: BriefcaseDb, name: string): Promise<StashProps> {
    Logger.logTrace(loggerCategory, `Creating restore point ${name}`);
    this.dropRestorePoint(db, name);

    const stash = await StashManager.stash({ db, description: this.makeRestorePointKey(name) });
    db[_nativeDb].saveLocalValue(this.makeRestorePointKey(name), stash.id);
    db.saveChanges("Create restore point");
    Logger.logTrace(loggerCategory, `Created restore point ${name}`, () => stash);
    return stash;
  }

  /**
   * @internal
   * Drops a previously created restore point from the specified briefcase database.
   *
   * @param db - The {@link BriefcaseDb} instance from which to drop the restore point.
   * @param name - The name of the restore point to be dropped. Must be a non-empty string.
   */
  public static dropRestorePoint(db: BriefcaseDb, name: string): void {
    Logger.logTrace(loggerCategory, `Dropping restore point ${name}`);

    const restorePointId = db[_nativeDb].queryLocalValue(this.makeRestorePointKey(name));
    if (restorePointId) {
      StashManager.dropStash({ db, stash: restorePointId });
      db[_nativeDb].deleteLocalValue(this.makeRestorePointKey(name));
      db.saveChanges("Drop restore point");
      Logger.logTrace(loggerCategory, `Dropped restore point ${name}`);
    }

  }

  /**
   * @internal
   * Checks if a restore point with the specified name exists in the given briefcase database.
   *
   * @param db - The {@link BriefcaseDb} instance to search within.
   * @param name - The name of the restore point to check for existence.
   * @returns `true` if the restore point exists and its stash is present; otherwise, `false`.
   */
  public static containsRestorePoint(db: BriefcaseDb, name: string): boolean {
    Logger.logTrace(loggerCategory, `Checking if restore point ${name} exists`);
    const key = this.makeRestorePointKey(name);
    const restorePointId = db[_nativeDb].queryLocalValue(key);
    if (!restorePointId) {
      return false;
    }

    const stash = StashManager.tryGetStash({ db, stash: restorePointId });
    if (!stash) {
      Logger.logTrace(loggerCategory, `Restore point ${name} does not exist. Deleting ${key}`);
      db[_nativeDb].deleteLocalValue(key);
      return false;
    }
    return true;
  }

  private static makeRestorePointKey(name: string): string {
    if (name.length === 0) {
      throw new Error("Invalid restore point name");
    }
    return `restore_point/${name}`;
  }

  /**
   * @internal
   * Restores the state of a briefcase database to a previously saved restore point.
   *
   * @param db - The {@link BriefcaseDb} instance to restore.
   * @param name - The name of the restore point to apply.
   */
  public static async restorePoint(db: BriefcaseDb, name: string): Promise<void> {
    Logger.logTrace(loggerCategory, `Restoring to restore point ${name}`);
    const restorePointId = db[_nativeDb].queryLocalValue(this.makeRestorePointKey(name));
    if (!restorePointId) {
      throw new Error(`Restore point not found: ${name}`);
    }

    await StashManager.restore({ db, stash: restorePointId });
    Logger.logTrace(loggerCategory, `Restored to restore point ${name}`);
    this.dropRestorePoint(db, name);
  }

  /** create a changeset from the current changes, and push it to iModelHub */
  private static async pushChanges(db: BriefcaseDb, arg: PushChangesArgs): Promise<void> {
    if (db.txns.rebaser.isRebasing) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot push changeset while rebasing");
    }
    if (db.txns.isIndirectChanges) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot push changeset while in an indirect change scope");
    }

    const changesetProps = db[_nativeDb].startCreateChangeset() as ChangesetFileProps;
    changesetProps.briefcaseId = db.briefcaseId;
    changesetProps.description = arg.description;
    const fileSize = IModelJsFs.lstatSync(changesetProps.pathname)?.size;
    if (!fileSize) // either undefined or 0 means error
      throw new IModelError(IModelStatus.NoContent, "error creating changeset");

    changesetProps.size = fileSize;
    const id = IModelNative.platform.DgnDb.computeChangesetId(changesetProps);
    if (id !== changesetProps.id) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR_InvalidChangeSetVersion, `Changeset id ${changesetProps.id} does not match computed id ${id}.`);
    }

    let retryCount = arg.pushRetryCount ?? 3;
    while (true) {
      try {
        const accessToken = await IModelHost.getAccessToken();
        const index = await IModelHost[_hubAccess].pushChangeset({ accessToken, iModelId: db.iModelId, changesetProps });
        db[_nativeDb].completeCreateChangeset({ index });
        db.changeset = db[_nativeDb].getCurrentChangeset();
        if (!arg.retainLocks)
          await db.locks[_releaseAllLocks]();

        return;
      } catch (err: any) {
        const shouldRetry = () => {
          if (retryCount-- <= 0)
            return false;
          switch (err.errorNumber) {
            case IModelHubStatus.AnotherUserPushing:
            case IModelHubStatus.DatabaseTemporarilyLocked:
            case IModelHubStatus.OperationFailed:
              return true;
          }
          return false;
        };

        if (!shouldRetry()) {
          db[_nativeDb].abandonCreateChangeset();
          throw err;
        }
      } finally {
        IModelJsFs.removeSync(changesetProps.pathname);
      }
    }
  }

  /** Pull/merge (if necessary), then push all local changes as a changeset. Called by [[BriefcaseDb.pushChanges]]
   * @internal
   */
  public static async pullMergePush(db: BriefcaseDb, arg: PushChangesArgs): Promise<void> {
    let retryCount = arg.mergeRetryCount ?? 5;
    while (true) {
      try {
        await BriefcaseManager.pullAndApplyChangesets(db, arg);
        if (!db.skipSyncSchemasOnPullAndPush)
          await SchemaSync.pull(db);
        // pullAndApply rebase changes and might remove redundant changes in local briefcase
        // this mean hasPendingTxns was true before but now after pullAndApply it might be false
        if (!db[_nativeDb].hasPendingTxns())
          return;

        await BriefcaseManager.pushChanges(db, arg);
      } catch (err: any) {
        if (retryCount-- <= 0 || err.errorNumber !== IModelHubStatus.PullIsRequired)
          throw (err);
        await (arg.mergeRetryDelay ?? BeDuration.fromSeconds(3)).wait();
      }
    }
  }

  // #region Semantic Rebase Interop Helper
  private static readonly SCHEMAS_FOLDER = "Schemas";
  private static readonly DATA_FOLDER = "Data";
  private static readonly DATA_FILE_NAME = "Data.json";

  /**
   * captures the changed instances as patch instances from each data txn in the briefcase db for semantic rebase
   * @param db The {@link BriefcaseDb} instance for which to capture the changed instances as patch instances for all data txns
   * @internal
   */
  private static capturePatchInstances(db: BriefcaseDb): void {
    const txns = Array.from(db.txns.queryTxns());
    txns.forEach((txn) => {
      if (txn.type !== "Data") return;
      // already captured(This actually shows that first rebase operation is already done but during that while reinstating this txns,
      // some error happened so the folder still exists so we don't want to capture again)
      if (this.semanticRebaseDataFolderExists(db, txn.id)) return;
      const changedInstances = this.captureChangedInstancesAsJSON(txn.id, db);
      const instancePatches = this.constructPatchInstances(changedInstances, db);
      this.storeChangedInstancesForSemanticRebase(db, txn.id, instancePatches);
    });
  }

  /**
   * captures changed instances as JSON from a txn
   * @param txnId The txn id for which to capture changed instances
   * @param db The {@link BriefcaseDb} instance from which to capture changed instances as json
   * @returns changed instances {@link ChangedInstanceForSemanticRebase} for semantic rebase
   * @internal
   */
  private static captureChangedInstancesAsJSON(txnId: string, db: BriefcaseDb): ChangedInstanceForSemanticRebase[] {
    // todo for data changeset
    const reader = SqliteChangesetReader.openTxn({
      txnId, db, disableSchemaCheck: true
    });
    const adaptor = new ChangesetECAdaptor(reader);
    using indirectUnifier = new PartialECChangeUnifier(reader.db, ECChangeUnifierCache.createInMemoryCache());
    using directUnifier = new PartialECChangeUnifier(reader.db, ECChangeUnifierCache.createInMemoryCache());
    while (adaptor.step()) {
      if (adaptor.reader.isIndirect)
        indirectUnifier.appendFrom(adaptor);
      else
        directUnifier.appendFrom(adaptor);
    }
    return [...Array.from(directUnifier.instances).map((instance) => ({ isIndirect: false, instance })), ...Array.from(indirectUnifier.instances).map((instance) => ({ isIndirect: true, instance }))];
  }

  /**
   * constructs patch instances from changed instances
   * @param changedInstances The changed instances {@link ChangedInstanceForSemanticRebase} from which to construct the patch instances
   * @param db The {@link BriefcaseDb} instance for which to construct the patch instances
   * @returns  The {@link InstancePatch} instance patches for semantic rebase
   * @internal
   */
  private static constructPatchInstances(changedInstances: ChangedInstanceForSemanticRebase[], db: BriefcaseDb): InstancePatch[] {
    return changedInstances
      .filter((changedInstance) => !(changedInstance.instance.$meta?.op === "Updated" && changedInstance.instance.$meta.stage === "Old")) // we will not take the old stage of updated instances
      .map((changedInstance) => this.constructPatchInstance(changedInstance, db));
  }

  /**
   * Constructs a single patch instance from changed instance
   * @param changedInstance {@link ChangedInstanceForSemanticRebase} The changed instance from which to construct the patch instance
   * @param db The {@link BriefcaseDb} instance for which to construct the single patch instance
   * @returns a single instance patch {@link InstancePatch}
   * @internal
   */
  private static constructPatchInstance(changedInstance: ChangedInstanceForSemanticRebase, db: BriefcaseDb): InstancePatch {
    let className: string;
    if (changedInstance.instance.ECClassId) {
      className = db.getClassNameFromId(changedInstance.instance.ECClassId);
    } else if (changedInstance.instance.$meta?.classFullName) {
      className = changedInstance.instance.$meta.classFullName;
    } else if (changedInstance.instance.$meta?.fallbackClassId) {
      className = db.getClassNameFromId(changedInstance.instance.$meta.fallbackClassId);
    } else {
      throw new IModelError(IModelStatus.BadArg, "Cannot determine classId of changed instance");
    }

    const instanceKey: PatchInstanceKey = { id: changedInstance.instance.ECInstanceId, classFullName: className }
    if (changedInstance.instance.$meta?.op === "Inserted") {
      return {
        key: instanceKey,
        op: "Inserted",
        isIndirect: changedInstance.isIndirect,
        props: db[_nativeDb].readInstance(instanceKey, { useJsNames: true }),
      }
    }
    else if (changedInstance.instance.$meta?.op === "Updated") {
      return {
        key: instanceKey,
        op: "Updated",
        isIndirect: changedInstance.isIndirect,
        props: db[_nativeDb].readInstance(instanceKey, { useJsNames: true }),
      }
    }
    else if (changedInstance.instance.$meta?.op === "Deleted") {
      return {
        key: instanceKey,
        isIndirect: changedInstance.isIndirect,
        op: "Deleted",
      }
    }
    else
      throw new IModelError(IModelStatus.BadArg, `Unknown operation: ${changedInstance.instance.$meta?.op}`);
  }

  /**
   * Stores changed instances for semantic rebase locally in appropriate json file in a folder structure
   * @param db The {@link BriefcaseDb} instance for storing the changed instances against a txn
   * @param txnId The txn id for which we are storing the changed instances
   * @param instancePatches The {@link InstancePatch} instance patches to be stored
   * @internal
   */
  private static storeChangedInstancesForSemanticRebase(db: BriefcaseDb, txnId: string, instancePatches: InstancePatch[]): void {
    const basePath = this.getBasePathForSemanticRebaseLocalFiles(db);
    const targetDir = path.join(basePath, txnId, this.DATA_FOLDER);
    const filePath = path.join(targetDir, this.DATA_FILE_NAME);

    if (IModelJsFs.existsSync(targetDir))
      IModelJsFs.removeSync(targetDir);

    IModelJsFs.recursiveMkDirSync(targetDir);
    IModelJsFs.writeFileSync(filePath, JSON.stringify(instancePatches, undefined, 2));
  }

  /**
   * Gets the base path for semantic rebase local files
   * @param db The {@link BriefcaseDb} instance for which to get the base path
   * @returns base path for semantic rebase local files
   * @internal
   */
  public static getBasePathForSemanticRebaseLocalFiles(db: BriefcaseDb): string {
    return path.join(path.dirname(db.pathName), db.briefcaseId.toString());
  }

  /**
   * stores schemas for semantic rebase locally in appropriate folder structure
   * @param db The {@link BriefcaseDb} instance for storing the schemas against a txn
   * @param txnId The txn id for which we are storing the schemas
   * @param schemaFileNames The schema file paths or schema xml strings to be stored
   * @internal
   */
  public static storeSchemasForSemanticRebase<T extends LocalFileName[] | string[]>(db: BriefcaseDb, txnId: string, schemaFileNames: T): void {
    const basePath = this.getBasePathForSemanticRebaseLocalFiles(db);
    const targetDir = path.join(basePath, txnId, this.SCHEMAS_FOLDER);

    if (IModelJsFs.existsSync(targetDir))
      IModelJsFs.removeSync(targetDir);

    IModelJsFs.recursiveMkDirSync(targetDir);

    schemaFileNames.forEach((schemaFileOrXml, index) => {
      if (IModelJsFs.existsSync(schemaFileOrXml)) { // This means it is a file
        const fileName = path.basename(schemaFileOrXml);
        const filePath = path.join(targetDir, fileName);
        IModelJsFs.copySync(schemaFileOrXml, filePath);
      }
      else {
        const fileName = `${"Schema"}_${index}.ecschema.xml`;
        const filePath = path.join(targetDir, fileName);

        IModelJsFs.writeFileSync(filePath, schemaFileOrXml);
      }
    });
  }

  /**
   * Gets schemas for semantic rebase for a txn
   * @param db The {@link BriefcaseDb} instance for getting the locally stored schemas against a txn
   * @param txnId The txn id for which we are getting the schemas
   * @returns the schema file paths
   * @internal
   */
  public static getSchemasForTxn(db: BriefcaseDb, txnId: string): string[] {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const folderPath = path.join(basePath, txnId, BriefcaseManager.SCHEMAS_FOLDER);
    return IModelJsFs.readdirSync(folderPath).map((file) => path.join(folderPath, file));
  }

  /**
   * Get the changed instances data for semantic rebase for a txn
   * @param db - The {@link BriefcaseDb} instance for getting the locally stored changed instances against a txn
   * @param txnId - The txn id for which we are getting the changed instances
   * @returns Instance patches
   * @internal
   */
  public static getChangedInstancesDataForTxn(db: BriefcaseDb, txnId: string): InstancePatch[] {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const folderPath = path.join(basePath, txnId, BriefcaseManager.DATA_FOLDER);
    const filePath = path.join(folderPath, BriefcaseManager.DATA_FILE_NAME);
    const fileContents = IModelJsFs.readFileWithEncodingSync(filePath, "utf-8") as string;
    return JSON.parse(fileContents) as InstancePatch[];
  }

  /**
   * checks if schema folder exists for semantic rebase for a txn
   * @param db - The {@link BriefcaseDb} instance for which TO check the schema folder
   * @param txnId - The txn id for which we are check the schema folder
   * @returns true if exists, false otherwise
   * @internal
   */
  public static semanticRebaseSchemaFolderExists(db: BriefcaseDb, txnId: string): boolean {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const folderPath = path.join(basePath, txnId, BriefcaseManager.SCHEMAS_FOLDER);
    return IModelJsFs.existsSync(folderPath);
  }

  /**
   * checks if data folder exists for semantic rebase for a txn
   * @param db The {@link BriefcaseDb} instance for which to check the data folder.
   * @param txnId The txn id for which to check the data folder
   * @returns true if exists, false otherwise
   * @internal
   */
  public static semanticRebaseDataFolderExists(db: BriefcaseDb, txnId: string): boolean {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const folderPath = path.join(basePath, txnId, BriefcaseManager.DATA_FOLDER);
    return IModelJsFs.existsSync(folderPath);
  }

  /**
   * Deletes the schema folder for semantic rebase for a txn
   * @param db The {@link BriefcaseDb} instance for which to delete the schema folder.
   * @param txnId The txn id for which to delete the schema folder
   * @internal
   */
  public static deleteTxnSchemaFolder(db: BriefcaseDb, txnId: string): void {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const txnFolderPath = path.join(basePath, txnId);
    const folderPath = path.join(txnFolderPath, BriefcaseManager.SCHEMAS_FOLDER);

    if (!IModelJsFs.existsSync(folderPath)) return;

    IModelJsFs.removeSync(folderPath);

    if (IModelJsFs.readdirSync(txnFolderPath).length === 0) { // Also delete the txn folder if empty
      IModelJsFs.removeSync(txnFolderPath);
    }
  }

  /**
  * Deletes the data folder for semantic rebase for a txn
  * @param db The {@link BriefcaseDb} instance for which to delete the data folder.
  * @param txnId The txn id for which to delete the data folder
  * @internal
  */
  public static deleteTxnDataFolder(db: BriefcaseDb, txnId: string): void {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const txnFolderPath = path.join(basePath, txnId);
    const folderPath = path.join(txnFolderPath, BriefcaseManager.DATA_FOLDER);

    if (!IModelJsFs.existsSync(folderPath)) return;

    IModelJsFs.removeSync(folderPath);

    if (IModelJsFs.readdirSync(txnFolderPath).length === 0) { // Also delete the txn folder if empty
      IModelJsFs.removeSync(txnFolderPath);
    }
  }

  /**
   * deletes rebase folders for semantic rebase
   * @param db The {@link BriefcaseDb} instance for which to delete the rebase folders.
   * @param checkIfEmpty If true, only deletes the base folder if it is empty, default is false
   * @internal
   */
  public static deleteRebaseFolders(db: BriefcaseDb, checkIfEmpty: boolean = false): void {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    if (!IModelJsFs.existsSync(basePath)) return;

    if (checkIfEmpty) {
      const txnIds = IModelJsFs.readdirSync(basePath);
      if (txnIds.length > 0) return;
    }

    IModelJsFs.removeSync(basePath);
  }

  /**
   * Cleans up rebase folders for semantic rebase given briefcase file path and briefcase id
   * @param briefcaseFilePath The briefcase file path
   * @param briefcaseId The briefcase id
   * @internal
   */
  private static cleanupRebaseFolders(briefcaseFilePath: LocalFileName, briefcaseId: BriefcaseId): void {
    const folderPath = path.join(path.dirname(briefcaseFilePath), briefcaseId.toString());
    if (!IModelJsFs.existsSync(folderPath)) return;

    IModelJsFs.removeSync(folderPath);
  }

  // #endregion

}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore cset csets ecchanges

import * as path from "path";
import {
  AccessToken, BeDuration, ChangeSetStatus, DbResult, GuidString, IModelHubStatus, IModelStatus, Logger, OpenMode, Optional, StopWatch
} from "@itwin/core-bentley";
import {
  BriefcaseId, BriefcaseIdValue, BriefcaseProps, ChangesetFileProps, ChangesetIndex, ChangesetIndexOrId, ChangesetProps, ChangesetRange, ChangesetType, IModelError, IModelVersion, LocalBriefcaseProps,
  LocalDirName, LocalFileName, RequestNewBriefcaseProps,
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
import { StashManager } from "./StashManager";

const loggerCategory = BackendLoggerCategory.IModelDb;

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
   *  For testing purpose
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
   *  For testing purpose
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
    const briefcaseId = arg.briefcaseId ?? await this.acquireNewBriefcaseId(arg);
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
    if (!db.isOpen || db[_nativeDb].isReadonly()) // don't use db.isReadonly - we reopen the file writable just for this operation but db.isReadonly is still true
      throw new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets");

    let currentIndex = db.changeset.index;
    if (currentIndex === undefined)
      currentIndex = (await IModelHost[_hubAccess].queryChangeset({ accessToken: arg.accessToken, iModelId: db.iModelId, changeset: { id: db.changeset.id } })).index;

    const reverse = (arg.toIndex && arg.toIndex < currentIndex) ? true : false;

    if (db[_nativeDb].hasPendingTxns() && reverse) {
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changesets when there are pending changes");
    }

    // Download change sets
    const changesets = await IModelHost[_hubAccess].downloadChangesets({
      accessToken: arg.accessToken,
      iModelId: db.iModelId,
      range: { first: reverse ? arg.toIndex! + 1 : currentIndex + 1, end: reverse ? currentIndex : arg.toIndex }, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      targetDir: BriefcaseManager.getChangeSetsPath(db.iModelId),
      progressCallback: arg.onProgress,
    });

    if (changesets.length === 0)
      return; // nothing to apply

    if (reverse)
      changesets.reverse();

    const nativeDb = db[_nativeDb];
    const briefcaseDb = db instanceof BriefcaseDb ? db : undefined;

    // create restore point if certain conditions are met
    if (briefcaseDb && briefcaseDb.txns.hasPendingTxns && !briefcaseDb.txns.hasPendingSchemaChanges && !reverse) {
      Logger.logInfo(loggerCategory, `Creating restore point ${this.PULL_MERGE_RESTORE_POINT_NAME}`);
      await this.createRestorePoint({ db: briefcaseDb, name: this.PULL_MERGE_RESTORE_POINT_NAME });
    }

    const reversedTxns = nativeDb.pullMergeReverseLocalChanges();
    Logger.logInfo(loggerCategory, `Reversed ${reversedTxns.length} local changes`);

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
    if (briefcaseDb) {
      await briefcaseDb.txns.changeMergeManager.resume();
    } else {
      // Only Briefcase has change management. Following is
      // for test related to standalone db with txn enabled.
      nativeDb.pullMergeRebaseBegin();
      let txnId= nativeDb.pullMergeRebaseNext();
      while(txnId) {
        nativeDb.pullMergeRebaseReinstateTxn();
        nativeDb.pullMergeRebaseUpdateTxn();
        txnId = nativeDb.pullMergeRebaseNext();
      }
      nativeDb.pullMergeRebaseEnd();
      if (!nativeDb.isReadonly) {
        nativeDb.saveChanges("Merge.");
      }
    }

    if (briefcaseDb && this.containsRestorePoint({db: briefcaseDb, name: this.PULL_MERGE_RESTORE_POINT_NAME})) {
      Logger.logInfo(loggerCategory, `Dropping restore point ${this.PULL_MERGE_RESTORE_POINT_NAME}`);
      this.dropRestorePoint({ db: briefcaseDb, name: this.PULL_MERGE_RESTORE_POINT_NAME });
    }
    // notify listeners
    db.notifyChangesetApplied();
  }

  /**
   * @internal
   * Creates a restore point for the specified briefcase database.
   *
   * This method first validates the provided restore point name, ensuring it is not empty.
   * It then drops any existing restore point with the same name before creating a new one.
   * The restore point is created using the `StashManager`, and its identifier is saved locally
   * in the database under a key derived from the restore point name.
   *
   * @param args - An object containing:
   *   - `db`: The {@link BriefcaseDb} instance for which to create the restore point.
   *   - `name`: The unique name for the restore point. Must be a non-empty string.
   * @returns A promise that resolves to the created stash object representing the restore point.
   * @throws {@link IModelError} If the provided restore point name is empty.``
   */
  public static async createRestorePoint(args: {db: BriefcaseDb, name: string}) {
    if (args.name.length === 0) {
      throw new IModelError(IModelStatus.BadArg, "Invalid restore point name");
    }
   this.dropRestorePoint(args);

    const stash = await StashManager.stash({db: args.db, description: `restore_point/${args.name}`});
    args.db[_nativeDb].saveLocalValue(`restore_point/${this.name}`, stash.id);
    return stash;
  }

  /**
   * @internal
   * Drops a previously created restore point from the specified briefcase database.
   *
   * This method looks up the restore point by its name, retrieves its internal identifier,
   * and removes the associated stash if it exists. If the provided restore point name is empty,
   * an error is thrown.
   *
   * @param args - An object containing:
   *   - `db`: The {@link BriefcaseDb} instance from which to drop the restore point.
   *   - `name`: The name of the restore point to be dropped. Must be a non-empty string.
   * @throws {@link IModelError} If the restore point name is invalid (empty).
   */
  public static dropRestorePoint(args: {db: BriefcaseDb, name: string}) {
    if (args.name.length === 0) {
      throw new IModelError(IModelStatus.BadArg, "Invalid restore point name");
    }
    const restorePointId = args.db[_nativeDb].queryLocalValue(`restore_point/${args.name}`);
    if (restorePointId) {
      StashManager.dropStash({db: args.db, stash: restorePointId});
    }
  }

  /**
   * @internal
   * Determines whether a restore point with the specified name exists in the given briefcase database.
   *
   * This method checks if a restore point identifier can be found for the provided name,
   * and verifies that the corresponding stash exists in the database.
   *
   * @param args - An object containing:
   *   - `db`: The {@link BriefcaseDb} instance to search within.
   *   - `name`: The name of the restore point to check for existence.
   * @returns `true` if the restore point exists and its stash is present; otherwise, `false`.
   * @throws {@link IModelError} with status {@link IModelStatus.BadArg} if the restore point name is empty.
   */
  public static containsRestorePoint(args: {db: BriefcaseDb, name: string}): boolean {
    if (args.name.length === 0) {
      throw new IModelError(IModelStatus.BadArg, "Invalid restore point name");
    }
    const restorePointId = args.db[_nativeDb].queryLocalValue(`restore_point/${args.name}`);
    if (!restorePointId){
      return false;
    }
    if (!StashManager.getStash({db: args.db, stash: restorePointId})) {
      return false;
    }
    return true;
  }

  /**
   * @internal
   * Restores the state of a briefcase database to a previously saved restore point.
   *
   * @param args - An object containing:
   *   - `db`: The {@link BriefcaseDb} instance to restore.
   *   - `name`: The name of the restore point to apply.
   * @throws {@link IModelError} If the restore point name is empty or the restore point cannot be found.
   * @remarks
   * This method looks up the specified restore point by name and applies it to the provided database.
   * If the restore point does not exist or the name is invalid, an error is thrown.
   * The operation is asynchronous and returns a promise that resolves when the restore is complete.
   */
  public static async restorePoint(args: {db: BriefcaseDb, name: string}) {
    if (args.name.length === 0) {
      throw new IModelError(IModelStatus.BadArg, "Invalid restore point name");
    }
    const restorePointId = args.db[_nativeDb].queryLocalValue(`restore_point/${this.name}`);
    if (!restorePointId) {
      throw new IModelError(IModelStatus.BadArg, "Restore point not found");
    }
    await StashManager.apply({db: args.db, stash: restorePointId, method: "restore"});
  }

  /** create a changeset from the current changes, and push it to iModelHub */
  private static async pushChanges(db: BriefcaseDb, arg: PushChangesArgs): Promise<void> {
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
        return await BriefcaseManager.pushChanges(db, arg);
      } catch (err: any) {
        if (retryCount-- <= 0 || err.errorNumber !== IModelHubStatus.PullIsRequired)
          throw (err);
        await (arg.mergeRetryDelay ?? BeDuration.fromSeconds(3)).wait();
      }
    }
  }

}

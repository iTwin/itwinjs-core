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
  AccessToken, BeDuration, ChangeSetStatus, DbResult, GuidString, IModelHubStatus, IModelStatus, Logger, OpenMode, Optional, StopWatch
} from "@itwin/core-bentley";
import {
  Base64EncodedString,
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
import { _bumpChannelVersion, _hubAccess, _findRegisteredMigration, _implicitTxn, _nativeDb, _recordMigration, _releaseAllLocks } from "./internal/Symbols";
import { IModelNative } from "./internal/NativePlatform";
import { StashManager, StashProps } from "./StashManager";
import { ChangeInstance, ChangeMeta } from "./ChangesetReaderTypes";
import { Migration, MigrationDetails, ReinstatedChanges } from "./Migration";

const loggerCategory = BackendLoggerCategory.IModelDb;

/** The argument for patch instances during semantic rebase
 * @internal
 */
export interface InstancePatch extends Omit<ChangeInstance, "$meta"> {
  $meta: Pick<ChangeMeta, "op" | "stage" | "isIndirectChange">;
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
  /** The first changeset index to revert (inclusive). All changesets from `toIndex` through the current index are reverted, leaving the briefcase at `toIndex - 1`. */
  toIndex: ChangesetIndex;
  /** If present, schema changes are skipped during the revert operation. */
  skipSchemaChanges?: true;
  /**
   * Specifies the action to take in case of failure during the revert operation. Default is `"revert"`.
   * - `"revert"`: Reverse all local transactions and delete them, restoring the briefcase to its pre-revert state.
   * - `"retain"`: Keep local changes as-is for caller inspection or manual recovery.
   * - `"delete"`: Close the briefcase and delete the local file. If an `accessToken` is available, also release the briefcaseId from iModelHub.
   */
  inCaseOfFailure?: "retain" | "revert" | "delete";
};

/** Manages downloading Briefcases and downloading and uploading changesets.
 * @public
 */
export class BriefcaseManager {
  /** @internal */
  public static readonly PULL_MERGE_RESTORE_POINT_NAME = "$pull_merge_restore_point";

  /**
   * Parses the structured description prefix written on migration changesets.
   * Returns the channel key and migration id if the prefix is present and well-formed,
   * or `undefined` if the description does not start with the prefix.
   * @internal
   */
  private static parseMigrationDescription(description: string | undefined): { channelKey: string; migrationId: string } | undefined {
    if (!description?.startsWith("[migration:"))
      return undefined;
    const match = /^\[migration:channel=([^;]+);id=([^\]]+)\]/.exec(description);
    if (!match)
      return undefined;
    return { channelKey: match[1], migrationId: match[2] };
  }

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
    const hasLocalSchemaTxn: boolean = briefcaseDb?.checkIfSchemaTxnExists() ?? false;
    const useSemanticRebase: boolean =
      briefcaseDb !== undefined &&
      IModelHost.useSemanticRebase &&
      (hasIncomingSchemaChange || hasLocalSchemaTxn);

    if (useSemanticRebase) {
      Logger.logInfo(loggerCategory, `Using semantic rebase (incoming schema change: ${hasIncomingSchemaChange}, local schema txn: ${hasLocalSchemaTxn})`);
    }

    if (!reverse) {
      if (briefcaseDb) {
        briefcaseDb.txns.rebaser.notifyReverseLocalChangesBegin();
        const reversedTxns = nativeDb.pullMergeReverseLocalChanges(useSemanticRebase);
        if (useSemanticRebase) {
          nativeDb.clearECDbCache(); // Clear the ECDb cache after reversing local changes to ensure consistency during semantic rebase with schema changes.
        }
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
        db[_nativeDb].abandonChanges();
        throw err;
      }

      // Phase 3: Detect migration changesets and run the per-migration reinstatement cycle.
      //
      // Migration changesets carry a structured description prefix as a fast hint.
      // The authoritative confirmation is whether the migration record appears in
      // ChannelRootAspect.jsonProperties.migrations[] after the changeset is applied.
      //
      // For each confirmed migration to a registered channel, we immediately:
      //   1. Reinstate local changes on top of the post-migration state.
      //   2. Call migrateLocalChanges to reconcile user edits with the migration.
      //   3. Save and re-reverse local changes so the next incoming changeset can be applied cleanly.
      //
      // This ensures each migration's migrateLocalChanges sees the iModel in the state right after
      // that specific migration was applied — not after some later migration has also been applied.
      if (briefcaseDb && !reverse) {
        const migrationInfo = BriefcaseManager.parseMigrationDescription(changeset.description);
        if (migrationInfo) {
          const { channelKey, migrationId } = migrationInfo;
          // Confirm the changeset is genuinely a migration by checking the record was written
          // to ChannelRootAspect. A plain changeset with a matching prefix would not write it.
          const isConfirmed = db.channels.getAppliedMigrations(channelKey).some((r) => r.id === migrationId);
          if (isConfirmed) {
            const { migration, channelHasRegistrations } = db.channels[_findRegisteredMigration](channelKey, migrationId);
            if (!channelHasRegistrations) {
              // Migration targets a channel this application never edits. Apply normally.
              Logger.logInfo(loggerCategory, `Migration changeset ${changeset.id} targets unrelated channel "${channelKey}" — continuing normally`);
            } else if (!migration) {
              // The application knows about this channel but not this migration id: it is out of date.
              throw new IModelError(
                IModelStatus.BadRequest,
                `Application update required: migration "${migrationId}" for channel "${channelKey}" is not recognized by this version of the application. Please update the application before pulling.`,
              );
            } else {
              Logger.logInfo(loggerCategory, `Running per-migration reinstatement cycle for migration "${migrationId}" (channel "${channelKey}")`);

              // Step 1: Reinstate local changes on top of the post-migration state.
              if (useSemanticRebase)
                await briefcaseDb.txns.rebaser.intermediateResumeSemantic();
              else
                await briefcaseDb.txns.rebaser.intermediateResume();

              // Step 2: Run migrateLocalChanges.
              // NOTE (Phase 5): ReinstatedChanges is currently empty. Phase 5 will populate it
              // by reading the reinstated transactions via the changeset reader.
              const record = db.channels.getAppliedMigrations(channelKey).find((r) => r.id === migrationId)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
              const reinstatedChanges: ReinstatedChanges = {
                inserted: new Set<string>(),
                updated: new Set<string>(),
                deleted: new Set<string>(),
              };
              await migration.migrateLocalChanges(briefcaseDb, record.details, reinstatedChanges);
              nativeDb.saveChanges(`migrateLocalChanges:${migration.id}`);
              Logger.logInfo(loggerCategory, `migrateLocalChanges complete for migration "${migrationId}"`);

              // Step 3: Re-reverse local changes so remaining incoming changesets apply cleanly.
              briefcaseDb.txns.rebaser.notifyReverseLocalChangesBegin();
              const reReversedTxns = nativeDb.pullMergeReverseLocalChanges(useSemanticRebase);
              if (useSemanticRebase) {
                nativeDb.clearECDbCache();
              }
              const reReversedTxnProps = reReversedTxns.map((txn) => briefcaseDb.txns.getTxnProps(txn)).filter((p): p is TxnProps => p !== undefined);
              briefcaseDb.txns.rebaser.notifyReverseLocalChangesEnd(reReversedTxnProps);
              Logger.logInfo(loggerCategory, `Re-reversed ${reReversedTxns.length} local changes after migration cycle`);
            }
          }
        }
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
    db[_nativeDb].saveChanges("Create restore point");
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
      db[_nativeDb].saveChanges("Drop restore point");
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

  /** create a changeset from the current changes, and push it to iModelHub
   */
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

  /**
   * Applies all pending migrations to the given briefcase and pushes each one to iModel Hub.
   *
   * Called automatically from [[BriefcaseDb.open]] when there are registered migrations that have
   * not yet been applied to this iModel. The algorithm:
   *
   * 1. Pull the latest changesets. The Phase 3 pull flow handles any migration changesets already
   *    pushed by other briefcases, calling `migrateLocalChanges` for each one as needed.
   * 2. If all registered migrations have now been applied (by another briefcase), stop early.
   * 3. Reverse local changes and enter the pull-merge rebase context.
   * 4. For each pending migration in registration order:
   *    a. Run `migrate()` in indirect mode (bypasses lock/channel checks) and save the changeset.
   *    b. Push immediately. On `PullIsRequired` (race) or unexpected error, discard the migration
   *       txn and break. Local changes remain reversed in the native rebase stack.
   *    c. **Per-migration reinstatement cycle**: call `intermediateResume()` to reinstate local
   *       changes on top of the just-pushed migration state, then call `migrateLocalChanges()` so
   *       this migration can reconcile the user's work with its specific post-migration state.
   *       Save, then re-reverse local changes to prepare for the next migration.
   * 5. Final `resume()`: reinstates local changes on top of the fully-migrated iModel, saves
   *    ("Merge."), and fires `notifyPullMergeEnd`. Also covers the break cases from step 4b,
   *    where local changes were already re-reversed before the loop exited.
   * 6. If a race was detected, loop back (up to 5 retries) from step 1.
   *
   * The per-migration reinstatement in step 4c mirrors the Phase 3 pull flow: each
   * `migrateLocalChanges` call sees the iModel in the state immediately after its own migration
   * was applied — not after any later migration has also run.
   *
   * @internal
   */
  public static async applyAndPushPendingMigrations(db: BriefcaseDb): Promise<void> {
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const accessToken = await IModelHost.getAccessToken();

      // Step 1: Pull the latest changesets. The Phase 3 pull flow handles any migration changesets
      // pushed by other briefcases, invoking migrateLocalChanges for each one.
      Logger.logInfo(loggerCategory, `Migration open check: pulling latest changes (attempt ${attempt + 1}/${maxRetries})`);
      await BriefcaseManager.pullAndApplyChangesets(db, { accessToken });

      // Step 2: Check whether there are still pending migrations after the pull.
      const pending = db.channels.getAllPendingMigrations();
      if (pending.length === 0) {
        Logger.logInfo(loggerCategory, "No pending migrations after pull. Migration check complete.");
        return;
      }

      Logger.logInfo(loggerCategory, `Found ${pending.length} pending migration(s). Starting apply-and-push cycle.`);

      // Step 3: Enter the pull-merge rebase context so the user's local changes can be safely
      // reversed and later reinstated around the migration work.
      const nativeDb = db[_nativeDb];
      db.txns.rebaser.notifyPullMergeBegin(db.changeset);
      db.txns.rebaser.notifyReverseLocalChangesBegin();
      const reversedTxns = nativeDb.pullMergeReverseLocalChanges(false);
      const reversedTxnProps = reversedTxns
        .map((txn) => db.txns.getTxnProps(txn))
        .filter((p): p is TxnProps => p !== undefined);
      db.txns.rebaser.notifyReverseLocalChangesEnd(reversedTxnProps);
      Logger.logInfo(loggerCategory, `Reversed ${reversedTxns.length} local change(s) before migration apply.`);

      let raceDetected = false;
      let unexpectedError: unknown;

      for (const migration of pending) {
        Logger.logInfo(loggerCategory, `Applying migration "${migration.id}" for channel "${migration.channelKey}".`);

        // Apply the migration in indirect mode so it bypasses channel lock checks, as specified
        // in the Migration interface contract: locks are neither required nor honored.
        let details: MigrationDetails | undefined;
        await db.txns.withIndirectTxnModeAsync(async () => {
          const txn = db[_implicitTxn];
          db.channels[_bumpChannelVersion](txn, migration.channelKey, migration.compatibility);
          details = await migration.migrate(db);
          db.channels[_recordMigration](txn, migration.channelKey, migration.id, details);
        });

        const description = `[migration:channel=${migration.channelKey};id=${migration.id}] Apply migration "${migration.id}"`;
        nativeDb.saveChanges(description);
        Logger.logInfo(loggerCategory, `Migration "${migration.id}" changes saved. Pushing immediately.`);

        // Push the migration immediately without pulling first. If another briefcase wins the race
        // (hub returns PullIsRequired), we discard the migration work and restart the outer loop.
        try {
          await BriefcaseManager.pushChanges(db, { accessToken, description, retainLocks: true });
          Logger.logInfo(loggerCategory, `Migration "${migration.id}" pushed successfully.`);
        } catch (err: any) {
          nativeDb.discardLocalChanges();
          if (err.errorNumber === IModelHubStatus.PullIsRequired) {
            Logger.logInfo(loggerCategory, `Push race detected for migration "${migration.id}". Discarding and retrying.`);
            raceDetected = true;
          } else {
            Logger.logError(loggerCategory, `Unexpected error pushing migration "${migration.id}": ${(err as Error).message}`);
            unexpectedError = err;
          }
          // In both cases the migration txn is discarded. Local changes remain reversed in the
          // native rebase stack — resume() below will reinstate them.
          break;
        }

        // Per-migration reinstatement cycle, matching the Phase 3 pull flow:
        //   1. Reinstate local changes on top of the just-pushed migration state.
        //   2. Call migrateLocalChanges so this migration can reconcile the user's work.
        //   3. Re-reverse local changes to prepare for the next migration.
        // This ensures migrateLocalChanges sees the iModel in the state right after THIS
        // migration was applied — not after some later migration has also been applied.
        Logger.logInfo(loggerCategory, `Running per-migration reinstatement for migration "${migration.id}".`);
        await db.txns.rebaser.intermediateResume();

        const record = db.channels.getAppliedMigrations(migration.channelKey).find((r) => r.id === migration.id);
        // NOTE (Phase 5): ReinstatedChanges is currently a stub with empty sets.
        // Phase 5 will populate it by reading reinstated txns via the changeset reader.
        const reinstatedChanges: ReinstatedChanges = {
          inserted: new Set<string>(),
          updated: new Set<string>(),
          deleted: new Set<string>(),
        };
        await migration.migrateLocalChanges(db, record?.details ?? details, reinstatedChanges);
        nativeDb.saveChanges(`migrateLocalChanges:${migration.id}`);
        Logger.logInfo(loggerCategory, `migrateLocalChanges complete for migration "${migration.id}".`);

        // Re-reverse local changes to prepare for the next migration (or for the final resume).
        db.txns.rebaser.notifyReverseLocalChangesBegin();
        const reReversedTxns = nativeDb.pullMergeReverseLocalChanges(false);
        const reReversedTxnProps = reReversedTxns
          .map((txn) => db.txns.getTxnProps(txn))
          .filter((p): p is TxnProps => p !== undefined);
        db.txns.rebaser.notifyReverseLocalChangesEnd(reReversedTxnProps);
        Logger.logInfo(loggerCategory, `Re-reversed ${reReversedTxns.length} local change(s) after migration "${migration.id}".`);
      }

      // Final reinstatement: reinstates local changes (including all migrateLocalChanges results)
      // on top of the final post-migration iModel state. Saves and fires notifyPullMergeEnd.
      // Also handles the race/error cases, where local changes were re-reversed before the break.
      Logger.logInfo(loggerCategory, "Final reinstatement after migration cycle.");
      await db.txns.rebaser.resume();

      if (unexpectedError !== undefined)
        throw unexpectedError;

      if (!raceDetected) {
        Logger.logInfo(loggerCategory, "All pending migrations applied successfully.");
        return;
      }

      // Race detected: loop back to retry from the pull step.
    }

    throw new IModelError(
      IModelStatus.BadRequest,
      `Failed to apply pending migrations after 5 attempts. The iModel may be under heavy concurrent use.`,
    );
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
  private static readonly REBASING_FOLDER = ".rebasing";
  private static readonly EC_FOLDER = "ec";
  private static readonly SCHEMAS_FOLDER = "schemas";
  private static readonly DATA_FOLDER = "data";
  private static readonly DATA_FILE_NAME = "data.json";

  /**
   * Stores changed instances for semantic rebase locally in appropriate json file in a folder structure
   * @param db The [BriefcaseDb]($backend) instance for storing the changed instances against a txn
   * @param txnId The txn id for which we are storing the changed instances
   * @param instancePatches The [ChangeInstance]($backend) IterableIterator instance patches to be stored
   * @internal
   */
  public static storeChangedInstancesForSemanticRebase(db: BriefcaseDb, txnId: string, instancePatches: IterableIterator<ChangeInstance>): void {
    const basePath = this.getBasePathForSemanticRebaseLocalFiles(db);
    const targetDir = path.join(basePath, txnId, this.DATA_FOLDER);
    const filePath = path.join(targetDir, this.DATA_FILE_NAME);

    if (IModelJsFs.existsSync(targetDir))
      IModelJsFs.removeSync(targetDir);

    IModelJsFs.recursiveMkDirSync(targetDir);

    const BATCH_SIZE = 100;
    let isFirst = true;
    let batchParts: string[] = [];

    const flushBatch = () => {
      if (batchParts.length === 0) return;
      IModelJsFs.appendFileSync(filePath, batchParts.join(""));
      batchParts = [];
    };

    IModelJsFs.writeFileSync(filePath, "[");
    for (const instancePatch of instancePatches) {
      // we will not take the old stage of updated instances for now, because we still don't have conflict resolution on instance level while using semantic rebase.
      // Once we have conflict resolution on instance level, we can consider taking old stage of updated instances as well.
      if (instancePatch.$meta.op === "Updated" && instancePatch.$meta.stage === "Old") continue;
      const { $meta, ...rest } = instancePatch;
      const transformedInstance: InstancePatch = {
        ...rest,
        $meta: { op: $meta.op, stage: $meta.stage, isIndirectChange: $meta.isIndirectChange },
      };
      batchParts.push(`${isFirst ? "" : ","}\n${JSON.stringify(transformedInstance, Base64EncodedString.replacer)}`);
      isFirst = false;
      if (batchParts.length >= BATCH_SIZE)
        flushBatch();
    }
    flushBatch();
    IModelJsFs.appendFileSync(filePath, "\n]");
  }

  /**
   * Gets the base path for semantic rebase local files
   * @param db The {@link BriefcaseDb} instance for which to get the base path
   * @returns base path for semantic rebase local files
   * @internal
   */
  public static getBasePathForSemanticRebaseLocalFiles(db: BriefcaseDb): string {
    return path.join(path.dirname(db.pathName), this.REBASING_FOLDER, db.briefcaseId.toString(), this.EC_FOLDER);
  }

  /**
   * Stores schemas for semantic rebase locally in appropriate folder structure
   * @param db The [BriefcaseDb]($backend) instance for storing the schemas against a txn
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
   * @param db The [BriefcaseDb]($backend) instance for getting the locally stored schemas against a txn
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
   * @param db - The [BriefcaseDb]($backend) instance for getting the locally stored changed instances against a txn
   * @param txnId - The txn id for which we are getting the changed instances
   * @returns Instance patches
   * @internal
   */
  public static async *getChangedInstancesDataForTxn(db: BriefcaseDb, txnId: string): AsyncGenerator<InstancePatch> {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const folderPath = path.join(basePath, txnId, BriefcaseManager.DATA_FOLDER);
    const filePath = path.join(folderPath, BriefcaseManager.DATA_FILE_NAME);
    for await (const line of IModelJsFs.readLines(filePath)) {
      if (line === "[" || line === "]" || line === "") continue;
      const trimmedLine = line.trim().endsWith(",") ? line.trim().slice(0, -1) : line.trim(); // remove trailing comma if exists
      yield JSON.parse(trimmedLine, Base64EncodedString.reviver) as InstancePatch;
    }
  }

  /**
   * Checks if schema folder exists for semantic rebase for a txn
   * @param db - The [BriefcaseDb]($backend) instance for which TO check the schema folder
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
   * Checks if data folder exists for semantic rebase for a txn
   * @param db The [BriefcaseDb]($backend) instance for which to check the data folder.
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
   * @param db The [BriefcaseDb]($backend) instance for which to delete the schema folder.
   * @param txnId The txn id for which to delete the schema folder
   * @internal
   */
  public static deleteTxnSchemaFolder(db: BriefcaseDb, txnId: string): void {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const txnFolderPath = path.join(basePath, txnId);
    const folderPath = path.join(txnFolderPath, BriefcaseManager.SCHEMAS_FOLDER);

    if (!IModelJsFs.existsSync(folderPath)) return;

    IModelJsFs.removeSync(folderPath);

    if (IModelJsFs.readdirSync(txnFolderPath).length === 0) // Also delete the txn folder if empty
      IModelJsFs.removeSync(txnFolderPath);
  }

  /**
  * Deletes the data folder for semantic rebase for a txn
  * @param db The [BriefcaseDb]($backend) instance for which to delete the data folder.
  * @param txnId The txn id for which to delete the data folder
  * @internal
  */
  public static deleteTxnDataFolder(db: BriefcaseDb, txnId: string): void {
    const basePath = BriefcaseManager.getBasePathForSemanticRebaseLocalFiles(db);
    const txnFolderPath = path.join(basePath, txnId);
    const folderPath = path.join(txnFolderPath, BriefcaseManager.DATA_FOLDER);

    if (!IModelJsFs.existsSync(folderPath)) return;

    IModelJsFs.removeSync(folderPath);

    if (IModelJsFs.readdirSync(txnFolderPath).length === 0) // Also delete the txn folder if empty
      IModelJsFs.removeSync(txnFolderPath);
  }

  /**
   * Deletes rebase folders for semantic rebase
   * @param db The [BriefcaseDb]($backend) instance for which to delete the rebase folders.
   * @param checkIfEmpty If true, only deletes the base folder if it is empty, default is false
   * @internal
   */
  public static deleteRebaseFolders(db: BriefcaseDb, checkIfEmpty: boolean = false): void {
    const briefcaseRebasingRoot = path.join(path.dirname(db.pathName), this.REBASING_FOLDER, db.briefcaseId.toString());
    if (!IModelJsFs.existsSync(briefcaseRebasingRoot)) return;

    if (checkIfEmpty) {
      const basePath = this.getBasePathForSemanticRebaseLocalFiles(db);
      if (IModelJsFs.existsSync(basePath) && IModelJsFs.readdirSync(basePath).length > 0) return;
    }

    IModelJsFs.removeSync(briefcaseRebasingRoot);

    // remove .rebasing root if it's now empty
    const rebasingRoot = path.join(path.dirname(db.pathName), this.REBASING_FOLDER);
    if (IModelJsFs.existsSync(rebasingRoot) && IModelJsFs.readdirSync(rebasingRoot).length === 0)
      IModelJsFs.removeSync(rebasingRoot);
  }

  /**
   * Cleans up rebase folders for semantic rebase given briefcase file path and briefcase id
   * @param briefcaseFilePath The briefcase file path
   * @param briefcaseId The briefcase id
   * @internal
   */
  private static cleanupRebaseFolders(briefcaseFilePath: LocalFileName, briefcaseId: BriefcaseId): void {
    const briefcaseRebasingRoot = path.join(path.dirname(briefcaseFilePath), this.REBASING_FOLDER, briefcaseId.toString());
    if (IModelJsFs.existsSync(briefcaseRebasingRoot))
      IModelJsFs.removeSync(briefcaseRebasingRoot);

    // remove .rebasing root if it's now empty
    const rebasingRoot = path.join(path.dirname(briefcaseFilePath), this.REBASING_FOLDER);
    if (IModelJsFs.existsSync(rebasingRoot) && IModelJsFs.readdirSync(rebasingRoot).length === 0)
      IModelJsFs.removeSync(rebasingRoot);
  }

  // #endregion

}

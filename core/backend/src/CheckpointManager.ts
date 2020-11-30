/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore BLOCKCACHE

import * as path from "path";
import { BriefcaseStatus, ChangeSetStatus, DbResult, Guid, GuidString, IModelStatus, Logger, LogLevel, OpenMode, PerfLogger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, CancelRequest, ProgressCallback, ProgressInfo, UserCancelledError } from "@bentley/itwin-client";
import { BriefcaseIdValue, BriefcaseManager } from "./BriefcaseManager";
import { SnapshotDb } from "./IModelDb";
import { Checkpoint, CheckpointQuery } from "@bentley/imodelhub-client";
import { IModelHost } from "./IModelHost";
import { IModelError } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BlobDaemon, BlobDaemonCommandArg } from "@bentley/imodeljs-native";
import { IModelJsFs } from "./IModelJsFs";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Status of downloading a checkpoint
 * @internal
 */
export enum DownloadCheckpointStatus {
  NotStarted,
  QueryCheckpointService,
  DownloadingCheckpoint,
  DownloadingChangeSets,
  ApplyingChangeSets,
  Complete,
  Error,
}

/**
 * Properties of a checkpoint
 * @internal
 */
export interface CheckpointProps {
  /** Context (Project or Asset) that the iModel belongs to */
  readonly contextId: GuidString;

  /** Id of the iModel */
  readonly iModelId: GuidString;

  /** Id of the change set */
  readonly changeSetId: GuidString;

  readonly requestContext: AuthorizedClientRequestContext;
}

/**
 * @internal
 */
export interface DownloadRequest {
  /** Properties of the checkpoint that's being downloaded */
  checkpoint: CheckpointProps;

  /** called to indicate progress is being made */
  onProgress?: ProgressCallback;

  /** Request cancellation of the download */
  requestCancel?: CancelRequest;
}

export interface DownloadJob {
  request: DownloadRequest;
  pathName: string;
  status: DownloadCheckpointStatus;
  promise?: Promise<any>;
}

export class Downloads {
  private static _active = new Map<string, DownloadJob>();

  private static async process<T>(job: DownloadJob, fn: (job: DownloadJob) => Promise<T>) {
    const status = await fn(job);
    this._active.delete(job.pathName);
    return status;
  }

  private static isInProgress(pathName: string): DownloadJob | undefined {
    return this._active.get(pathName);
  }

  public static async download<T>(request: DownloadRequest, pathName: string, downloadFn: (job: DownloadJob) => Promise<T>) {
    let job = this.isInProgress(pathName);
    if (undefined !== job)
      return job.promise;

    job = { request, pathName, status: DownloadCheckpointStatus.NotStarted };
    this._active.set(pathName, job);
    return job.promise = this.process(job, downloadFn);
  }
}

export class V2CheckpointManager {
  public static getKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeSetId}-V2`; }
  private static async getCommandArgs(checkpoint: CheckpointProps): Promise<BlobDaemonCommandArg> {
    const { requestContext, iModelId, changeSetId } = checkpoint;

    requestContext.enter();
    const bcvDaemonCachePath = process.env.BLOCKCACHE_DIR;
    if (!bcvDaemonCachePath)
      throw new IModelError(IModelStatus.BadRequest, "Invalid config: BLOCKCACHE_DIR is not set!", Logger.logError, loggerCategory);

    const checkpointQuery = new CheckpointQuery().byChangeSetId(changeSetId).selectBCVAccessKey();
    const checkpoints: Checkpoint[] = await BriefcaseManager.imodelClient.checkpoints.get(requestContext, iModelId, checkpointQuery);
    requestContext.enter();

    if (checkpoints.length < 1)
      throw new IModelError(IModelStatus.NotFound, "Checkpoint not found", Logger.logError, loggerCategory);

    const { bcvAccessKeyContainer, bcvAccessKeySAS, bcvAccessKeyAccount, bcvAccessKeyDbName } = checkpoints[0];
    if (!bcvAccessKeyContainer || !bcvAccessKeySAS || !bcvAccessKeyAccount || !bcvAccessKeyDbName)
      throw new IModelError(IModelStatus.BadRequest, "Invalid checkpoint in iModelHub", Logger.logError, loggerCategory);

    return {
      container: bcvAccessKeyContainer,
      auth: bcvAccessKeySAS,
      daemonDir: bcvDaemonCachePath,
      storageType: "azure",
      user: bcvAccessKeyAccount,
      dbAlias: bcvAccessKeyDbName,
      writeable: false,
    };
  }

  public static async attach(checkpoint: CheckpointProps): Promise<string> {
    const args = await this.getCommandArgs(checkpoint);

    // We can assume that a BCVDaemon process is already started if BLOCKCACHE_DIR was set, so we need to just tell the daemon to attach to the Storage Container
    const attachResult = await BlobDaemon.command("attach", args);
    if (attachResult.result !== DbResult.BE_SQLITE_OK)
      throw new IModelError(attachResult.result, `BlockCacheVfs attach failed: ${attachResult.errMsg}`, Logger.logError, loggerCategory);

    return BlobDaemon.getDbFileName(args);
  }

  // Fully download a V2 checkpoint to a local file that can be used to create a briefcase or to work offline.
  public static async downloadLocal(checkpoint: CheckpointProps, localFile: string, onProgress?: (nDone: number, nTotal: number) => number) {
    return BlobDaemon.command("download", { ... await this.getCommandArgs(checkpoint), localFile, onProgress });
  }
}

export class V1CheckpointManager {
  public static getKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeSetId}-V1`; }

  public static getFolder(checkpoint: CheckpointProps) {
    const pathBaseName = path.join(BriefcaseManager.getBriefcaseBasePath(checkpoint.iModelId), "cp");
    return path.join(pathBaseName, BriefcaseManager.getChangeSetFolderNameFromId(checkpoint.changeSetId));
  }

  public static getFileName(checkpoint: CheckpointProps) {
    return path.join(this.getFolder(checkpoint), "bc.bim");
  }

  public static async getCheckpointDb(request: DownloadRequest): Promise<SnapshotDb> {
    const checkpoint = request.checkpoint;
    const key = this.getKey(checkpoint);
    const db = SnapshotDb.tryFindByKey(key);
    if (undefined !== db)
      return db as SnapshotDb;

    if (this.verifyCheckpoint(checkpoint))
      return SnapshotDb.openCheckpointV1(checkpoint);

    BriefcaseManager.createFolder(this.getFolder(checkpoint));
    return Downloads.download(request, this.getFileName(checkpoint), this.performDownload);
  }

  private static verifyCheckpoint(checkpoint: CheckpointProps): boolean {
    const filename = this.getFileName(checkpoint);
    if (!IModelJsFs.existsSync(filename))
      return false;

    const nativeDb = new IModelHost.platform.DgnDb();
    const status = nativeDb.openIModel(name, OpenMode.Readonly);
    if (DbResult.BE_SQLITE_OK !== status)
      return false;

    const isValid = checkpoint.iModelId === nativeDb.getDbGuid() && checkpoint.changeSetId === nativeDb.getParentChangeSetId();
    nativeDb.closeIModel();
    return isValid;
  }

  private static async performDownload(job: DownloadJob): Promise<void> {
    const requestedCkp = job.request.checkpoint;
    const requestContext = requestedCkp.requestContext;
    requestContext.enter();
    const traceInfo = { contextId: requestedCkp.contextId, iModelId: requestedCkp.iModelId, changeSetId: requestedCkp.changeSetId, localFile: job.pathName };
    try {
      Logger.logTrace(loggerCategory, "starting checkpoint download", () => traceInfo);
      const perfLogger = new PerfLogger("starting checkpoint download", () => traceInfo);

      job.status = DownloadCheckpointStatus.QueryCheckpointService;

      // Download checkpoint
      let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
      checkpointQuery = checkpointQuery.precedingCheckpoint(requestedCkp.changeSetId);
      const checkpoints = await IModelHost.iModelClient.checkpoints.get(requestedCkp.requestContext, requestedCkp.iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length === 0)
        throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found", Logger.logError, loggerCategory, () => traceInfo);
      const checkpoint = checkpoints[0];

      job.status = DownloadCheckpointStatus.DownloadingCheckpoint;
      const progressCallback = Logger.isEnabled(loggerCategory, LogLevel.Trace) ? this.enableDownloadTrace(checkpoint, job.request.onProgress) : job.request.onProgress;
      try {
        await IModelHost.iModelClient.checkpoints.download(requestContext, checkpoint, job.pathName, progressCallback, job.request.requestCancel);
      } catch (error) {
        requestContext.enter();
        if (!(error instanceof UserCancelledError))
          Logger.logError(loggerCategory, "Could not download checkpoint file", () => ({ error: error.message || error.name }));
        throw error;
      }
      requestContext.enter();

      // Open checkpoint for write
      const db = SnapshotDb.openForCheckpointCreation(job.pathName);
      const nativeDb = db.nativeDb;

      // Note: A defect in applying change sets caused some checkpoints to be created with Txns - we need to clear these out
      // at least until these checkpoints aren't being used. The error typically is a worry only
      // for ReadWrite applications, and can be eventually phased out based on the occurrence of the log warning below.
      if (nativeDb.hasPendingTxns()) {
        Logger.logWarning(loggerCategory, "Checkpoint with Txns found - deleting them", () => traceInfo);
        nativeDb.deleteAllTxns();
      }

      if (nativeDb.getBriefcaseId() !== BriefcaseIdValue.Standalone)
        nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);

      // Validate the native briefcase against the checkpoint meta-data
      try {
        const dbChangeSetId = nativeDb.getParentChangeSetId();
        if (dbChangeSetId !== checkpoint.mergedChangeSetId)
          throw new IModelError(IModelStatus.ValidationFailed, "BriefcaseManager.finishCreateBriefcase: ParentChangeSetId of the checkpoint was not correctly setup", Logger.logError, loggerCategory, () => ({ ...traceInfo, ...checkpoint, dbChangeSetId }));
        const dbContextGuid = Guid.normalize(nativeDb.queryProjectGuid());
        if (dbContextGuid !== Guid.normalize(requestedCkp.contextId))
          throw new IModelError(IModelStatus.ValidationFailed, "BriefcaseManager.finishCreateBriefcase: ContextId was not properly setup in the briefcase", Logger.logError, loggerCategory, () => ({ ...traceInfo, dbContextGuid }));

        // Apply change sets if necessary
        if (dbChangeSetId !== requestedCkp.changeSetId) {
          job.status = DownloadCheckpointStatus.ApplyingChangeSets;
          await BriefcaseManager.processChangeSets(requestContext, db, requestedCkp.changeSetId);
          requestContext.enter();
        }
      } finally {
        db.close();
      }

      // Set the flag to mark that briefcase download has completed
      job.status = DownloadCheckpointStatus.Complete;

      perfLogger.dispose();
      Logger.logTrace(loggerCategory, "Finished downloading checkpoint", () => traceInfo);
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Error downloading checkpoint - deleting it", () => traceInfo);

      job.status = DownloadCheckpointStatus.Error;
      IModelJsFs.removeSync(job.pathName);

      if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
        Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them to enable retries", () => traceInfo);
        BriefcaseManager.deleteChangeSetsFromLocalDisk(requestedCkp.iModelId);
      }
      throw error;
    }
  }

  private static enableDownloadTrace(checkpoint: Checkpoint, progressCallback?: ProgressCallback): ProgressCallback {
    const sasUrl = new URL(checkpoint.downloadUrl!);
    const se = sasUrl.searchParams.get("se");
    if (se) {
      const expiresAt = new Date(se);
      const now = new Date();
      const expiresInSeconds = (expiresAt.getTime() - now.getTime()) / 1000;
      Logger.logTrace(loggerCategory, "BriefcaseManager.downloadCheckpoint: Downloading checkpoint (started)...", () => ({
        expiresInSeconds,
        fileSizeInBytes: checkpoint.fileSize,
        iModelId: checkpoint.fileId,
      }));
    }

    let lastReported = 0;
    const startedTime = (new Date()).getTime();
    const progressCallbackWrapper = (progressInfo: ProgressInfo) => {
      if (progressCallback)
        progressCallback(progressInfo);
      if (progressInfo.percent === undefined)
        return;
      if (progressInfo.percent - lastReported > 5.0) {
        lastReported = progressInfo.percent;
        const currentTime = (new Date()).getTime();
        const elapsedSeconds = (currentTime - startedTime) / 1000;
        const remainingSeconds = (elapsedSeconds * (100.0 - progressInfo.percent)) / progressInfo.percent;
        Logger.logTrace(loggerCategory, "BriefcaseManager.downloadCheckpoint: Downloading checkpoint (progress)...", () => ({
          downloadedBytes: progressInfo.loaded, totalBytes: progressInfo.total, percentComplete: progressInfo.percent?.toFixed(2),
          elapsedSeconds: elapsedSeconds.toFixed(0), remainingSeconds: remainingSeconds.toFixed(0),
          iModelId: checkpoint.fileId,
        }));
      }
    };
    return progressCallbackWrapper;
  }


}

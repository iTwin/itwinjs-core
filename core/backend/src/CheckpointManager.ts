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
import { Checkpoint, CheckpointQuery, CheckpointV2, CheckpointV2Query } from "@bentley/imodelhub-client";
import { IModelHost } from "./IModelHost";
import { DownloadBriefcaseStatus, IModelError } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BlobDaemon, BlobDaemonCommandArg } from "@bentley/imodeljs-native";
import { IModelJsFs } from "./IModelJsFs";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Properties of a checkpoint
 * @internal
 */
export interface CheckpointProps {
  expectV2?: boolean;

  /** Context (Project or Asset) that the iModel belongs to */
  contextId: GuidString;

  /** Id of the iModel */
  iModelId: GuidString;

  /** Id of the change set */
  changeSetId: GuidString;

  requestContext: AuthorizedClientRequestContext;
}

/**
 * @internal
 */
export interface DownloadRequest {
  /** name of local file to create. */
  localFile: string;

  /** Properties of the checkpoint that's being downloaded */
  checkpoint: CheckpointProps;

  /** called to indicate progress is being made */
  onProgress?: ProgressCallback;

  /** While download is pending, call `.cancel` method to cancel the download */
  cancelRequest?: CancelRequest;
}

export interface DownloadJob {
  request: DownloadRequest;
  pathName: string;
  status: DownloadBriefcaseStatus;
  promise?: Promise<any>;
}

export class Downloads {
  private static _active = new Map<string, DownloadJob>();

  private static async process<T>(job: DownloadJob, fn: (job: DownloadJob) => Promise<T>) {
    try {
      return await fn(job);
    } finally {
      this._active.delete(job.pathName);
    }
  }

  public static isInProgress(pathName: string): DownloadJob | undefined {
    return this._active.get(pathName);
  }

  public static async download<T>(request: DownloadRequest, downloadFn: (job: DownloadJob) => Promise<T>) {
    const pathName = request.localFile;
    let job = this.isInProgress(pathName);
    if (undefined !== job)
      return job.promise;

    IModelJsFs.recursiveMkDirSync(path.dirname(pathName));
    job = { request, pathName, status: DownloadBriefcaseStatus.NotStarted };
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
    if (!bcvDaemonCachePath) {
      if (checkpoint.expectV2)
        Logger.logError(loggerCategory, "Invalid config: BLOCKCACHE_DIR is not set");

      throw new IModelError(IModelStatus.BadRequest, "Invalid config: BLOCKCACHE_DIR is not set");
    }

    let checkpointV2: CheckpointV2;
    try {
      const checkpointQuery = new CheckpointV2Query().byChangeSetId(changeSetId).selectContainerAccessKey();
      checkpointV2 = (await BriefcaseManager.imodelClient.checkpointsV2.get(requestContext, iModelId, checkpointQuery))[0];
      requestContext.enter();
    } catch (err) {
      throw new IModelError(IModelStatus.NotFound, "Checkpoint not found", Logger.logError, loggerCategory);
    }

    const { containerAccessKeyContainer, containerAccessKeySAS, containerAccessKeyAccount, containerAccessKeyDbName } = checkpointV2;
    if (!containerAccessKeyContainer || !containerAccessKeySAS || !containerAccessKeyAccount || !containerAccessKeyDbName)
      throw new IModelError(IModelStatus.BadRequest, "Invalid checkpoint in iModelHub", Logger.logError, loggerCategory);

    return {
      container: containerAccessKeyContainer,
      auth: containerAccessKeySAS,
      daemonDir: bcvDaemonCachePath,
      storageType: "azure",
      user: containerAccessKeyAccount,
      dbAlias: containerAccessKeyDbName,
      writeable: false,
    };
  }

  public static async attach(checkpoint: CheckpointProps): Promise<string> {
    const args = await this.getCommandArgs(checkpoint);

    // We can assume that a BCVDaemon process is already started if BLOCKCACHE_DIR was set, so we need to just tell the daemon to attach to the Storage Container
    const attachResult = await BlobDaemon.command("attach", args);
    if (attachResult.result !== DbResult.BE_SQLITE_OK) {
      const error = `Daemon attach failed: ${attachResult.errMsg}`;
      if (checkpoint.expectV2)
        Logger.logError(loggerCategory, error);

      throw new IModelError(attachResult.result, error);
    }
    return BlobDaemon.getDbFileName(args);
  }

  private static async performDownload(job: DownloadJob) {
    const request = job.request;
    let aborted = 0;
    if (request.cancelRequest)
      request.cancelRequest.cancel = () => { aborted = 1; return true; };
    const onProgress = (loaded: number, total: number) => { request.onProgress?.({ loaded, total }); return aborted; };
    return BlobDaemon.command("download", { ... await this.getCommandArgs(request.checkpoint), localFile: request.localFile, onProgress });
  }

  // Fully download a V2 checkpoint to a local file that can be used to create a briefcase or to work offline.
  public static async downloadCheckpoint(request: DownloadRequest) {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }
}

export class V1CheckpointManager {
  public static getKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeSetId}-V1`; }

  public static getFolder(checkpoint: CheckpointProps) {
    return path.join(BriefcaseManager.getIModelPath(checkpoint.iModelId), "checkpoints");
  }

  public static getFileName(checkpoint: CheckpointProps) {
    const changeSetId = checkpoint.changeSetId || "first";
    return path.join(this.getFolder(checkpoint), `${changeSetId}.bim`);
  }

  public static async getCheckpointDb(request: DownloadRequest): Promise<SnapshotDb> {
    const checkpoint = request.checkpoint;
    const db = SnapshotDb.tryFindByKey(this.getKey(checkpoint));
    return (undefined !== db) ? db as SnapshotDb : Downloads.download(request, async (job: DownloadJob) => this.downloadAndOpen(job));
  }

  public static verifyCheckpoint(checkpoint: CheckpointProps, fileName: string): boolean {
    if (!IModelJsFs.existsSync(fileName))
      return false;

    const nativeDb = new IModelHost.platform.DgnDb();
    const status = nativeDb.openIModel(fileName, OpenMode.Readonly);
    if (DbResult.BE_SQLITE_OK !== status)
      return false;

    const isValid = checkpoint.iModelId === nativeDb.getDbGuid() && checkpoint.changeSetId === nativeDb.getParentChangeSetId();
    nativeDb.closeIModel();
    return isValid;
  }

  public static async downloadCheckpoint(request: DownloadRequest): Promise<void> {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }

  private static async downloadAndOpen(job: DownloadJob) {
    const checkpoint = job.request.checkpoint;
    if (!this.verifyCheckpoint(checkpoint, job.pathName)) // if file already exists, just use it
      await this.performDownload(job);

    return SnapshotDb.openCheckpointV1(checkpoint);
  }

  private static async performDownload(job: DownloadJob): Promise<void> {
    const requestedCkp = job.request.checkpoint;
    const requestContext = requestedCkp.requestContext;
    requestContext.enter();
    const traceInfo = { contextId: requestedCkp.contextId, iModelId: requestedCkp.iModelId, changeSetId: requestedCkp.changeSetId, localFile: job.pathName };
    try {
      Logger.logTrace(loggerCategory, "starting checkpoint download", () => traceInfo);
      const perfLogger = new PerfLogger("starting checkpoint download", () => traceInfo);

      job.status = DownloadBriefcaseStatus.QueryCheckpointService;

      // Download checkpoint
      let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
      checkpointQuery = checkpointQuery.precedingCheckpoint(requestedCkp.changeSetId);
      const checkpoints = await IModelHost.iModelClient.checkpoints.get(requestedCkp.requestContext, requestedCkp.iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length === 0)
        throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found", Logger.logError, loggerCategory, () => traceInfo);
      const checkpoint = checkpoints[0];

      job.status = DownloadBriefcaseStatus.DownloadingCheckpoint;
      const progressCallback = Logger.isEnabled(loggerCategory, LogLevel.Trace) ? this.enableDownloadTrace(checkpoint, job.request.onProgress) : job.request.onProgress;
      try {
        await IModelHost.iModelClient.checkpoints.download(requestContext, checkpoint, job.pathName, progressCallback, job.request.cancelRequest);
      } catch (error) {
        requestContext.enter();
        if (!(error instanceof UserCancelledError))
          Logger.logError(loggerCategory, "Could not download checkpoint file", () => ({ error: error.message || error.name }));
        throw error;
      }
      requestContext.enter();

      // Open checkpoint for write
      const db = SnapshotDb.openForApplyChangesets(job.pathName);
      const nativeDb = db.nativeDb;

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
          throw new IModelError(IModelStatus.ValidationFailed, "ParentChangeSetId of the checkpoint was not correctly setup", Logger.logError, loggerCategory, () => ({ ...traceInfo, ...checkpoint, dbChangeSetId }));
        const dbContextGuid = Guid.normalize(nativeDb.queryProjectGuid());
        if (dbContextGuid !== Guid.normalize(requestedCkp.contextId))
          throw new IModelError(IModelStatus.ValidationFailed, "ContextId was not properly setup in the briefcase", Logger.logError, loggerCategory, () => ({ ...traceInfo, dbContextGuid }));

        // Apply change sets if necessary
        if (dbChangeSetId !== requestedCkp.changeSetId) {
          job.status = DownloadBriefcaseStatus.ApplyingChangeSets;
          await BriefcaseManager.processChangeSets(requestContext, db, requestedCkp.changeSetId);
          requestContext.enter();
        }
      } finally {
        db.close();
      }

      // Set the flag to mark that briefcase download has completed
      job.status = DownloadBriefcaseStatus.Complete;

      perfLogger.dispose();
      Logger.logTrace(loggerCategory, "Finished downloading checkpoint", () => traceInfo);
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Error downloading checkpoint - deleting it", () => traceInfo);

      job.status = DownloadBriefcaseStatus.Error;
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
      Logger.logTrace(loggerCategory, "Downloading checkpoint (started)...", () => ({
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
        Logger.logTrace(loggerCategory, "Downloading checkpoint (progress)...", () => ({
          downloadedBytes: progressInfo.loaded, totalBytes: progressInfo.total, percentComplete: progressInfo.percent?.toFixed(2),
          elapsedSeconds: elapsedSeconds.toFixed(0), remainingSeconds: remainingSeconds.toFixed(0),
          iModelId: checkpoint.fileId,
        }));
      }
    };
    return progressCallbackWrapper;
  }
}

export class CheckpointManager {
  public static async downloadCheckpoint(request: DownloadRequest): Promise<void> {
    if (IModelJsFs.existsSync(request.localFile))
      throw new IModelError(IModelStatus.FileAlreadyExists, `Cannot download checkpoint, file ${request.localFile} already exists`);

    try {
      // first see if there's a V2 checkpoint available.
      return await V2CheckpointManager.downloadCheckpoint(request);
    } catch (error) {
      // TODO: check to see if the error is "not available" and keep going. Otherwise rethrow error
    }

    return V1CheckpointManager.downloadCheckpoint(request);
  }
}


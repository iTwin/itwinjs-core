/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore BLOCKCACHE

import * as path from "path";
import {
  BeEvent, BriefcaseStatus, ChangeSetStatus, DbResult, Guid, GuidString, IModelStatus, Logger, OpenMode, PerfLogger,
} from "@bentley/bentleyjs-core";
import { CheckpointQuery, CheckpointV2Query } from "@bentley/imodelhub-client";
import { BriefcaseIdValue, IModelError } from "@bentley/imodeljs-common";
import { BlobDaemon, BlobDaemonCommandArg, IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext, ProgressCallback, UserCancelledError } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager } from "./BriefcaseManager";
import { SnapshotDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/**
 * Properties of a checkpoint
 * @public
 */
export interface CheckpointProps {
  expectV2?: boolean;

  /** Context (Project or Asset) that the iModel belongs to */
  contextId: GuidString;

  /** Id of the iModel */
  iModelId: GuidString;

  /** Id of the change set
   * @note ChangeSet Ids are string hash values based on the ChangeSet's content and parent.
   */
  changeSetId: string;

  requestContext: AuthorizedClientRequestContext;
}

/** Called to show progress during a download. If this function returns non-zero, the download is aborted.
 *  @public
 */
export type ProgressFunction = (loaded: number, total: number) => number;

/** The parameters that specify a request to download a checkpoint file from iModelHub.
 * @internal
 */
export interface DownloadRequest {
  /** name of local file to hold the downloaded data. */
  localFile: string;

  /** A list of full fileName paths to test before downloading. If a valid file exists by one of these names,
   * no download is performed and `localFile` is updated to reflect the fact that the file exists with that name.
   * This can be used, for example, to look for checkpoints from previous versions if the naming strategy changes.
   */
  aliasFiles?: string[];

  /** Properties of the checkpoint to be downloaded */
  checkpoint: CheckpointProps;

  /** If present, this function will be called to indicate progress as the briefcase is downloaded. If this
   * function returns a non-zero value, the download is aborted.
   */
  onProgress?: ProgressFunction;
}

/** @internal */
export interface DownloadJob {
  request: DownloadRequest;
  promise?: Promise<any>;
}

/** @internal */
export class Downloads {
  private static _active = new Map<string, DownloadJob>();

  private static async process<T>(job: DownloadJob, fn: (job: DownloadJob) => Promise<T>) {
    const jobName = job.request.localFile; // save this, it can change inside call to `fn`!
    this._active.set(jobName, job);
    try {
      return await fn(job);
    } finally {
      this._active.delete(jobName);
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
    job = { request };
    return job.promise = this.process(job, downloadFn);
  }
}

/** Utility class for attaching to Daemon, opening V2 checkpoints, and downloading them.
 * @internal
*/
export class V2CheckpointManager {
  private static async getCommandArgs(checkpoint: CheckpointProps): Promise<BlobDaemonCommandArg> {
    const { requestContext, iModelId, changeSetId } = checkpoint;

    try {
      requestContext.enter();
      const checkpointQuery = new CheckpointV2Query().byChangeSetId(changeSetId).selectContainerAccessKey();
      const checkpoints = await IModelHost.iModelClient.checkpointsV2.get(requestContext, iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length < 1)
        throw new Error("no checkpoint");

      const { containerAccessKeyContainer, containerAccessKeySAS, containerAccessKeyAccount, containerAccessKeyDbName } = checkpoints[0];
      if (!containerAccessKeyContainer || !containerAccessKeySAS || !containerAccessKeyAccount || !containerAccessKeyDbName)
        throw new Error("Invalid checkpoint in iModelHub");

      return {
        container: containerAccessKeyContainer,
        auth: containerAccessKeySAS,
        daemonDir: process.env.BLOCKCACHE_DIR,
        storageType: "azure?sas=1",
        user: containerAccessKeyAccount,
        dbAlias: containerAccessKeyDbName,
        writeable: false,
      };
    } catch (err) {
      throw new IModelError(IModelStatus.NotFound, `V2 checkpoint not found: err: ${err.message}`);
    }
  }

  public static async attach(checkpoint: CheckpointProps): Promise<string> {
    const args = await this.getCommandArgs(checkpoint);
    if (undefined === args.daemonDir || args.daemonDir === "")
      throw new IModelError(IModelStatus.BadRequest, "Invalid config: BLOCKCACHE_DIR is not set");

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

  private static async performDownload(job: DownloadJob): Promise<void> {
    CheckpointManager.onDownload.raiseEvent(job);
    const request = job.request;
    const downloader = new IModelHost.platform.DownloadV2Checkpoint({ ... await this.getCommandArgs(request.checkpoint), localFile: request.localFile });
    let timer: NodeJS.Timeout | undefined;
    try {
      let total = 0;
      const onProgress = request.onProgress;
      if (onProgress) {
        timer = setInterval(async () => { // set an interval timer to show progress every 250ms
          const progress = downloader.getProgress();
          total = progress.total;
          if (onProgress(progress.loaded, progress.total))
            downloader.cancelDownload();
        }, 250);
      }
      await downloader.downloadPromise;
      onProgress?.(total, total); // make sure we call progress func one last time when download completes
    } catch (err) {
      throw (err.message === "cancelled") ? new UserCancelledError(BriefcaseStatus.DownloadCancelled, "download cancelled") : err;
    } finally {
      if (timer)
        clearInterval(timer);
    }
  }

  /** Fully download a V2 checkpoint to a local file that can be used to create a briefcase or to work offline.
   * @returns a Promise that is resolved when the download completes.
   */
  public static async downloadCheckpoint(request: DownloadRequest): Promise<void> {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }
}

/** Utility class to deal with downloading V1 checkpoints from iModelHub.
 * @internal
 */
export class V1CheckpointManager {
  public static getFolder(iModelId: GuidString): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "checkpoints");
  }

  /** for backwards compatibility to find checkpoints downloaded from older versions of BriefcaseManager.
   * @deprecated
   */
  public static getCompatibilityFileName(checkpoint: CheckpointProps): string {
    const changeSetId = checkpoint.changeSetId || "first";
    // eslint-disable-next-line deprecation/deprecation
    return path.join(BriefcaseManager.getCompatibilityPath(checkpoint.iModelId), "FixedVersion", changeSetId, "bc.bim");
  }

  public static getFileName(checkpoint: CheckpointProps): string {
    const changeSetId = checkpoint.changeSetId || "first";
    return path.join(this.getFolder(checkpoint.iModelId), `${changeSetId}.bim`);
  }

  public static async getCheckpointDb(request: DownloadRequest): Promise<SnapshotDb> {
    const checkpoint = request.checkpoint;
    const db = SnapshotDb.tryFindByKey(CheckpointManager.getKey(checkpoint));
    return (undefined !== db) ? db : Downloads.download(request, async (job: DownloadJob) => this.downloadAndOpen(job));
  }

  /** Download a V1 checkpoint */
  public static async downloadCheckpoint(request: DownloadRequest): Promise<void> {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }

  private static async downloadAndOpen(job: DownloadJob) {
    const db = CheckpointManager.tryOpenLocalFile(job.request);
    if (db)
      return db;
    await this.performDownload(job);
    return SnapshotDb.openCheckpointV1(job.request.localFile, job.request.checkpoint);
  }

  private static async performDownload(job: DownloadJob): Promise<void> {
    CheckpointManager.onDownload.raiseEvent(job);

    const requestedCkp = job.request.checkpoint;
    const requestContext = requestedCkp.requestContext;
    const localFile = job.request.localFile;
    requestContext.enter();
    const traceInfo = { contextId: requestedCkp.contextId, iModelId: requestedCkp.iModelId, changeSetId: requestedCkp.changeSetId, localFile };
    try {
      Logger.logTrace(loggerCategory, "starting checkpoint download", () => traceInfo);
      const perfLogger = new PerfLogger("starting checkpoint download", () => traceInfo);

      // Download checkpoint
      let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
      checkpointQuery = checkpointQuery.precedingCheckpoint(requestedCkp.changeSetId);
      const checkpoints = await IModelHost.iModelClient.checkpoints.get(requestedCkp.requestContext, requestedCkp.iModelId, checkpointQuery);
      requestContext.enter();
      if (checkpoints.length === 0)
        throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found");
      const checkpoint = checkpoints[0];

      try {
        const cancelRequest: any = {};
        const progressCallback: ProgressCallback = (progress) => {
          if (job.request.onProgress && job.request.onProgress(progress.loaded, progress.total!) !== 0)
            cancelRequest.cancel?.();
        };
        await IModelHost.iModelClient.checkpoints.download(requestContext, checkpoint, localFile, progressCallback, cancelRequest);
      } catch (error) {
        requestContext.enter();
        if (!(error instanceof UserCancelledError))
          Logger.logError(loggerCategory, "Could not download checkpoint file", () => ({ error: error.message || error.name }));
        throw error;
      }
      requestContext.enter();

      // Open checkpoint for write
      const db = SnapshotDb.openForApplyChangesets(localFile);
      const nativeDb = db.nativeDb;

      if (nativeDb.hasPendingTxns()) {
        Logger.logWarning(loggerCategory, "Checkpoint with Txns found - deleting them", () => traceInfo);
        nativeDb.deleteAllTxns();
      }

      if (nativeDb.getBriefcaseId() !== BriefcaseIdValue.Unassigned)
        nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);

      // Validate the native briefcase against the checkpoint meta-data
      try {
        const dbChangeSetId = nativeDb.getParentChangeSetId();
        if (dbChangeSetId !== checkpoint.mergedChangeSetId)
          throw new IModelError(IModelStatus.ValidationFailed, "ParentChangeSetId of the checkpoint was not correctly set up");

        CheckpointManager.validateCheckpointGuids(requestedCkp, nativeDb);

        // Apply change sets if necessary
        if (dbChangeSetId !== requestedCkp.changeSetId) {
          await BriefcaseManager.processChangeSets(requestContext, db, requestedCkp.changeSetId);
          requestContext.enter();
        }
      } finally {
        db.saveChanges();
        db.close();
      }

      perfLogger.dispose();
      Logger.logTrace(loggerCategory, "Finished downloading checkpoint", () => traceInfo);
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Error downloading checkpoint - deleting it", () => traceInfo);

      IModelJsFs.removeSync(localFile);

      if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
        Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them to enable retries", () => traceInfo);
        BriefcaseManager.deleteChangeSetsFromLocalDisk(requestedCkp.iModelId);
      }
      throw error;
    }
  }
}

/** @internal  */
export class CheckpointManager {
  public static readonly onDownload = new BeEvent<(job: DownloadJob) => void>();
  public static getKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeSetId}`; }

  /** Download a checkpoint file from iModelHub into a local file specified in the request parameters. */
  public static async downloadCheckpoint(request: DownloadRequest): Promise<void> {
    if (this.verifyCheckpoint(request.checkpoint, request.localFile))
      return;

    if (request.aliasFiles) {
      for (const alias of request.aliasFiles) {
        if (this.verifyCheckpoint(request.checkpoint, alias)) {
          request.localFile = alias;
          return;
        }
      }
    }

    try {
      // first see if there's a V2 checkpoint available.
      await V2CheckpointManager.downloadCheckpoint(request);
      Logger.logInfo(loggerCategory, `Downloaded v2 checkpoint: IModel=${request.checkpoint.iModelId}, changeset=${request.checkpoint.changeSetId}`);
    } catch (error) {
      if (error instanceof IModelError && error.errorNumber === IModelStatus.NotFound) // No V2 checkpoint available, try a v1 checkpoint
        return V1CheckpointManager.downloadCheckpoint(request);

      throw (error); // most likely, was aborted
    }
  }

  /** checks a file's dbGuid & contextId for consistency, and updates the dbGuid when possible */
  public static validateCheckpointGuids(checkpoint: CheckpointProps, nativeDb: IModelJsNative.DgnDb) {
    const traceInfo = { contextId: checkpoint.contextId, iModelId: checkpoint.iModelId };

    const dbChangeSetId = nativeDb.getParentChangeSetId();
    const dbGuid = Guid.normalize(nativeDb.getDbGuid());
    if (dbGuid !== Guid.normalize(checkpoint.iModelId)) {
      if (nativeDb.isReadonly())
        throw new IModelError(IModelStatus.ValidationFailed, "iModelId is not properly set up in the checkpoint");

      Logger.logWarning(loggerCategory, "iModelId is not properly set up in the checkpoint. Updated checkpoint to the correct iModelId.", () => ({ ...traceInfo, dbGuid }));
      nativeDb.setDbGuid(Guid.normalize(checkpoint.iModelId));
      // Required to reset the ChangeSetId because setDbGuid clears the value.
      nativeDb.saveLocalValue("ParentChangeSetId", dbChangeSetId);
    }

    const dbContextGuid = Guid.normalize(nativeDb.queryProjectGuid());
    if (dbContextGuid !== Guid.normalize(checkpoint.contextId))
      throw new IModelError(IModelStatus.ValidationFailed, "ContextId was not properly setup in the checkpoint", Logger.logError, loggerCategory, () => ({ ...traceInfo, dbContextGuid }));
  }

  /** @returns true if the file is the checkpoint requested */
  public static verifyCheckpoint(checkpoint: CheckpointProps, fileName: string): boolean {
    if (!IModelJsFs.existsSync(fileName))
      return false;

    const nativeDb = new IModelHost.platform.DgnDb();
    try {
      nativeDb.openIModel(fileName, OpenMode.Readonly);
    } catch (error) {
      return false;
    }

    const isValid = checkpoint.iModelId === nativeDb.getDbGuid() && checkpoint.changeSetId === nativeDb.getParentChangeSetId();
    nativeDb.closeIModel();
    if (!isValid)
      IModelJsFs.removeSync(fileName);

    return isValid;
  }

  /** try to open an existing local file to satisfy a download request */
  public static tryOpenLocalFile(request: DownloadRequest): SnapshotDb | undefined {
    const checkpoint = request.checkpoint;
    if (this.verifyCheckpoint(checkpoint, request.localFile))
      return SnapshotDb.openCheckpointV1(request.localFile, checkpoint);

    // check a list of aliases for finding checkpoints downloaded to non-default locations (e.g. from older versions)
    if (request.aliasFiles) {
      for (const alias of request.aliasFiles) {
        if (this.verifyCheckpoint(checkpoint, alias)) {
          request.localFile = alias;
          return SnapshotDb.openCheckpointV1(alias, checkpoint);
        }
      }
    }
    return undefined;
  }
}

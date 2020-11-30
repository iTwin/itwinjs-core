/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import * as path from "path";
import { Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ProgressCallback } from "@bentley/itwin-client";
import { BriefcaseIdValue, BriefcaseManager } from "./BriefcaseManager";
import { SnapshotDb } from "./IModelDb";
import { CheckpointQuery } from "@bentley/imodelhub-client";
import { IModelHost } from "./IModelHost";
import { IModelError } from "@bentley/imodeljs-common";

/**
 * Status of downloading a checkpoint
 * @internal
 */
export enum DownloadCheckpointStatus {
  NotStarted,
  Initializing,
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
}

/**
 * entry in the download queue
 * @internal
 */
export interface DownloadRequest {
  /** Properties of the checkpoint that's being downloaded */
  checkpointProps: CheckpointProps;

  requestContext: AuthorizedClientRequestContext;

  /** local file name for checkpoint  */
  pathName: string;

  /** Status of downloading a briefcase */
  downloadStatus: DownloadCheckpointStatus;

  /** completes */
  doDownload: () => Promise<void>;

  /** called if there is an error */
  onError: (error?: any) => void;

  /** called to indicate progress is being made */
  onProgress: ProgressCallback;

  /** Request cancellation of the download */
  requestCancel: () => Promise<boolean>;
}

export interface DownloadJob {
  request: DownloadRequest;
  promise?: Promise<void>;
  resolve?: () => void;
  reject?: (e: any) => void;
}

export class DownloadQueue {
  private static _queue: DownloadJob[] = [];
  private static _pendingPromise = false;

  public static isInProgress(pathName: string): DownloadJob | undefined {
    for (const job of this._queue) {
      if (job.request.pathName === pathName)
        return job;
    }
    return undefined;
  }

  public static async download(request: DownloadRequest) {
    const job: DownloadJob = { request };
    job.promise = new Promise((resolve, reject) => { job.reject = reject; job.resolve = resolve; });
    this._queue.push(job);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.process();
    return job.promise;
  }

  public static async process() {
    if (this._pendingPromise)
      return false;

    const job = this._queue.shift();
    if (!job)
      return false;

    try {
      this._pendingPromise = true;

      await job.request.doDownload(job.request);

      this._pendingPromise = false;
      job.resolve!();
    } catch (e) {
      this._pendingPromise = false;
      job.reject!(e);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.process();
    }

    return true;
  }
}

class V1CheckpointManager {
  public static getCheckpointKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeSetId}-V1`; }

  public static getLocalPath(checkpoint: CheckpointProps) {
    const pathBaseName = path.join(BriefcaseManager.getBriefcaseBasePath(checkpoint.iModelId), "V1");
    return path.join(pathBaseName, BriefcaseManager.getChangeSetFolderNameFromId(checkpoint.changeSetId), "bc.bim");
  }

  public static async getCheckpointDb(checkpoint: CheckpointProps, requestContext: AuthorizedClientRequestContext): SnapshotDb {
    const key = this.getCheckpointKey(checkpoint);
    const db = SnapshotDb.tryFindByKey(key);
    if (undefined !== db)
      return db as SnapshotDb;
    const pathname = this.getLocalPath(checkpoint);
    if (!pathname.exists) {

    }

  }

  private static performDownload(
    requestContext.enter();
try {
  Logger.logTrace(loggerCategory, "BriefcaseManager.finishCreateBriefcase: Started creating briefcase", () => briefcase.getDebugInfo());
  const perfLogger = new PerfLogger("Creating briefcase", () => briefcase.getDebugInfo());

  // Download checkpoint
  let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
  checkpointQuery = checkpointQuery.precedingCheckpoint(briefcase.targetChangeSetId);
  const checkpoints: Checkpoint[] = await IModelHost.iModelClient.checkpoints.get(requestContext, briefcase.iModelId, checkpointQuery);
  requestContext.enter();
  if (checkpoints.length === 0)
    throw new IModelError(BriefcaseStatus.VersionNotFound, "Checkpoint not found", Logger.logError, loggerCategory, () => briefcase.getDebugInfo());
  const checkpoint = checkpoints[0];

  briefcase.downloadStatus = DownloadBriefcaseStatus.DownloadingCheckpoint;
  await BriefcaseManager.downloadCheckpoint(requestContext, checkpoint, briefcase.pathname, briefcase.downloadProgress, briefcase.cancelDownloadRequest);
  requestContext.enter();

  briefcase.downloadStatus = DownloadBriefcaseStatus.Initializing;

  // Open checkpoint
  const db = SnapshotDb.openForCheckpointCreation(briefcase.pathname, OpenMode.ReadWrite);
  const nativeDb = db.nativeDb;

  // Note: A defect in applying change sets caused some checkpoints to be created with Txns - we need to clear these out
  // at least until these checkpoints aren't being used. The error typically is a worry only
  // for ReadWrite applications, and can be eventually phased out based on the occurrence of the log warning below.
  if (nativeDb.hasPendingTxns()) {
    Logger.logWarning(loggerCategory, "Checkpoint with Txns found - deleting them", () => briefcase.getDebugInfo());
    nativeDb.deleteAllTxns();
  }

  if (nativeDb.getBriefcaseId() !== BriefcaseIdValue.Standalone)
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);

  // Validate the native briefcase against the checkpoint meta-data
  const dbChangeSetId = nativeDb.getParentChangeSetId();
  if (dbChangeSetId !== checkpoint.mergedChangeSetId)
    throw new IModelError(IModelStatus.ValidationFailed, "BriefcaseManager.finishCreateBriefcase: ParentChangeSetId of the checkpoint was not correctly setup", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), ...checkpoint, dbChangeSetId }));
  const dbContextGuid = Guid.normalize(nativeDb.queryProjectGuid());
  if (dbContextGuid !== Guid.normalize(briefcase.contextId))
    throw new IModelError(IModelStatus.ValidationFailed, "BriefcaseManager.finishCreateBriefcase: ContextId was not properly setup in the briefcase", Logger.logError, loggerCategory, () => ({ ...briefcase.getDebugInfo(), dbContextGuid }));

  await this.initBriefcaseChangeSetIndexes(requestContext, briefcase);
  requestContext.enter();

  // Apply change sets if necessary
  if (briefcase.currentChangeSetId !== briefcase.targetChangeSetId) {
    // Note: For fixed version cases, the briefcase meta-data may have been set to Readonly, even if the nativeDb was just created ReadWrite to
    // apply change sets. We temporarily set it to ReadWrite in these cases to allow processChangeSets to not error out applying the change sets.
    const backupOpenMode = briefcase.openMode;
    briefcase.openMode = OpenMode.ReadWrite;
    await BriefcaseManager.processChangeSets(requestContext, db, briefcase.targetChangeSetId, briefcase.targetChangeSetIndex!);
    requestContext.enter();
    briefcase.openMode = backupOpenMode;
  }

  db.close();

  // Set the flag to mark that briefcase download has completed
  briefcase.downloadStatus = DownloadBriefcaseStatus.Complete;

  perfLogger.dispose();
  Logger.logTrace(loggerCategory, "BriefcaseManager.finishCreateBriefcase: Finished creating briefcase", () => briefcase.getDebugInfo());
} catch (error) {
  requestContext.enter();
  Logger.logError(loggerCategory, "BriefcaseManager.finishCreateBriefcase: Error creating briefcase - deleting it", () => briefcase.getDebugInfo());

  briefcase.downloadStatus = DownloadBriefcaseStatus.Error;
  await BriefcaseManager.deleteBriefcase(requestContext, briefcase);
  requestContext.enter();

  if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
    Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them to enable retries", () => briefcase.getDebugInfo());
    BriefcaseManager.deleteChangeSetsFromLocalDisk(briefcase.iModelId);
  }
  throw error;
}
}

}

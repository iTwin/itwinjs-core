/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore BLOCKCACHE

import * as path from "path";
import { NativeLoggerCategory } from "@bentley/imodeljs-native";
import { BeEvent, ChangeSetStatus, Guid, GuidString, IModelStatus, Logger, LogLevel, Mutable, OpenMode, StopWatch } from "@itwin/core-bentley";
import {
  BriefcaseIdValue, ChangesetId, ChangesetIdWithIndex, ChangesetIndexAndId, IModelError, IModelVersion, LocalDirName, LocalFileName,
} from "@itwin/core-common";
import { V2CheckpointAccessProps } from "./BackendHubAccess";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager } from "./BriefcaseManager";
import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { SnapshotDb, TokenArg } from "./IModelDb";

const loggerCategory = BackendLoggerCategory.IModelDb;

/**
 * Properties of a checkpoint
 * @public
 */
export interface CheckpointProps extends TokenArg {
  readonly expectV2?: boolean;

  /** iTwin that the iModel belongs to */
  readonly iTwinId: GuidString;

  /** Id of the iModel */
  readonly iModelId: GuidString;

  /** changeset for the checkpoint */
  readonly changeset: ChangesetIdWithIndex;

  /** If true, then the latest successful v2 checkpoint at or before the provided changeset will be returned when calling queryV2Checkpoint.  */
  readonly allowPreceding?: boolean;

  /** The number of seconds before the current token expires to attempt to reacquire a new token. Default is 1 hour. */
  readonly reattachSafetySeconds?: number;
}

/** Return value from [[ProgressFunction]].
 *  @public
 */
export enum ProgressStatus {
  /** Continue download. */
  Continue = 0,
  /** Abort download. */
  Abort = 1,
}

/** Called to show progress during a download. If this function returns non-zero, the download is aborted.
 *  @public
 */
export type ProgressFunction = (loaded: number, total: number) => ProgressStatus;

/** The parameters that specify a request to download a checkpoint file from iModelHub.
 * @internal
 */
export interface DownloadRequest {
  /** name of local file to hold the downloaded data. */
  localFile: LocalFileName;

  /** A list of full fileName paths to test before downloading. If a valid file exists by one of these names,
   * no download is performed and `localFile` is updated to reflect the fact that the file exists with that name.
   * This can be used, for example, to look for checkpoints from previous versions if the naming strategy changes.
   */
  readonly aliasFiles?: ReadonlyArray<string>;

  /** Properties of the checkpoint to be downloaded */
  readonly checkpoint: CheckpointProps;

  /** If present, this function will be called to indicate progress as the briefcase is downloaded. If this
   * function returns a non-zero value, the download is aborted.
   */
  readonly onProgress?: ProgressFunction;
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

  public static isInProgress(pathName: LocalFileName): DownloadJob | undefined {
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

/**
 * Utility class for opening V2 checkpoints from cloud containers, and also for downloading them.
 * @internal
*/
export class V2CheckpointManager {
  public static readonly cloudCacheName = "v2Checkpoints";
  private static _cloudCache?: CloudSqlite.CloudCache;
  private static containers = new Map<string, CloudSqlite.CloudContainer>();

  public static getFolder(): LocalDirName {
    const cloudCachePath = path.join(BriefcaseManager.cacheDir, V2CheckpointManager.cloudCacheName);
    if (!(IModelJsFs.existsSync(cloudCachePath))) {
      IModelJsFs.recursiveMkDirSync(cloudCachePath);
    }
    return cloudCachePath;
  }

  /* only used by tests that reset the state of the v2CheckpointManager. all dbs should be closed before calling this function. */
  public static cleanup(): void {
    for (const [_, value] of this.containers.entries()) {
      if (value.isConnected)
        value.disconnect({ detach: true });
    }

    CloudSqlite.CloudCaches.dropCache(this.cloudCacheName)?.destroy();
    this._cloudCache = undefined;
    this.containers.clear();
  }

  public static getFileName(checkpoint: CheckpointProps): LocalFileName {
    const changesetId = checkpoint.changeset.id || "first";
    return path.join(this.getFolder(), `${changesetId}.bim`);
  }

  private static get cloudCache(): CloudSqlite.CloudCache {
    if (!this._cloudCache) {
      let cacheDir = process.env.CHECKPOINT_CACHE_DIR;
      if (!cacheDir) {
        cacheDir = this.getFolder();
        Logger.logWarning(loggerCategory, `No CHECKPOINT_CACHE_DIR found in process.env, using ${cacheDir} instead.`);
      } else {
        // Make sure the checkpoint_cache_dir has an iTwinDaemon specific file in it, otherwise fall back to other directory.
        if (!(IModelJsFs.existsSync(path.join(cacheDir, "portnumber.bcv")))) {
          cacheDir = this.getFolder();
          Logger.logWarning(loggerCategory, `No evidence of the iTwinDaemon in provided CHECKPOINT_CACHE_DIR: ${process.env.CHECKPOINT_CACHE_DIR}, using ${cacheDir} instead.`);
        }
      }

      this._cloudCache = CloudSqlite.CloudCaches.getCache({ cacheName: this.cloudCacheName, cacheDir });

      // Its fine if its not a daemon, but lets log an info message
      if (!this._cloudCache.isDaemon)
        Logger.logInfo(loggerCategory, "V2Checkpoint manager running with no iTwinDaemon.");
    }
    return this._cloudCache;
  }

  /** Member names differ slightly between the V2Checkpoint api and the CloudSqlite api. Add aliases `accessName` for `accountName` and `accessToken` for `sasToken` */
  private static toCloudContainerProps(from: V2CheckpointAccessProps): CloudSqlite.ContainerAccessProps {
    return { ...from, baseUri: `https://${from.accountName}.blob.core.windows.net`, accessToken: from.sasToken, storageType: "azure" };
  }

  private static getContainer(v2Props: V2CheckpointAccessProps) {
    let container = this.containers.get(v2Props.containerId);
    if (!container) {
      // note checkpoint tokens can't be auto-refreshed because they rely on user credentials supplied through RPC. They're refreshed in SnapshotDb._refreshSas.
      container = CloudSqlite.createCloudContainer({ ...this.toCloudContainerProps(v2Props), tokenRefreshSeconds: -1 });
      this.containers.set(v2Props.containerId, container);
    }
    return container;
  }

  public static async attach(checkpoint: CheckpointProps): Promise<{ dbName: string, container: CloudSqlite.CloudContainer }> {
    let v2props: V2CheckpointAccessProps | undefined;
    try {
      v2props = await IModelHost.hubAccess.queryV2Checkpoint(checkpoint);
      if (!v2props)
        throw new Error("no checkpoint");
    } catch (err: any) {
      throw new IModelError(IModelStatus.NotFound, `V2 checkpoint not found: err: ${err.message}`);
    }

    try {
      const container = this.getContainer(v2props);
      const dbName = v2props.dbName;
      if (!container.isConnected)
        container.connect(this.cloudCache);
      container.checkForChanges();
      if (IModelHost.appWorkspace.settings.getBoolean("Checkpoints/prefetch", false)) {
        const logPrefetch = async (prefetch: CloudSqlite.CloudPrefetch) => {
          const stopwatch = new StopWatch(`[${container.containerId}/${dbName}]`, true);
          Logger.logInfo(loggerCategory, `Starting prefetch of ${stopwatch.description}`);
          const done = await prefetch.promise;
          Logger.logInfo(loggerCategory, `Prefetch of ${stopwatch.description} complete=${done} (${stopwatch.elapsedSeconds} seconds)`);
        };
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        logPrefetch(CloudSqlite.startCloudPrefetch(container, dbName));
      }
      return { dbName, container };
    } catch (e: any) {
      const error = `Cloud cache connect failed: ${e.message}`;
      if (checkpoint.expectV2)
        Logger.logError(loggerCategory, error);

      throw new IModelError(e.errorNumber, error);
    }
  }

  private static async performDownload(job: DownloadJob): Promise<ChangesetId> {
    const request = job.request;
    const v2props: V2CheckpointAccessProps | undefined = await IModelHost.hubAccess.queryV2Checkpoint({ ...request.checkpoint, allowPreceding: true });
    if (!v2props)
      throw new IModelError(IModelStatus.NotFound, "V2 checkpoint not found");

    CheckpointManager.onDownloadV2.raiseEvent(job);
    const container = CloudSqlite.createCloudContainer(this.toCloudContainerProps(v2props));
    await CloudSqlite.transferDb("download", container, { dbName: v2props.dbName, localFileName: request.localFile, onProgress: request.onProgress });
    return request.checkpoint.changeset.id;
  }

  /** Fully download a V2 checkpoint to a local file that can be used to create a briefcase or to work offline.
   * @returns a Promise that is resolved when the download completes with the changesetId of the downloaded checkpoint (which will
   * be the same as the requested changesetId or the most recent checkpoint before it.)
   */
  public static async downloadCheckpoint(request: DownloadRequest): Promise<ChangesetId> {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }
}

/** Utility class to deal with downloading V1 checkpoints from iModelHub.
 * @internal
 */
export class V1CheckpointManager {
  public static getFolder(iModelId: GuidString): LocalDirName {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "checkpoints");
  }

  public static getFileName(checkpoint: CheckpointProps): LocalFileName {
    const changesetId = checkpoint.changeset.id || "first";
    return path.join(this.getFolder(checkpoint.iModelId), `${changesetId}.bim`);
  }

  public static async getCheckpointDb(request: DownloadRequest): Promise<SnapshotDb> {
    const db = SnapshotDb.tryFindByKey(CheckpointManager.getKey(request.checkpoint));
    return (undefined !== db) ? db : Downloads.download(request, async (job: DownloadJob) => this.downloadAndOpen(job));
  }

  /** Download a V1 checkpoint */
  public static async downloadCheckpoint(request: DownloadRequest): Promise<ChangesetId> {
    return Downloads.download(request, async (job: DownloadJob) => this.performDownload(job));
  }

  private static async downloadAndOpen(job: DownloadJob) {
    const db = CheckpointManager.tryOpenLocalFile(job.request);
    if (db)
      return db;
    await this.performDownload(job);
    await CheckpointManager.updateToRequestedVersion(job.request);
    return SnapshotDb.openCheckpointV1(job.request.localFile, job.request.checkpoint);
  }

  private static async performDownload(job: DownloadJob): Promise<ChangesetId> {
    CheckpointManager.onDownloadV1.raiseEvent(job);
    // eslint-disable-next-line deprecation/deprecation
    return (await IModelHost.hubAccess.downloadV1Checkpoint(job.request)).id;
  }
}

/** @internal  */
export class CheckpointManager {
  public static readonly onDownloadV1 = new BeEvent<(job: DownloadJob) => void>();
  public static readonly onDownloadV2 = new BeEvent<(job: DownloadJob) => void>();
  public static getKey(checkpoint: CheckpointProps) { return `${checkpoint.iModelId}:${checkpoint.changeset.id}`; }

  private static async doDownload(request: DownloadRequest): Promise<ChangesetId> {
    try {
      // first see if there's a V2 checkpoint available.
      const changesetId = await V2CheckpointManager.downloadCheckpoint(request);
      if (changesetId !== request.checkpoint.changeset.id)
        Logger.logInfo(loggerCategory, `Downloaded previous v2 checkpoint because requested checkpoint not found.`, { requestedChangesetId: request.checkpoint.changeset.id, iModelId: request.checkpoint.iModelId, changesetId, iTwinId: request.checkpoint.iTwinId });
      else
        Logger.logInfo(loggerCategory, `Downloaded v2 checkpoint.`, { iModelId: request.checkpoint.iModelId, changesetId: request.checkpoint.changeset.id, iTwinId: request.checkpoint.iTwinId });
      return changesetId;
    } catch (error: any) {
      if (error.errorNumber === IModelStatus.NotFound) { // No V2 checkpoint available, try a v1 checkpoint
        const changeset = await V1CheckpointManager.downloadCheckpoint(request);
        Logger.logWarning(loggerCategory, `Got an error downloading v2 checkpoint, but downloaded v1 checkpoint successfully!`, { error, iModelId: request.checkpoint.iModelId, iTwinId: request.checkpoint.iTwinId, requestedChangesetId: request.checkpoint.changeset.id, changesetId: changeset });
        return changeset;
      }
      throw error; // most likely, was aborted
    }
  }

  public static async updateToRequestedVersion(request: DownloadRequest) {
    const checkpoint = request.checkpoint;
    const targetFile = request.localFile;
    const traceInfo = { iTwinId: checkpoint.iTwinId, iModelId: checkpoint.iModelId, changeset: checkpoint.changeset };
    try {
      // Open checkpoint for write
      Logger.setLevel(NativeLoggerCategory.SQLite, LogLevel.None); // Ignores noisy error messages when applying changesets.
      const db = SnapshotDb.openForApplyChangesets(targetFile);
      const nativeDb = db.nativeDb;
      try {

        if (nativeDb.hasPendingTxns()) {
          Logger.logWarning(loggerCategory, "Checkpoint with Txns found - deleting them", () => traceInfo);
          nativeDb.deleteAllTxns();
        }

        if (nativeDb.getBriefcaseId() !== BriefcaseIdValue.Unassigned)
          nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);

        CheckpointManager.validateCheckpointGuids(checkpoint, db);
        // Apply change sets if necessary
        const currentChangeset: Mutable<ChangesetIndexAndId> = nativeDb.getCurrentChangeset();
        if (currentChangeset.id !== checkpoint.changeset.id) {
          const accessToken = checkpoint.accessToken;
          const toIndex = checkpoint.changeset.index ??
            (await IModelHost.hubAccess.getChangesetFromVersion({ accessToken, iModelId: checkpoint.iModelId, version: IModelVersion.asOfChangeSet(checkpoint.changeset.id) })).index;
          await BriefcaseManager.pullAndApplyChangesets(db, { accessToken, toIndex });
        } else {
          // make sure the parent changeset index is saved in the file - old versions didn't have it.
          currentChangeset.index = checkpoint.changeset.index!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
          nativeDb.saveLocalValue("parentChangeSet", JSON.stringify(currentChangeset));
        }
      } finally {
        Logger.setLevel(NativeLoggerCategory.SQLite, LogLevel.Error); // Turn logging back on after applying changesets.
        db.saveChanges();
        db.close();
      }
    } catch (error: any) {

      Logger.logError(loggerCategory, "Error downloading checkpoint - deleting it", () => traceInfo);
      IModelJsFs.removeSync(targetFile);

      if (error.errorNumber === ChangeSetStatus.CorruptedChangeStream || error.errorNumber === ChangeSetStatus.InvalidId || error.errorNumber === ChangeSetStatus.InvalidVersion) {
        Logger.logError(loggerCategory, "Detected potential corruption of change sets. Deleting them to enable retries", () => traceInfo);
        BriefcaseManager.deleteChangeSetsFromLocalDisk(checkpoint.iModelId);
      }
      throw error;
    }
  }

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

    await this.doDownload(request);
    return this.updateToRequestedVersion(request);
  }

  /** checks a file's dbGuid & iTwinId for consistency, and updates the dbGuid when possible */
  public static validateCheckpointGuids(checkpoint: CheckpointProps, snapshotDb: SnapshotDb) {
    const traceInfo = { iTwinId: checkpoint.iTwinId, iModelId: checkpoint.iModelId };

    const nativeDb = snapshotDb.nativeDb;
    const dbChangeset = nativeDb.getCurrentChangeset();
    const iModelId = Guid.normalize(nativeDb.getIModelId());
    if (iModelId !== Guid.normalize(checkpoint.iModelId)) {
      if (nativeDb.isReadonly())
        throw new IModelError(IModelStatus.ValidationFailed, "iModelId is not properly set up in the checkpoint");

      Logger.logWarning(loggerCategory, "iModelId is not properly set up in the checkpoint. Updated checkpoint to the correct iModelId.", () => ({ ...traceInfo, dbGuid: iModelId }));
      const iModelIdNormalized = Guid.normalize(checkpoint.iModelId);
      nativeDb.setIModelId(iModelIdNormalized);
      (snapshotDb as any)._iModelId = iModelIdNormalized;
      // Required to reset the ChangeSetId because setDbGuid clears the value.
      nativeDb.saveLocalValue("ParentChangeSetId", dbChangeset.id);
      if (undefined !== dbChangeset.index)
        nativeDb.saveLocalValue("parentChangeSet", JSON.stringify(dbChangeset));
    }

    const iTwinId = Guid.normalize(nativeDb.getITwinId());
    if (iTwinId !== Guid.normalize(checkpoint.iTwinId))
      throw new IModelError(IModelStatus.ValidationFailed, "iTwinId was not properly set up in the checkpoint");
  }

  /** @returns true if the file is the checkpoint requested */
  public static verifyCheckpoint(checkpoint: CheckpointProps, fileName: LocalFileName): boolean {
    if (!IModelJsFs.existsSync(fileName))
      return false;

    const nativeDb = new IModelHost.platform.DgnDb();
    try {
      nativeDb.openIModel(fileName, OpenMode.Readonly);
    } catch (error) {
      return false;
    }

    const isValid = checkpoint.iModelId === nativeDb.getIModelId() && checkpoint.changeset.id === nativeDb.getCurrentChangeset().id;
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { AccessToken, GuidString, Logger, PerfLogger } from "@itwin/core-bentley";
import { CancelRequest, FileHandler, ProgressCallback } from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { ECJsonTypeMap, WsgInstance } from "../wsg/ECJsonTypeMap";
import { WsgQuery } from "../wsg/WsgQuery";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck, IModelHubClientError } from "./Errors";
import { addSelectFileAccessKey } from "./HubQuery";
import { InitializationState } from "./iModels";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/**
 * Checkpoint is a copy of the master file, that is intended to be read-only and reduces amount of merging required to get an iModel to a specific previous state.
 *
 * File properties describe the file that would be downloaded through downloadUrl.
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Checkpoint", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Checkpoint extends WsgInstance {
  /** File name of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  /** Description of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  /** Size of the checkpoint file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  /** FileId of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: GuidString;

  /** State of checkpoint generation. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.State")
  public state?: InitializationState;

  /** Id of the last [[ChangeSet]] that was merged into this checkpoint file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.MergedChangeSetId")
  public mergedChangeSetId?: string;

  /** Date when this checkpoint file was created. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** URL that can be used to download the checkpoint file from iModelHub. See [[CheckpointQuery.selectDownloadUrl]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;
}

/**
 * Query object for getting [[Checkpoint]]s. You can use this to modify the [[CheckpointHandler.get]] results.
 * @internal
 */
export class CheckpointQuery extends WsgQuery {
  /** Query will return closest [[Checkpoint]] to target [[ChangeSet]], based on ChangeSets size.
   * This query can return a Checkpoint that is ahead of the specified ChangeSet, if reversing ChangeSets would be faster than merging forward. This resets all previously set filters.
   * @returns This query.
   */
  public nearestCheckpoint(targetChangeSetId: string): this {
    this.filter(`NearestCheckpoint-backward-ChangeSet.Id+eq+'${targetChangeSetId}'`);
    return this;
  }

  /** Query will return closest [[Checkpoint]] to target [[ChangeSet]] that does not exceed the specified ChangeSet.
   * This query returns a closest Checkpoint that will reach target ChangeSet by only merging forward. This resets all previously set filters.
   * @returns This query.
   */
  public precedingCheckpoint(targetChangeSetId: string): this {
    this.filter(`PrecedingCheckpoint-backward-ChangeSet.Id+eq+'${targetChangeSetId}'`);
    return this;
  }

  /** Query will return [[Checkpoint]] with specified [[ChangeSet]] id.
   * @returns This query.
   */
  public byChangeSetId(changeSetId: string): this {
    this.addFilter(`MergedChangeSetId+eq+'${changeSetId}'`, "and");
    return this;
  }

  /** Query will additionally select [[Checkpoint]] file download URL. This is needed to use the Checkpoint object with [[CheckpointHandler.download]].
   * @returns This query.
   */
  public selectDownloadUrl(): this {
    addSelectFileAccessKey(this._query);
    return this;
  }
}

/**
 * Handler for managing [[Checkpoint]]s. Use [[IModelClient.checkpoints]] to get an instance of this class.
 * In most cases, you should use [BriefcaseDb]($backend) methods instead.
 * @internal
 */
export class CheckpointHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /** Constructor for CheckpointHandler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @internal
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /** Get relative url for Checkpoint requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @internal
   */
  private getRelativeUrl(iModelId: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/Checkpoint/`;
  }

  /** Get the [[Checkpoint]]s.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Checkpoints or select different data from them.
   * @returns Checkpoints that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(accessToken: AccessToken, iModelId: GuidString, query: CheckpointQuery = new CheckpointQuery()): Promise<Checkpoint[]> {
    Logger.logInfo(loggerCategory, "Querying checkpoints for iModel", () => ({ iModelId }));
    ArgumentCheck.validGuid("iModelId", iModelId);

    const checkpoints = await this._handler.getInstances<Checkpoint>(accessToken, Checkpoint, this.getRelativeUrl(iModelId), query.getQueryOptions());

    Logger.logTrace(loggerCategory, "Queried checkpoints for iModel", () => ({ iModelId, count: checkpoints.length }));
    return checkpoints;
  }

  /**
   * Make url safe for logging by removing sensitive information
   * @param url input url that will be strip of search and query parameters and replace them by ... for security reason
   */
  private static getSafeUrlForLogging(url: string): string {
    const safeToLogDownloadUrl = new URL(url);
    if (safeToLogDownloadUrl.search && safeToLogDownloadUrl.search.length > 0)
      safeToLogDownloadUrl.search = "...";
    if (safeToLogDownloadUrl.hash && safeToLogDownloadUrl.hash.length > 0)
      safeToLogDownloadUrl.hash = "...";
    return safeToLogDownloadUrl.toString();
  }

  /** Download the specified checkpoint file. This only downloads the file and does not update the [[Checkpoint]] id. Use [IModelDb.open]($backend) instead if you want to get a usable checkpoint file.
   * This method does not work on the browser. Directory containing the Checkpoint file is created if it does not exist. If there is an error during download, any partially downloaded file is deleted from disk.
   * @param checkpoint Checkpoint to download. This needs to include a download link. See [[CheckpointQuery.selectDownloadUrl]].
   * @param path Path where checkpoint file should be downloaded, including filename.
   * @param progressCallback Callback for tracking progress.
   * @param cancelRequest Request used to cancel download
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.NotSupportedInBrowser]($bentley) if called in a browser.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.FileHandlerNotSet]($bentley) if [[FileHandler]] instance was not set for [[IModelClient]].
   * @throws [[ResponseError]] if the checkpoint cannot be downloaded.
   */
  public async download(accessToken: AccessToken, checkpoint: Checkpoint, path: string, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    ArgumentCheck.defined("checkpoint", checkpoint);
    ArgumentCheck.defined("path", path);

    if (typeof window !== "undefined")
      throw IModelHubClientError.browser();

    if (!this._fileHandler)
      throw IModelHubClientError.fileHandler();

    if (!checkpoint.downloadUrl)
      throw IModelHubClientError.missingDownloadUrl("checkpoint");

    const checkpointForLog: Checkpoint = new Checkpoint();
    Object.assign(checkpointForLog, checkpoint);
    checkpointForLog.downloadUrl = CheckpointHandler.getSafeUrlForLogging(checkpointForLog.downloadUrl!);
    const perfLogger = new PerfLogger("Downloading checkpoint", () => ({ ...checkpointForLog, path, iModelId: checkpoint.fileId }));
    await this._fileHandler.downloadFile(accessToken, checkpoint.downloadUrl, path, parseInt(checkpoint.fileSize!, 10), progressCallback, cancelRequest);
    perfLogger.dispose();
  }
}

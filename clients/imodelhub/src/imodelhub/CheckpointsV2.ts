/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import type { AccessToken, GuidString} from "@itwin/core-bentley";
import { Logger } from "@itwin/core-bentley";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { ECJsonTypeMap, WsgInstance } from "../wsg/ECJsonTypeMap";
import { WsgQuery } from "../wsg/WsgQuery";
import type { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { addSelectContainerAccessKey } from "./HubQuery";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/** [[CheckpointV2]] creation state.
 * @internal
 */
export enum CheckpointV2State {
  /** CheckpointV2 creation is in progress. */
  InProgress = 0,
  /** CheckpointV2 creation was successful. */
  Successful = 1,
  /** CheckpointV2 creation failed. */
  Failed = 2,
  /** CheckpointV2 is not generated. It was never created or was deleted. This state is set by the server. It is possible to recreate CheckpointV2. */
  NotGenerated = 3
}

/** [[CheckpointV2]] generation error id.
 * @internal
 */
export enum CheckpointV2ErrorId {
  UnknownError = 0,
  FileDownloadError = 1,
  FileUploadError = 2,
  FileOpenError = 3,
  ApplyChangeSetError = 4,
  TimeOut = 5
}

/**
 * Checkpoint is a copy of the master file, that is intended to be read-only and reduces amount of merging required to get an iModel to a specific previous state.
 * [[CheckpointV2]] is stored as a set of binary blocks, while [[Checkpoint]] is a single binary file.
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.CheckpointV2", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class CheckpointV2 extends WsgInstance {
  /** Id of the last [[ChangeSet]] that was applied into this checkpoint file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ChangeSetId")
  public changeSetId?: string;

  /** State of checkpoint generation. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.State")
  public state?: CheckpointV2State;

  /** Container AccessKey account name of the storage that can be used to download the checkpoint blocks from iModelHub. See [[CheckpointV2Query.selectContainerAccessKey]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasContainer].relatedInstance[ContainerAccessKey].properties.Account")
  public containerAccessKeyAccount?: string;

  /** Container AccessKey container name of the storage that can be used to download the checkpoint blocks from iModelHub. See [[CheckpointV2Query.selectContainerAccessKey]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasContainer].relatedInstance[ContainerAccessKey].properties.Container")
  public containerAccessKeyContainer?: string;

  /** Container AccessKey SAS token of the storage that can be used to download the checkpoint blocks from iModelHub. See [[CheckpointV2Query.selectContainerAccessKey]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasContainer].relatedInstance[ContainerAccessKey].properties.SAS")
  public containerAccessKeySAS?: string;

  /** Container AccessKey database name of the storage that can be used to download the checkpoint blocks from iModelHub. See [[CheckpointV2Query.selectContainerAccessKey]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasContainer].relatedInstance[ContainerAccessKey].properties.DbName")
  public containerAccessKeyDbName?: string;

  /** Error type that occurred while generating [[CheckpointV2]]. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.ErrorId")
  public failureInfoErrorId?: CheckpointV2ErrorId;

  /** Id of the [[ChangeSet]] which failed to apply when [[CheckpointV2]] was generated. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.FailedChangeSetId")
  public failureInfoFailedChangeSetId?: string;

  /** [[CheckpointV2]] generation job start date. This property can not be set by the user. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.StartDate")
  public failureInfoStartDate?: string;

  /** [[CheckpointV2]] generation job failure date. This property can not be set by the user. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.FailureDate")
  public failureInfoFailureDate?: string;

  /** [[CheckpointV2]] generation job id. It should be unique for every job. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.JobId")
  public failureInfoJobId?: string;

  /** [[CheckpointV2]] generation job duration in milliseconds. See [[CheckpointV2Query.selectCheckpointV2FailureInfo]] to query failure info. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasCheckpointV2FailureInfo](direction:forward).relatedInstance[CheckpointV2FailureInfo].properties.JobRunDurationMS")
  public failureInfoJobRunDurationMS?: string;
}

/**
 * Query object for getting [[CheckpointV2]]s. You can use this to modify the [[CheckpointV2Handler.get]] results.
 * @internal
 */
export class CheckpointV2Query extends WsgQuery {
  /** Query will return [[CheckpointV2]] with specified [[ChangeSet]] id.
   * @returns This query.
   */
  public byChangeSetId(changeSetId: string): this {
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId, true);
    this.addFilter(`ChangeSetId+eq+'${changeSetId}'`, "and");
    return this;
  }

  /** Query will return closest [[CheckpointV2]] to target [[ChangeSet]] that does not exceed the specified ChangeSet.
   * This query returns a closest CheckpointV2 that will reach target ChangeSet by only merging forward. This resets all previously set filters.
   * @returns This query.
   */
  public precedingCheckpointV2(targetChangeSetId: string): this {
    this.filter(`PrecedingCheckpointV2-backward-ChangeSet.Id+eq+'${targetChangeSetId}'`);
    return this;
  }

  /** Query will return [[CheckpointV2]] with specified state.
   * @returns This query.
   */
  public byState(state: CheckpointV2State): this {
    this.addFilter(`State+eq+${state}`, "and");
    return this;
  }

  /** Query will additionally select [[CheckpointV2]] container access key to download [[CheckpointV2]] blocks.
   * @returns This query.
   */
  public selectContainerAccessKey(): this {
    addSelectContainerAccessKey(this._query);
    return this;
  }

  /** Query will additionally select failure info for failed [[CheckpointV2]].
   * @returns This query.
   */
  public selectFailureInfo(): this {
    if (!this._query.$select)
      this._query.$select = "*";

    this._query.$select += ",HasCheckpointV2FailureInfo-forward-CheckpointV2FailureInfo.*";
    return this;
  }
}

/**
 * Handler for managing [[CheckpointV2]]s. Use [[IModelClient.checkpointsV2]] to get an instance of this class.
 * In most cases, you should use [BriefcaseDb]($backend) methods instead.
 * @internal
 */
export class CheckpointV2Handler {
  private _handler: IModelBaseHandler;

  /** Constructor for CheckpointV2Handler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @internal
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get relative url for [[CheckpointV2]] requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the checkpoint.
   * @internal
   */
  private getRelativeUrl(iModelId: GuidString, checkpointId?: number) {
    return `/Repositories/iModel--${iModelId}/iModelScope/CheckpointV2/${checkpointId || ""}`;
  }

  /** Get the [[CheckpointV2]]s.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried [[CheckpointV2]]s or select different data from them.
   * @returns Checkpoints that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(accessToken: AccessToken, iModelId: GuidString, query: CheckpointV2Query = new CheckpointV2Query()): Promise<CheckpointV2[]> {
    Logger.logInfo(loggerCategory, "Querying CheckpointsV2 for iModel", () => ({ iModelId }));
    ArgumentCheck.validGuid("iModelId", iModelId);

    const checkpoints = await this._handler.getInstances<CheckpointV2>(accessToken, CheckpointV2, this.getRelativeUrl(iModelId), query.getQueryOptions());

    Logger.logTrace(loggerCategory, "Queried CheckpointsV2 for iModel", () => ({ iModelId, count: checkpoints.length }));
    return checkpoints;
  }

  /** Create a [[CheckpointV2]] for the specified iModel.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param checkpoint [[CheckpointV2]] instance to create. Requires changeSetId to be set. [[CheckpointV2]] is always created with state 'InProgress'.
   * @returns The created [[CheckpointV2]] instance from iModelHub. Container AccessKey is always returned.
   * @throws [[IModelHubError]] with [IModelHubStatus.CheckpointAlreadyExists]($bentley) if [[CheckpointV2]] for a given [[ChangeSet]] was already created.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async create(accessToken: AccessToken, iModelId: GuidString, checkpoint: CheckpointV2): Promise<CheckpointV2> {
    Logger.logInfo(loggerCategory, "Creating CheckpointV2 for iModel", () => ({ iModelId }));
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.defined("checkpoint", checkpoint);
    ArgumentCheck.validChangeSetId("checkpoint.changeSetId", checkpoint.changeSetId, false);

    checkpoint = await this._handler.postInstance<CheckpointV2>(accessToken, CheckpointV2, this.getRelativeUrl(iModelId), checkpoint);
    Logger.logTrace(loggerCategory, "Created CheckpointV2 for iModel", () => ({ iModelId, checkpoint }));
    return checkpoint;
  }

  /** Update the [[CheckpointV2]] of an iModel.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param checkpoint [[CheckpointV2]] to update. Requires wsgId set to existing [[CheckpointV2]] instance.
   * @returns Updated [[CheckpointV2]] instance from iModelHub. Container AccessKey is returned if [[CheckpointV2]] state is 'InProgress'.
   * @throws [[IModelHubError]] with [IModelHubStatus.CheckpointDoesNotExist]($bentley) if [[CheckpointV2]] with a given wsgId does not exist.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async update(accessToken: AccessToken, iModelId: GuidString, checkpoint: CheckpointV2): Promise<CheckpointV2> {
    Logger.logInfo(loggerCategory, "Updating CheckpointV2 for iModel", () => ({ iModelId, checkpoint }));
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.defined("checkpoint", checkpoint);
    const checkpointId = parseInt(checkpoint.wsgId, 10);
    ArgumentCheck.definedNumber("checkpoint.wsgId", checkpointId);

    const updatedCheckpoint = await this._handler.postInstance<CheckpointV2>(accessToken, CheckpointV2, this.getRelativeUrl(iModelId, checkpointId), checkpoint);
    Logger.logTrace(loggerCategory, "Updated CheckpointV2 for iModel", () => ({ iModelId, updatedCheckpoint }));
    return updatedCheckpoint;
  }
}

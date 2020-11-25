/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import {
  AuthorizedClientRequestContext, ECJsonTypeMap, WsgInstance, WsgQuery,
} from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { addSelectContainerAccessKey } from "./HubQuery";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/** [[CheckpointV2]] creation state.
 * @alpha
 */
export enum CheckpointV2State {
  /** CheckpointV2 creation is in progress. */
  InProgress = 0,
  /** CheckpointV2 creation was successful. */
  Successful = 1,
  /** CheckpointV2 creation failed. */
  Failed = 2
}

/**
 * Checkpoint is a copy of the master file, that is intended to be read-only and reduces amount of merging required to get an iModel to a specific previous state.
 * [[CheckpointV2]] is stored as a set of binary blocks, while [[Checkpoint]] is a single binary file.
 * @alpha
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
}

/**
 * Query object for getting [[CheckpointV2]]s. You can use this to modify the [[CheckpointV2Handler.get]] results.
 * @alpha
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
}

/**
 * Handler for managing [[CheckpointV2]]s. Use [[IModelClient.checkpointsV2]] to get an instance of this class.
 * In most cases, you should use [BriefcaseDb]($backend) methods instead.
 * @alpha
 */
export class CheckpointV2Handler {
  private _handler: IModelBaseHandler;

  /** Constructor for CheckpointV2Handler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @alpha
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get relative url for [[CheckpointV2]] requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the checkpoint.
   * @alpha
   */
  private getRelativeUrl(iModelId: GuidString, checkpointId?: number) {
    return `/Repositories/iModel--${iModelId}/iModelScope/CheckpointV2/${checkpointId || ""}`;
  }

  /** Get the [[CheckpointV2]]s.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried [[CheckpointV2]]s or select different data from them.
   * @returns Checkpoints that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: CheckpointV2Query = new CheckpointV2Query()): Promise<CheckpointV2[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying CheckpointsV2 for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    const checkpoints = await this._handler.getInstances<CheckpointV2>(requestContext, CheckpointV2, this.getRelativeUrl(iModelId), query.getQueryOptions());
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Queried CheckpointsV2 for iModel", () => ({ iModelId, count: checkpoints.length }));
    return checkpoints;
  }

  /** Create a [[CheckpointV2]] for the specified iModel.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param checkpoint [[CheckpointV2]] instance to create. Requires changeSetId to be set. [[CheckpointV2]] is always created with state 'InProgress'.
   * @returns The created [[CheckpointV2]] instance from iModelHub. Container AccessKey is always returned.
   * @throws [[IModelHubError]] with [IModelHubStatus.CheckpointAlreadyExists]($bentley) if [[CheckpointV2]] for a given [[ChangeSet]] was already created.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async create(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, checkpoint: CheckpointV2): Promise<CheckpointV2> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Creating CheckpointV2 for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.defined("checkpoint", checkpoint);
    ArgumentCheck.validChangeSetId("checkpoint.changeSetId", checkpoint.changeSetId, false);

    checkpoint = await this._handler.postInstance<CheckpointV2>(requestContext, CheckpointV2, this.getRelativeUrl(iModelId), checkpoint);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Created CheckpointV2 for iModel", () => ({ iModelId, checkpoint }));
    return checkpoint;
  }

  /** Update the [[CheckpointV2]] of an iModel.
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param checkpoint [[CheckpointV2]] to update. Requires wsgId set to existing [[CheckpointV2]] instance.
   * @returns Updated [[CheckpointV2]] instance from iModelHub. Container AccessKey is returned if [[CheckpointV2]] state is 'InProgress'.
   * @throws [[IModelHubError]] with [IModelHubStatus.CheckpointDoesNotExist]($bentley) if [[CheckpointV2]] with a given wsgId does not exist.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async update(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, checkpoint: CheckpointV2): Promise<CheckpointV2> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Updating CheckpointV2 for iModel", () => ({ iModelId, checkpoint }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.defined("checkpoint", checkpoint);
    const checkpointId = parseInt(checkpoint.wsgId, 10);
    ArgumentCheck.definedNumber("checkpoint.wsgId", checkpointId);

    const updatedCheckpoint = await this._handler.postInstance<CheckpointV2>(requestContext, CheckpointV2, this.getRelativeUrl(iModelId, checkpointId), checkpoint);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Updated CheckpointV2 for iModel", () => ({ iModelId, updatedCheckpoint }));
    return updatedCheckpoint;
  }
}

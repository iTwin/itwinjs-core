
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { InstanceIdQuery } from "./Query";
import { ThumbnailSize } from "./Thumbnails";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Named Version is a specific [[ChangeSet]] given a name to differentiate it from others. It can be used to represent some significant milestone for the iModel (e.g. a review version).
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Version", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Version extends WsgInstance {
  /** Description of the named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  /** Name of the named Version. Must be unique per iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  /** Id of the user that created the named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserCreated")
  public userCreated?: string;

  /** Date when the named Version was created. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** Id of the [[ChangeSet]] that the named Version was created for. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ChangeSetId")
  public changeSetId?: string;

  /** Id of the [[SmallThumbnail]] of the named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[SmallThumbnail].instanceId")
  public smallThumbnailId?: string;

  /** Id of the [[LargeThumbnail]] of the named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[LargeThumbnail].instanceId")
  public largeThumbnailId?: string;
}

/**
 * Query object for getting [[Version]]s. You can use this to modify the [[VersionHandler.get]] results.
 */
export class VersionQuery extends InstanceIdQuery {
  /**
   * Query [[Version]] by its name.
   * @param name Name of the Version.
   * @returns This query.
   * @throws [IModelHubClientError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) if name is undefined or empty.
   */
  public byName(name: string) {
    ArgumentCheck.defined("name", name);
    this.addFilter(`Name+eq+'${name}'`);
    return this;
  }

  /**
   * Query version by its [[ChangeSet]] id.
   * @param changesetId Id of the ChangeSet.
   * @returns This query.
   * @throws [IModelHubClientError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if changeSetId is undefined or not a valid [[ChangeSet.id]] format.
   */
  public byChangeSet(changesetId: string) {
    ArgumentCheck.validChangeSetId("changesetId", changesetId);
    this.addFilter(`ChangeSetId+eq+'${changesetId}'`);
    return this;
  }

  /**
   * Query will additionally select ids of [[Thumbnail]]s for given [[ThumbnailSize]]s.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if sizes array is undefined or empty.
   */
  public selectThumbnailId(...sizes: ThumbnailSize[]): this {
    ArgumentCheck.nonEmptyArray("sizes", sizes);
    if (!this._query.$select)
      this._query.$select = "*";

    for (const size of sizes) {
      this._query.$select += `,HasThumbnail-forward-${size}Thumbnail.*`;
    }

    return this;
  }
}

/**
 * Handler for managing [[Version]]s. Use [[IModelClient.Versions]] to get an instance of this class.
 */
export class VersionHandler {
  private _handler: IModelBaseHandler;
  /**
   * Constructor for VersionHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for Version requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param versionId Id of the version.
   */
  private getRelativeUrl(imodelId: string, versionId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/Version/${versionId || ""}`;
  }

  /**
   * Get the named [[Version]]s of an iModel. Returned Versions are ordered from the latest [[ChangeSet]] to the oldest.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Versions or select different data from them.
   * @returns Versions that match the query.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and a [[Version]] with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, query: VersionQuery = new VersionQuery()): Promise<Version[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying named versions for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const versions = await this._handler.getInstances<Version>(alctx, Version, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    alctx.enter();
    Logger.logTrace(loggingCategory, `Queried named versions for iModel ${imodelId}`);

    return versions;
  }

  /**
   * Create a named [[Version]] of an iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param changeSetId Id of the [[ChangeSet]] to create a named Version for.
   * @param name Name of the new named Version.
   * @param description Description of the new named Version.
   * @returns Created Version instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetDoesNotExist]($bentley) if the [[ChangeSet]] with specified changeSetId does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetAlreadyHasVersion]($bentley) if the [[ChangeSet]] with specified changeSetId already has a named [[Version]] associated with it.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, changeSetId: string, name: string, description?: string): Promise<Version> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Creating named version for iModel ${imodelId}, changeSet id: ${changeSetId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    ArgumentCheck.defined("name", name);

    let version = new Version();
    version.changeSetId = changeSetId;
    version.name = name;
    version.description = description;

    version = await this._handler.postInstance<Version>(alctx, Version, token, this.getRelativeUrl(imodelId), version);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Created named version for iModel ${imodelId}, changeSet id: ${changeSetId}`);

    return version;
  }

  /**
   * Update the named [[Version]] of an iModel. Only the description can be changed when updating the named Version.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param version Named version to update.
   * @returns Updated Version instance from iModelHub.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, version: Version): Promise<Version> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Updating named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validGuid("version.wsgId", version.wsgId);

    const updatedVersion = await this._handler.postInstance<Version>(alctx, Version, token, this.getRelativeUrl(imodelId, version.wsgId), version);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Updated named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);

    return updatedVersion;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { AccessToken, GuidString, Logger } from "@itwin/core-bentley";
import { ECJsonTypeMap, WsgInstance } from "../wsg/ECJsonTypeMap";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { addSelectApplicationData, InstanceIdQuery } from "./HubQuery";
import { ThumbnailSize } from "./Thumbnails";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/**
 * Named Version is a specific [[ChangeSet]] given a name to differentiate it from others. It can be used to represent some significant milestone for the iModel (e.g. a review version).
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Version", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Version extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  public id?: GuidString;

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

  /** Set to true, if named Version is hidden. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Hidden")
  public hidden?: boolean;

  /**
   * Id of the [[SmallThumbnail]] of the named Version.
   * @internal @deprecated
   */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[SmallThumbnail].instanceId")
  public smallThumbnailId?: GuidString;

  /**
   * Id of the [[LargeThumbnail]] of the named Version.
   * @internal @deprecated
   */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[LargeThumbnail].instanceId")
  public largeThumbnailId?: GuidString;

  /** Id of the application that created this named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[CreatedByApplication].relatedInstance[Application].properties.Id")
  public applicationId?: string;

  /** Name of the application that created this named Version. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[CreatedByApplication].relatedInstance[Application].properties.Name")
  public applicationName?: string;
}

/**
 * Query object for getting [[Version]]s. You can use this to modify the [[VersionHandler.get]] results.
 * @internal
 */
export class VersionQuery extends InstanceIdQuery {
  /**
   * Query [[Version]] by its name.
   * @param name Name of the Version.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if name is undefined or empty.
   */
  public byName(name: string) {
    ArgumentCheck.defined("name", name);
    this.addFilter(`Name+eq+'${encodeURIComponent(name)}'`);
    return this;
  }

  /**
   * Query version by its [[ChangeSet]] id.
   * @param changesetId Id of the ChangeSet. Empty ChangeSet id can be provided to query iModel's baseline version.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if changeSetId is undefined or not a valid [[ChangeSet.id]] format.
   */
  public byChangeSet(changeSetId: string) {
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId, true);
    this.addFilter(`ChangeSetId+eq+'${changeSetId}'`);
    return this;
  }

  /**
   * Query will additionally select ids of [[Thumbnail]]s for given [[ThumbnailSize]]s.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if sizes array is undefined or empty.
   * @internal @deprecated
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

  /**
   * Query will additionally select data about application that created this [[Version]].
   * @returns This query.
   */
  public selectApplicationData() {
    addSelectApplicationData(this._query);
    return this;
  }

  /**
   * Query only not hidden versions.
   * @returns This query.
   */
  public notHidden() {
    this.addFilter("Hidden+eq+false");
    return this;
  }
}

/**
 * Handler for managing [[Version]]s. Use [[IModelClient.Versions]] to get an instance of this class.
 * @internal
 */
export class VersionHandler {
  private _handler: IModelBaseHandler;
  /**
   * Constructor for VersionHandler.
   * @param handler Handler for WSG requests.
   * @internal
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get relative url for Version requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param versionId Id of the version.
   */
  private getRelativeUrl(iModelId: GuidString, versionId?: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/Version/${versionId || ""}`;
  }

  /** Get the named [[Version]]s of an iModel. Returned Versions are ordered from the latest [[ChangeSet]] to the oldest.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Versions or select different data from them.
   * @returns Versions that match the query.
   * @throws [WsgError]($itwin-client) with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and a [[Version]] with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(accessToken: AccessToken, iModelId: GuidString, query: VersionQuery = new VersionQuery()): Promise<Version[]> {
    Logger.logInfo(loggerCategory, "Querying named versions for iModel", () => ({ iModelId }));
    ArgumentCheck.validGuid("iModelId", iModelId);

    const versions = await this._handler.getInstances<Version>(accessToken, Version, this.getRelativeUrl(iModelId, query.getId()), query.getQueryOptions());
    Logger.logTrace(loggerCategory, "Queried named versions for iModel", () => ({ iModelId }));
    return versions;
  }

  /** Create a named [[Version]] of an iModel.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param changeSetId Id of the [[ChangeSet]] to create a named Version for. Empty ChangeSet id can be provided to create iModel's baseline version.
   * @param name Name of the new named Version.
   * @param description Description of the new named Version.
   * @returns Created Version instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetDoesNotExist]($bentley) if the [[ChangeSet]] with specified changeSetId does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetAlreadyHasVersion]($bentley) if the [[ChangeSet]] with specified changeSetId already has a named [[Version]] associated with it.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(accessToken: AccessToken, iModelId: GuidString, changeSetId: string, name: string, description?: string): Promise<Version> {
    Logger.logInfo(loggerCategory, "Creating named version for iModel", () => ({ iModelId, changeSetId }));
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId, true);
    ArgumentCheck.defined("name", name);

    let version = new Version();
    version.changeSetId = changeSetId;
    version.name = name;
    version.description = description;

    version = await this._handler.postInstance<Version>(accessToken, Version, this.getRelativeUrl(iModelId), version);
    Logger.logTrace(loggerCategory, "Created named version for iModel", () => ({ iModelId, changeSetId }));
    return version;
  }

  /** Update the named [[Version]] of an iModel. Only the description can be changed when updating the named Version.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param version Named version to update.
   * @returns Updated Version instance from iModelHub.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(accessToken: AccessToken, iModelId: GuidString, version: Version): Promise<Version> {
    Logger.logInfo(loggerCategory, "Updating named version for iModel", () => ({ iModelId, changeSetId: version.changeSetId }));
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.validGuid("version.wsgId", version.wsgId);

    const updatedVersion = await this._handler.postInstance<Version>(accessToken, Version, this.getRelativeUrl(iModelId, version.id), version);
    Logger.logTrace(loggerCategory, "Updated named version for iModel", () => ({ iModelId, changeSetId: version.changeSetId }));
    return updatedVersion;
  }
}


/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { InstanceIdQuery } from "./Query";
import { ThumbnailSize } from "./Thumbnails";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Version */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Version", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Version extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserCreated")
  public userCreated?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ChangeSetId")
  public changeSetId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[SmallThumbnail].instanceId")
  public smallThumbnailId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasThumbnail].relatedInstance[LargeThumbnail].instanceId")
  public largeThumbnailId?: string;
}

/**
 * Query object for getting Versions. You can use this to modify the query.
 * @see VersionHandler.get()
 */
export class VersionQuery extends InstanceIdQuery {
  /**
   * Query version by its name.
   * @param name Name of the version.
   * @returns This query.
   * @throws [IModelRequestError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) if name is undefined or empty.
   */
  public byName(name: string) {
    ArgumentCheck.defined("name", name);
    this.addFilter(`Name+eq+'${name}'`);
    return this;
  }

  /**
   * Query version by its changeSet id.
   * @param changesetId Id of the changeSet.
   * @returns This query.
   * @throws [IModelRequestError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if changeSetId is undefined or not a valid [[ChangeSet.id]] format.
   */
  public byChangeSet(changesetId: string) {
    ArgumentCheck.validChangeSetId("changesetId", changesetId);
    this.addFilter(`ChangeSetId+eq+'${changesetId}'`);
    return this;
  }

  /**
   * Query will additionally select given sizes ids of thumbnails.
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
 * Handler for all methods related to @see Version instances.
 */
export class VersionHandler {
  private _handler: IModelBaseHandler;
  /**
   * Constructor for VersionHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for Version requests.
   * @param imodelId Id of the iModel.
   * @param versionId Id of the version.
   */
  private getRelativeUrl(imodelId: string, versionId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/Version/${versionId || ""}`;
  }

  /**
   * Gets the named [[Version]]s of an iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   * @returns Resolves to array of versions.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and a [[Version]] with the specified id could not be found.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, imodelId: string, query: VersionQuery = new VersionQuery()): Promise<Version[]> {
    Logger.logInfo(loggingCategory, `Querying named versions for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const versions = await this._handler.getInstances<Version>(Version, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried named versions for iModel ${imodelId}`);

    return versions;
  }

  /**
   * Creates named version of an iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel.
   * @param changeSetId Id of the ChangeSet.
   * @param name Version name.
   * @param description Version description.
   * @returns Created Version instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetDoesNotExist]($bentley) if the [[ChangeSet]] with specified changeSetId does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [[IModelHubError]] with [IModelHubStatus.ChangeSetAlreadyHasVersion]($bentley) if the [[ChangeSet]] with specified changeSetId already has a named [[Version]] associated with it.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(token: AccessToken, imodelId: string, changeSetId: string, name: string, description?: string): Promise<Version> {
    Logger.logInfo(loggingCategory, `Creating named version for iModel ${imodelId}, changeSet id: ${changeSetId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    ArgumentCheck.defined("name", name);

    let version = new Version();
    version.changeSetId = changeSetId;
    version.name = name;
    version.description = description;

    version = await this._handler.postInstance<Version>(Version, token, this.getRelativeUrl(imodelId), version);

    Logger.logTrace(loggingCategory, `Created named version for iModel ${imodelId}, changeSet id: ${changeSetId}`);

    return version;
  }

  /**
   * Updates named version of an iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel.
   * @param version Named version.
   * @returns Updated Version instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have ManageVersions permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.VersionAlreadyExists]($bentley) if a named [[Version]] already exists with the specified name.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(token: AccessToken, imodelId: string, version: Version): Promise<Version> {
    Logger.logInfo(loggingCategory, `Updating named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validGuid("version.wsgId", version.wsgId);

    const updatedVersion = await this._handler.postInstance<Version>(Version, token, this.getRelativeUrl(imodelId, version.wsgId), version);

    Logger.logTrace(loggingCategory, `Updated named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);

    return updatedVersion;
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { InstanceIdQuery } from "./Query";
import { ThumbnailSize } from "./Thumbnails";
import { IModelBaseHandler } from "./BaseHandler";

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
   */
  public byName(name: string) {
    this.addFilter(`Name+eq+'${name}'`);
    return this;
  }

  /**
   * Query version by its changeSet id.
   * @param changesetId Id of the changeSet.
   * @returns This query.
   */
  public byChangeSet(changesetId: string) {
    this.addFilter(`ChangeSetId+eq+'${changesetId}'`);
    return this;
  }

  /**
   * Query will additionally select given sizes ids of thumbnails.
   * @returns This query.
   */
  public selectThumbnailId(...sizes: ThumbnailSize[]): this {
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
   * Gets (the named) versions of an iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   * @returns Resolves to array of versions.
   */
  public async get(token: AccessToken, imodelId: string, query: VersionQuery = new VersionQuery()): Promise<Version[]> {
    Logger.logInfo(loggingCategory, `Querying named versions for iModel ${imodelId}`);

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
   */
  public async create(token: AccessToken, imodelId: string, changeSetId: string, name: string, description?: string): Promise<Version> {
    Logger.logInfo(loggingCategory, `Creating named version for iModel ${imodelId}, changeSet id: ${changeSetId}`);

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
   */
  public async update(token: AccessToken, imodelId: string, version: Version): Promise<Version> {
    Logger.logInfo(loggingCategory, `Updating named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);

    const updatedVersion = await this._handler.postInstance<Version>(Version, token, this.getRelativeUrl(imodelId, version.wsgId), version);

    Logger.logTrace(loggingCategory, `Updated named version for iModel ${imodelId}, changeSet id: ${version.changeSetId}`);

    return updatedVersion;
  }
}

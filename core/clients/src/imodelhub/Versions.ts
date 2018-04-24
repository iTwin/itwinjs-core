/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubBaseHandler } from "./BaseHandler";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { InstanceIdQuery } from "./Query";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Version */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Version", {schemaPropertyName: "schemaName", classPropertyName: "className"})
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
}

/**
 * Handler for all methods related to @see Version instances.
 */
export class VersionHandler {
  private _handler: IModelHubBaseHandler;
  /**
   * Constructor for VersionHandler. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelHubBaseHandler) {
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
}

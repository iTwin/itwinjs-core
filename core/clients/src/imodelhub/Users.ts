/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubBaseHandler } from "./BaseHandler";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { InstanceIdQuery } from "./Query";

const loggingCategory = "imodeljs-clients.imodelhub";

/** UserInfo */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.UserInfo", {schemaPropertyName: "schemaName", classPropertyName: "className"})
export class UserInfo extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public firstName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Surname")
  public lastName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Email")
  public email?: string;
}

/**
 * Query object for getting UserInfos. You can use this to modify the query.
 * @see UserInfoHandler.get()
 * @class UserInfoQuery
 */
export class UserInfoQuery extends InstanceIdQuery {
}

/**
 * Handler for all methods related to @see UserInfo instances.
 */
export class UserInfoHandler {
  private _handler: IModelHubBaseHandler;

  /**
   * Constructor for UserInfoHandler. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelHubBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for UserInfo requests.
   * @param imodelId Id of the iModel.
   * @param userId Id of the user.
   */
  private getRelativeUrl(imodelId: string, userId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/UserInfo/${userId || ""}`;
  }

  /**
   * Gets information on a specific user that has accessed the iModel
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   */
  public async get(token: AccessToken, imodelId: string, query: UserInfoQuery = new UserInfoQuery()): Promise<UserInfo[]> {
    Logger.logInfo(loggingCategory, `Querying users for iModel ${imodelId}`);

    const users = await this._handler.getInstances<UserInfo>(UserInfo, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried users for iModel ${imodelId}`);

    return users;
  }
}

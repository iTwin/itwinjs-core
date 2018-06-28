/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { InstanceIdQuery } from "./Query";
import { IModelHubRequestError } from "./Errors";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** UserInfo */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.UserInfo", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class UserInfo extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

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
 */
export class UserInfoQuery extends InstanceIdQuery {
  private queriedByIds = false;

  /**
   * Query User info by user ids.
   * @param ids Ids of the users.
   * @returns This query.
   */
  public byIds(ids: string[]) {
    if (ids.length < 1) {
      throw IModelHubRequestError.invalidArgument("ids");
    }

    let filter = "$id+in+[";
    ids.forEach((id, index) => {
      if (index > 0)
        filter += ",";
      filter += `'${id}'`;
    });
    filter += "]";

    this.addFilter(filter);
    this.queriedByIds = true;
    return this;
  }

  /** Returns whether was object queried by ids or no */
  public isQueriedByIds() {
    return this.queriedByIds;
  }
}

/**
 * Handler for all methods related to @see UserInfo instances.
 */
export class UserInfoHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for UserInfoHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
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
   * Gets information on a specific user(s) that has accessed the iModel
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   */
  public async get(token: AccessToken, imodelId: string, query: UserInfoQuery = new UserInfoQuery()): Promise<UserInfo[]> {
    Logger.logInfo(loggingCategory, `Querying users for iModel ${imodelId}`);

    let users: UserInfo[];
    if (query.isQueriedByIds()) {
      users = await this._handler.postQuery<UserInfo>(UserInfo, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    } else {
      users = await this._handler.getInstances<UserInfo>(UserInfo, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    }
    Logger.logTrace(loggingCategory, `Queried users for iModel ${imodelId}`);

    return users;
  }
}

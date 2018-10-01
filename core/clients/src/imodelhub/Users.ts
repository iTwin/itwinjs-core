/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { Query } from "./Query";
import { ArgumentCheck } from "./Errors";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Information about the user, allowing to identify them based on their id. */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.UserInfo", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class UserInfo extends WsgInstance {
  /** Id of the user. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

  /** First name of the user. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public firstName?: string;

  /** Last name of the user. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Surname")
  public lastName?: string;

  /** Email address of the user. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Email")
  public email?: string;
}

/** Statistics of user created and owned instances on the iModel. */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.UserInfo", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class UserStatistics extends UserInfo {
  /** Number of [[Briefcase]]s the user currently owns. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.BriefcasesCount")
  public briefcasesCount?: number;

  /** Number of [[Lock]]s the user currently owns. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.OwnedLocksCount")
  public ownedLocksCount?: number;

  /** Number of [[ChangeSet]]s the user has pushed. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.PushedChangeSetsCount")
  public pushedChangeSetsCount?: number;

  /** Date of the last [[ChangeSet]] the user has pushed to this iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.LastChangeSetPushDate")
  public lastChangeSetPushDate?: string;
}

/**
 * Query object for getting User Statistics. You can use this to modify the [[UserStatisticsHandler.get]] results.
 */
export class UserStatisticsQuery extends Query {
  /** @hidden */
  protected _byId?: string;

  private _statisticsPrefix = "HasStatistics-forward-Statistics";
  private _queriedByIds = false;
  /**
   * Constructor for UserStatisticsQuery.
   * @hidden
   */
  constructor() {
    super();
    this.select(`*`);
  }

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byId(id: string) {
    ArgumentCheck.validGuid("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @hidden
   */
  public getId() {
    return this._byId;
  }

  /**
   * Query User Statistics by ids.
   * @param ids Ids of the users.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if ids array is undefined or empty, or it contains invalid [Guid]($bentley) values.
   */
  public byIds(ids: string[]) {
    ArgumentCheck.nonEmptyArray("ids", ids);

    let filter = "$id+in+[";
    ids.forEach((id, index) => {
      ArgumentCheck.validGuid(`ids[${index}]`, id);
      if (index > 0)
        filter += ",";
      filter += `'${id}'`;
    });
    filter += "]";

    this.addFilter(filter);
    this._queriedByIds = true;
    return this;
  }

  /** Select all statistics. */
  public selectAll() {
    return this.addSelect(`${this._statisticsPrefix}.*`);
  }

  /** Select currently owned [[Briefcase]]s count. */
  public selectBriefcasesCount() {
    return this.addSelect(`${this._statisticsPrefix}.BriefcasesCount`);
  }

  /** Select total pushed [[ChangeSet]]s count. */
  public selectPushedChangeSetsCount() {
    return this.addSelect(`${this._statisticsPrefix}.PushedChangeSetsCount`);
  }

  /** Select currently owned [[Lock]]s count. */
  public selectOwnedLocksCount() {
    return this.addSelect(`${this._statisticsPrefix}.OwnedLocksCount`);
  }

  /** Select the last [[ChangeSet]] push date. */
  public selectLastChangeSetPushDate() {
    return this.addSelect(`${this._statisticsPrefix}.LastChangeSetPushDate`);
  }

  /**
   * Returns whether was object queried by ids or no
   * @hidden
   */
  public get isQueriedByIds() {
    return this._queriedByIds;
  }
}

/**
 * Handler for querying [[UserStatistics]]. Use [[UserInfoHandler.Statistics]] to get an instance of this class.
 */
export class UserStatisticsHandler {
  private _handler: IModelBaseHandler;
  /**
   * Constructor for UserStatistics. Should use @see IModelClient instead of directly constructing this.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for UserStatistics requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param userId Id of the user.
   */
  private getRelativeUrl(imodelId: Guid, userId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/UserInfo/${userId ? userId : ""}`;
  }

  /**
   * Get [[UserStatistics]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried [[UserStatistics]] or select different data from them.
   * @returns Array of [[UserStatistics]] for users matching the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid,
    query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying user statistics for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    // if there are no specific selects defined, select all statistics
    if (query.getQueryOptions().$select === "*") {
      query.selectAll();
    }

    let userStatistics: UserStatistics[];
    if (query.isQueriedByIds) {
      userStatistics = await this._handler.postQuery<UserStatistics>(alctx, UserStatistics, token,
        this.getRelativeUrl(imodelId), query.getQueryOptions());
    } else {
      userStatistics = await this._handler.getInstances<UserStatistics>(alctx, UserStatistics, token,
        this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    }
    alctx.enter();
    Logger.logTrace(loggingCategory, `Queried ${userStatistics.length} user statistics for iModel ${imodelId}`);
    return userStatistics;
  }
}

/**
 * Query object for getting [[UserInfo]]. You can use this to modify the [[UserInfoHandler.get]] results.
 */
export class UserInfoQuery extends Query {
  private _queriedByIds = false;
  /** @hidden */
  protected _byId?: string;

  /**
   * Query UserInfo by user ids.
   * @param ids Ids of the users.
   * @returns This query.
   * @throws [[IModelHubClientError]] if ids array is empty.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if ids array is undefined or empty, or it contains non-Guid values.
   */
  public byIds(ids: string[]) {
    ArgumentCheck.nonEmptyArray("ids", ids);

    let filter = "$id+in+[";
    ids.forEach((id, index) => {
      ArgumentCheck.validGuid(`id[${index}]`, id);
      if (index > 0)
        filter += ",";
      filter += `'${id}'`;
    });
    filter += "]";

    this.addFilter(filter);
    this._queriedByIds = true;
    return this;
  }

  /** @hidden */
  public get isQueriedByIds() {
    return this._queriedByIds;
  }

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byId(id: string) {
    ArgumentCheck.validGuid("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @hidden
   */
  public getId() {
    return this._byId;
  }
}

/**
 * Handler for querying [[UserInfo]]. Use [[IModelClient.Users]] to get an instance of this class.
 */
export class UserInfoHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for UserInfoHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get the handler for querying [[UserStatistics]].
   */
  public Statistics(): UserStatisticsHandler {
    return new UserStatisticsHandler(this._handler);
  }

  /**
   * Get relative url for UserInfo requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param userId Id of the user.
   */
  private getRelativeUrl(imodelId: Guid, userId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/UserInfo/${userId || ""}`;
  }

  /**
   * Get the information on users who have accessed the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried users or select different data from them.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, query: UserInfoQuery = new UserInfoQuery()): Promise<UserInfo[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying users for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let users: UserInfo[];
    if (query.isQueriedByIds) {
      users = await this._handler.postQuery<UserInfo>(alctx, UserInfo, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    } else {
      users = await this._handler.getInstances<UserInfo>(alctx, UserInfo, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    }
    alctx.enter();
    Logger.logTrace(loggingCategory, `Queried users for iModel ${imodelId}`);

    return users;
  }
}

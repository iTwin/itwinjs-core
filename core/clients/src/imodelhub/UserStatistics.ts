/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap } from "./../ECJsonTypeMap";
import { UserInfo } from "./Users";
import { InstanceIdQuery } from "./index";
import { AccessToken } from "..";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { Logger } from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/** User Statistics */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.UserInfo", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class UserStatistics extends UserInfo {
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.BriefcasesCount")
  public briefcasesCount?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.OwnedLocksCount")
  public ownedLocksCount?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.PushedChangeSetsCount")
  public pushedChangeSetsCount?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[HasStatistics].relatedInstance[Statistics].properties.LastChangeSetPushDate")
  public lastChangeSetPushDate?: string;
}

/**
 * Query object for getting User Statistics. You can use this to modify the query.
 * @see UserStatisticsHandler.get()
 */
export class UserStatisticsQuery extends InstanceIdQuery {
  private _statisticsPrefix = "HasStatistics-forward-Statistics";
  private _queriedByIds = false;
  /**
   * Constructor for UserStatisticsQuery.
   */
  constructor() {
    super();
    this.select(`*`);
  }

  /**
   * Query User Statistics by ids.
   * @param ids Ids of the users.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if ids array is undefined or empty, or it contains not valid Guid values.
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

  /** Select all statistics */
  public selectAll() {
    return this.addSelect(`${this._statisticsPrefix}.*`);
  }

  /** Select Briefcases count */
  public selectBriefcasesCount() {
    return this.addSelect(`${this._statisticsPrefix}.BriefcasesCount`);
  }

  /** Select pushed ChangeSets count */
  public selectPushedChangeSetsCount() {
    return this.addSelect(`${this._statisticsPrefix}.PushedChangeSetsCount`);
  }

  /** Select Owned locks count */
  public selectOwnedLocksCount() {
    return this.addSelect(`${this._statisticsPrefix}.OwnedLocksCount`);
  }

  /** Select last ChangeSet push date count */
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

export class UserStatisticsHandler {
  private _handler: IModelBaseHandler;
  /**
   * Constructor for UserStatistics. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for UserStatistics requests.
   * @param imodelId Id of the iModel.
   * @param userId Id of the user.
   */
  private getRelativeUrl(imodelId: string, userId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/UserInfo/${userId ? userId : ""}`;
  }

  /**
   * Gets users statistics.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel.
   * @param query Object used to modify results of this query.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, imodelId: string,
    query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics[]> {
    Logger.logInfo(loggingCategory, `Querying user statistics for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    // if there are no specific selects defined, select all statistics
    if (query.getQueryOptions().$select === "*") {
      query.selectAll();
    }

    let userStatistics: UserStatistics[];
    if (query.isQueriedByIds) {
      userStatistics = await this._handler.postQuery<UserStatistics>(UserStatistics, token,
        this.getRelativeUrl(imodelId), query.getQueryOptions());
    } else {
      userStatistics = await this._handler.getInstances<UserStatistics>(UserStatistics, token,
        this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
    }

    Logger.logTrace(loggingCategory, `Queried ${userStatistics.length} user statistics for iModel ${imodelId}`);
    return userStatistics;
  }
}

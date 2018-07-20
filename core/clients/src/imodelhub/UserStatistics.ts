/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap } from "./../ECJsonTypeMap";
import { UserInfo } from "./Users";
import { InstanceIdQuery, IModelHubRequestError } from "./index";
import { AccessToken } from "..";
import { IModelBaseHandler } from "./BaseHandler";
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
  private statisticsPrefix = "HasStatistics-forward-Statistics";
  private queriedByIds = false;
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

  /** Select all statistics */
  public selectAll() {
    return this.addSelect(`${this.statisticsPrefix}.*`);
  }

  /** Select Briefcases count */
  public selectBriefcasesCount() {
    return this.addSelect(`${this.statisticsPrefix}.BriefcasesCount`);
  }

  /** Select pushed ChangeSets count */
  public selectPushedChangeSetsCount() {
    return this.addSelect(`${this.statisticsPrefix}.PushedChangeSetsCount`);
  }

  /** Select Owned locks count */
  public selectOwnedLocksCount() {
    return this.addSelect(`${this.statisticsPrefix}.OwnedLocksCount`);
  }

  /** Select last ChangeSet push date count */
  public selectLastChangeSetPushDate() {
    return this.addSelect(`${this.statisticsPrefix}.LastChangeSetPushDate`);
  }

  /** Returns whether was object queried by ids or no */
  public isQueriedByIds() {
    return this.queriedByIds;
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
   * @param iModelId Id of the iModel.
   * @param query Object used to modify results of this query.
   */
  public async get(token: AccessToken, iModelId: string,
    query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics[]> {
    Logger.logInfo(loggingCategory, `Querying user statistics for iModel ${iModelId}`);

    // if there are no specific selects defined, select all statistics
    if (query.getQueryOptions().$select === "*") {
      query.selectAll();
    }

    let userStatistics: UserStatistics[];
    if (query.isQueriedByIds()) {
      userStatistics = await this._handler.postQuery<UserStatistics>(UserStatistics, token,
        this.getRelativeUrl(iModelId), query.getQueryOptions());
    } else {
      userStatistics = await this._handler.getInstances<UserStatistics>(UserStatistics, token,
        this.getRelativeUrl(iModelId, query.getId()), query.getQueryOptions());
    }

    Logger.logTrace(loggingCategory, `Queried ${userStatistics.length} user statistics for iModel ${iModelId}`);
    return userStatistics;
  }
}

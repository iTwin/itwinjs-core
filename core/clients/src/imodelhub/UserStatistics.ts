/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap } from "./../ECJsonTypeMap";
import { IModelHubBaseHandler } from "./BaseHandler";
import { UserInfo } from "./Users";
import { InstanceIdQuery } from "./index";
import { AccessToken } from "..";

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
 * @see UserStatistics.GetUserStatistics()
 */
export class UserStatisticsQuery extends InstanceIdQuery {
  private statisticsPrefix = "HasStatistics-forward-Statistics";

  /**
   * Constructor for UserStatisticsQuery.
   */
  constructor() {
    super();
    this.select(`*`);
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
}

export class UserStatisticsHandler {
  private _handler: IModelHubBaseHandler;
  /**
   * Constructor for UserStatistics. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelHubBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for UserStatistics requests.
   * @param imodelId Id of the iModel.
   * @param userId Id of the user.
   */
  private getRelativeUrl(imodelId: string, userId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/UserInfo/${userId || ""}`;
  }

  /**
   * Gets user statistics.
   * @param token Delegation token of the authorized user.
   * @param iModelId Id of the iModel.
   * @param query Object used to modify results of this query.
   */
  public async GetUserStatistics(token: AccessToken, iModelId: string, query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics> {
    // if there are no specific selects defined, select all statistics
    if (query.getQueryOptions().$select === "*") {
      query.selectAll();
    }

    const userStatistics = await this._handler.getInstances<UserStatistics>(UserStatistics, token,
      this.getRelativeUrl(iModelId, query.getId()), query.getQueryOptions());

    if (userStatistics === undefined || userStatistics.length === 0) {
      Promise.reject(new Error(`User with id ${query.getId()} was not found.`));
    }

    if (userStatistics.length > 1) {
      Promise.reject(new Error(`Multiple users found.`));
    }

    return userStatistics[0];
  }

  /**
   * Gets users statistics.
   * @param token Delegation token of the authorized user.
   * @param iModelId Id of the iModel.
   * @param userIds Ids of users to query statistics.
   * @param query Object used to modify results of this query.
   */
  public async GetUsersStatistics(token: AccessToken, iModelId: string, userIds: string[],
    query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics[]> {
    const statistics: UserStatistics[] = [];

    for (const userId of userIds) {
      query.byId(userId);
      statistics.push(await this.GetUserStatistics(token, iModelId, query));
    }

    return statistics;
  }

  /**
   * Gets all users statistics.
   * @param token Delegation token of the authorized user.
   * @param iModelId Id of the iModel.
   * @param userIds Ids of users to query statistics.
   * @param query Object used to modify results of this query.
   */
  public async GetAllUsersStatistics(token: AccessToken, iModelId: string,
    query: UserStatisticsQuery = new UserStatisticsQuery()): Promise<UserStatistics[]> {
    // if there are no specific selects defined, select all statistics
    if (query.getQueryOptions().$select === "*") {
      query.selectAll();
    }

    const userStatistics = await this._handler.getInstances<UserStatistics>(UserStatistics, token,
      this.getRelativeUrl(iModelId), query.getQueryOptions());

    if (userStatistics === undefined || userStatistics.length === 0) {
      Promise.reject(new Error(`No users for iModel ${iModelId} was found.`));
    }

    return userStatistics;
  }
}

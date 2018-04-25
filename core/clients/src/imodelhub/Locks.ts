/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubBaseHandler } from "./BaseHandler";

import { RequestQueryOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { isBriefcaseIdValid } from "./index";
import { IModelHubRequestError } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Lock */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Lock", {schemaPropertyName: "schemaName", classPropertyName: "className"})
export class Lock extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ObjectId")
  public objectId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockType")
  public lockType?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockLevel")
  public lockLevel?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AcquiredDate")
  public acquiredDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSet")
  public releasedWithChangeSet?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSetIndex")
  public releasedWithChangeSetIndex?: string;
}

/**
 * Handler for all methods related to @see Lock instances.
 */
export class LockHandler {
  private _handler: IModelHubBaseHandler;

  /**
   * Constructor for LockHandler. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelHubBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for Lock requests.
   * @param imodelId Id of the iModel.
   * @param lockId Id of the lock.
   */
  private getRelativeUrl(imodelId: string, lockId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/Lock/${lockId || ""}`;
  }

  /**
   * Gets the locks that have been acquired for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of locks.
   */
  public async get(token: AccessToken, imodelId: string, queryOptions?: RequestQueryOptions): Promise<Lock[]> {
    Logger.logInfo(loggingCategory, `Querying locks for iModel ${imodelId}`);

    const locks = await this._handler.getInstances<Lock>(Lock, token, this.getRelativeUrl(imodelId), queryOptions);

    Logger.logTrace(loggingCategory, `Queried ${locks.length} locks for iModel ${imodelId}`);

    return locks;
  }

  /**
   * Deletes all locks owned by the specified briefcase
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param briefcaseId Id of the briefcacase
   */
  public async deleteAll(token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);

    if (!isBriefcaseIdValid(briefcaseId))
      return Promise.reject(IModelHubRequestError.invalidArgument("briefcaseId"));

    await this._handler.delete(token, this.getRelativeUrl(imodelId, `DeleteAll-${briefcaseId}`));

    Logger.logTrace(loggingCategory, `Deleted all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);
  }
}

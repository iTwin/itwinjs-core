/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Logger, assert, BeDuration, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { RpcPendingResponse, IModel, IModelToken, IModelVersion } from "@bentley/imodeljs-common";
import { PromiseMemoizer, QueryablePromise } from "../PromiseMemoizer";
import { IModelDb, OpenParams } from "../IModelDb";

const loggingCategory = "imodeljs-backend.OpenIModelDb";

/** Utility to cache and retrieve results of long running open IModelDb requests
 * The cache is keyed on the input arguments passed to open
 * @hidden
 */
export class OpenIModelDbMemoizer extends PromiseMemoizer<IModelDb> {

  private static _openIModelDbMemoizer: OpenIModelDbMemoizer;

  public constructor() {
    super(IModelDb.open, (_actx: ActivityLoggingContext, accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
      return `${accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
    });
  }

  private _superMemoize = this.memoize;
  public memoize = (actx: ActivityLoggingContext, accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): QueryablePromise<IModelDb> => {
    return this._superMemoize(actx, accessToken, contextId, iModelId, openParams, version);
  }

  private _superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (actx: ActivityLoggingContext, accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion) => {
    this._superDeleteMemoized(actx, accessToken, contextId, iModelId, openParams, version);
  }

  public static async openIModelDb(actx: ActivityLoggingContext, accessToken: AccessToken, iModelToken: IModelToken, openParams: OpenParams): Promise<IModel> {
    actx.enter();
    assert(iModelToken.changeSetId !== undefined, "Expected a valid changeSetId in openIModelDb");
    const iModelVersion = IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const accessTokenObj = AccessToken.fromJson(accessToken);

    Logger.logTrace(loggingCategory, "Received OpenIModelDbMemoizer.openIModelDb request at the backend", () => (iModelToken));

    if (!OpenIModelDbMemoizer._openIModelDbMemoizer)
      OpenIModelDbMemoizer._openIModelDbMemoizer = new OpenIModelDbMemoizer();
    const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = OpenIModelDbMemoizer._openIModelDbMemoizer;

    const qp = memoizeOpenIModelDb(actx, accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    await BeDuration.wait(50); // Wait a little before issuing a pending response - this avoids a potentially expensive round trip for the case a briefcase was already downloaded

    if (qp.isPending) {
      Logger.logTrace(loggingCategory, "Issuing pending status in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
      throw new RpcPendingResponse();
    }

    deleteMemoizedOpenIModelDb(actx, accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (qp.isFulfilled) {
      Logger.logTrace(loggingCategory, "Completed open request in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
      return qp.result!;
    }

    assert(qp.isRejected);
    Logger.logTrace(loggingCategory, "Rejected open request in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
    throw qp.error!;
  }
}

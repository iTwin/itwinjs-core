/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Logger, assert, BeDuration } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { RpcPendingResponse, IModel, IModelToken, IModelVersion } from "@bentley/imodeljs-common";
import { PromiseMemoizer, QueryablePromise } from "../PromiseMemoizer";
import { IModelDb, OpenParams } from "../IModelDb";

const loggingCategory = "imodeljs-backend.IModelDb";

/** Utility to cache and retrieve results of long running open IModelDb requests
 * The cache is keyed on the input arguments passed to open
 * @internal
 */
export class OpenIModelDbMemoizer extends PromiseMemoizer<IModelDb> {

  private static _openIModelDbMemoizer: OpenIModelDbMemoizer;

  public constructor() {
    super(IModelDb.open, (requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
      return `${requestContext.accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
    });
  }

  private _superMemoize = this.memoize;
  public memoize = (requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): QueryablePromise<IModelDb> => {
    return this._superMemoize(requestContext, contextId, iModelId, openParams, version);
  }

  private _superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion) => {
    this._superDeleteMemoized(requestContext, contextId, iModelId, openParams, version);
  }

  public static async openIModelDb(requestContext: AuthorizedClientRequestContext, iModelToken: IModelToken, openParams: OpenParams): Promise<IModel> {
    requestContext.enter();
    Logger.logTrace(loggingCategory, "Received OpenIModelDbMemoizer.openIModelDb request at the backend", () => iModelToken);

    assert(iModelToken.changeSetId !== undefined, "Expected a valid changeSetId in openIModelDb");
    const iModelVersion = IModelVersion.asOfChangeSet(iModelToken.changeSetId!);

    if (!OpenIModelDbMemoizer._openIModelDbMemoizer)
      OpenIModelDbMemoizer._openIModelDbMemoizer = new OpenIModelDbMemoizer();
    const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = OpenIModelDbMemoizer._openIModelDbMemoizer;

    const openQP = memoizeOpenIModelDb(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    const waitPromise = BeDuration.wait(100); // Wait a little before issuing a pending response - this avoids a potentially expensive round trip for the case a briefcase was already downloaded.
    await Promise.race([openQP.promise, waitPromise]); // This resolves as soon as either the open is completed or the wait time has expired. Prevents waiting un-necessarily if the open has already completed.

    if (openQP.isPending) {
      Logger.logTrace(loggingCategory, "Issuing pending status in OpenIModelDbMemoizer.openIModelDb", () => iModelToken);
      throw new RpcPendingResponse();
    }

    deleteMemoizedOpenIModelDb(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (openQP.isFulfilled) {
      Logger.logTrace(loggingCategory, "Completed open request in OpenIModelDbMemoizer.openIModelDb", () => iModelToken);
      return openQP.result!;
    }

    assert(openQP.isRejected);
    Logger.logTrace(loggingCategory, "Rejected open request in OpenIModelDbMemoizer.openIModelDb", () => iModelToken);
    throw openQP.error!;
  }
}

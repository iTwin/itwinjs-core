import { Logger, assert, BeDuration } from "@bentley/bentleyjs-core";
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
  public constructor() {
    super(IModelDb.open, (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
      return `${accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
    });
  }

  private _superMemoize = this.memoize;
  public memoize = (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): QueryablePromise<IModelDb> => {
    return this._superMemoize(accessToken, contextId, iModelId, openParams, version);
  }

  private _superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion) => {
    this._superDeleteMemoized(accessToken, contextId, iModelId, openParams, version);
  }

  public static async openIModelDb(accessToken: AccessToken, iModelToken: IModelToken, openParams: OpenParams): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const accessTokenObj = AccessToken.fromJson(accessToken);

    Logger.logTrace(loggingCategory, "Received OpenIModelDbMemoizer.openIModelDb request at the backend", () => (iModelToken));

    const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = new OpenIModelDbMemoizer();

    const qp = memoizeOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    await BeDuration.wait(50); // Wait a little before issuing a pending response - this avoids a potentially expensive round trip for the case a briefcase was already downloaded

    if (qp.isPending) {
      Logger.logTrace(loggingCategory, "Issuing pending status in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
      throw new RpcPendingResponse();
    }

    deleteMemoizedOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (qp.isFulfilled) {
      Logger.logTrace(loggingCategory, "Completed open request in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
      return qp.result!;
    }

    assert(qp.isRejected);
    Logger.logTrace(loggingCategory, "Rejected open request in OpenIModelDbMemoizer.openIModelDb", () => (iModelToken));
    throw qp.error!;
  }
}

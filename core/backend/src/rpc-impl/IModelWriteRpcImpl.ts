/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { Logger, assert, BeDuration } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, RpcInterface, RpcManager, RpcPendingResponse, IModel, IModelToken, IModelVersion, IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams, memoizeOpenIModelDb, deleteMemoizedOpenIModelDb } from "../IModelDb";

const loggingCategory = "imodeljs-backend.IModelWriteRpcImpl";

/**
 * The backend implementation of IModelWriteRpcInterface.
 * @hidden
 */
export class IModelWriteRpcImpl extends RpcInterface implements IModelWriteRpcInterface {
  public static register() { RpcManager.registerImpl(IModelWriteRpcInterface, IModelWriteRpcImpl); }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const accessTokenObj = AccessToken.fromJson(accessToken);
    const openParams = OpenParams.pullAndPush();

    Logger.logTrace(loggingCategory, "Received open request in IModelWriteRpcImpl.openForWrite", () => (iModelToken));

    // If the frontend wants a readOnly connection, we assume, for now, that they cannot change versions - i.e., cannot pull changes
    const qp = memoizeOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    await BeDuration.wait(50); // Wait a little before issuing a pending response - this avoids a potentially expensive round trip for the case a briefcase was already downloaded

    if (qp.isPending()) {
      Logger.logTrace(loggingCategory, "Issuing pending status in IModelWriteRpcImpl.openForWrite", () => (iModelToken));
      throw new RpcPendingResponse();
    }

    deleteMemoizedOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (qp.isFulfilled()) {
      Logger.logTrace(loggingCategory, "Completed open request in IModelWriteRpcImpl.openForWrite", () => (iModelToken));
      return qp.result!;
    }

    assert(qp.isRejected());
    Logger.logTrace(loggingCategory, "Rejected open request in IModelWriteRpcImpl.openForWrite", () => (iModelToken));
    throw qp.error!;
  }

  public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> { IModelDb.find(iModelToken).saveChanges(description); }
  public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> { IModelDb.find(iModelToken).updateProjectExtents(newExtents); }
}

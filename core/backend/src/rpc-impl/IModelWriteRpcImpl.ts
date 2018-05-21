/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, RpcInterface, RpcManager, IModel, IModelToken, IModelVersion, IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams } from "../IModelDb";

/**
 * The backend implementation of IModelWriteRpcInterface.
 * @hidden
 */
export class IModelWriteRpcImpl extends RpcInterface implements IModelWriteRpcInterface {
  public static register() { RpcManager.registerImpl(IModelWriteRpcInterface, IModelWriteRpcImpl); }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);

    return await IModelDb.open(AccessToken.fromJson(accessToken)!, iModelToken.contextId!, iModelToken.iModelId!, OpenParams.pullAndPush(), iModelVersion);
  }

  public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> { IModelDb.find(iModelToken).saveChanges(description); }
  public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> { IModelDb.find(iModelToken).updateProjectExtents(newExtents); }
}

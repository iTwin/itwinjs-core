/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, Gateway, IModel, IModelError, IModelStatus, IModelToken, IModelVersion, IModelWriteGateway } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";

/** @module Gateway */

/**
 * The backend implementation of IModelWriteGateway.
 * @hidden
 */
export class IModelWriteGatewayImpl extends Gateway implements IModelWriteGateway {
  public static register() { Gateway.registerImplementation(IModelWriteGateway, IModelWriteGatewayImpl); }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    if (OpenMode.ReadWrite !== iModelToken.openMode)
      return Promise.reject(new IModelError(IModelStatus.NotOpenForWrite));

    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    return await IModelDb.open(AccessToken.fromJson(accessToken)!, iModelToken.contextId!, iModelToken.iModelId!, iModelToken.openMode, iModelVersion);
  }

  public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> { IModelDb.find(iModelToken).saveChanges(description); }
  public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> { IModelDb.find(iModelToken).updateProjectExtents(newExtents); }
}

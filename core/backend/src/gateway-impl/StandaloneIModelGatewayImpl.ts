/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { Gateway, IModel, IModelToken, StandaloneIModelGateway } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";

/**
 * The backend implementation of StandaloneIModelGateway.
 * @hidden
 */
export class StandaloneIModelGatewayImpl extends Gateway implements StandaloneIModelGateway {
  public static register() { Gateway.registerImplementation(StandaloneIModelGateway, StandaloneIModelGatewayImpl); }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openStandalone(fileName: string, openMode: OpenMode): Promise<IModel> { return IModelDb.openStandalone(fileName, openMode); }

  public async closeStandalone(iModelToken: IModelToken): Promise<boolean> {
    IModelDb.find(iModelToken).closeStandalone();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, IModelServerHandler, IModelBankWsgClient } from "@bentley/imodeljs-clients";
import { IModelAccessContext } from "@bentley/imodeljs-backend";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export class IModelBankIModelAccessContext extends IModelAccessContext {
  private _handler: IModelBankWsgClient;

  constructor(id: string, accs: AccessToken, url: string) {
    super(id, "");
    this._handler = new IModelBankWsgClient(url, accs);
  }

  public get serverHandler(): IModelServerHandler | undefined { return this._handler; }
}

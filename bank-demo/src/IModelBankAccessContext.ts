/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelClient, IModelBankClient } from "@bentley/imodeljs-clients";
import { IModelAccessContext } from "@bentley/imodeljs-backend";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export class IModelBankIModelAccessContext extends IModelAccessContext {
  private _client: IModelBankClient;

  constructor(id: string, url: string) {
    super(id, "");
    this._client = new IModelBankClient(url);
  }

  public get client(): IModelClient | undefined { return this._client; }
}

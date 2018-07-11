/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHost, BriefcaseManager, IModelAccessContext } from "@bentley/imodeljs-backend";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelBankClient, IModelClient } from "@bentley/imodeljs-clients";
import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export const useIModelBank = true;

export function getRpcInterfaces() {
  return [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

export class IModelBankIModelAccessContext extends IModelAccessContext {
  private _client: IModelBankClient;

  constructor(id: string, bankurl: string) {
    super(id, "");
    this._client = new IModelBankClient(bankurl);
  }

  public get client(): IModelClient | undefined { return this._client; }
}

export function initializeBackend() {
  IModelHost.startup();

  Logger.initializeToConsole(); // configure logging for imodeljs-core

  if (useIModelBank)
    BriefcaseManager.setContext(new IModelBankIModelAccessContext("233e1f55-561d-42a4-8e80-d6f91743863e", "https://localhost:3001"));
}

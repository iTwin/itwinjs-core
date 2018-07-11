/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelBankClient, DeploymentEnv, AccessToken, IModelRepository } from "@bentley/imodeljs-clients/lib";
import { SimpleViewState } from "./SimpleViewState";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend";
import { OpenMode } from "@bentley/bentleyjs-core/lib/bentleyjs-core";

 // A connection to a non-Connect-hosted project and iModel
export class NonConnectProject {
  private _env: DeploymentEnv;

  constructor(env: DeploymentEnv) {
    this._env = env;
  }

  public getIModelClient() {
    return new IModelBankClient("https://localhost:3001", this._env);
  }

  // Set up to access the iModel using iModelBank
  public async loginAndOpenImodel(state: SimpleViewState): Promise<void> {
    state.accessToken = AccessToken.fromTokenString("");  // TODO
    state.project = { wsgId: "tbd", ecId: "tbd", name: "tbd" };
    state.iModel = { wsgId: "tbd", ecId: "tbd" } as IModelRepository;
    state.iModelConnection = await IModelConnection.open(state.accessToken!, "", "tbd-imodelid", OpenMode.Readonly);
  }
}

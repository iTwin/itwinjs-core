/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelAccessContext } from "@bentley/imodeljs-backend";
import { IModelBankIModelAccessContext } from "./IModelBankAccessContext";

export class NonBentleyProject {

  public static getAccessToken() {
    return { toTokenString: () => "", getUserProfile: () => ({ userId: "" }) } as AccessToken;
  }

  // Deploy and start up an iModelBank server for this iModel
  public static async getIModelAccessContext(imodelid: string, _projectid: string): Promise<IModelAccessContext> {
    // WIP DEMO WIP - we currently always use a single server, and it supports only one iModel!
    return new IModelBankIModelAccessContext(imodelid, "https://localhost:3001");
  }

}

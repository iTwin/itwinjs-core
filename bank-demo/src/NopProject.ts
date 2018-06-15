import { AccessToken } from "@bentley/imodeljs-clients";

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export class NopProject {

  public static getAccessToken() {
    return { toTokenString: () => "", getUserProfile: () => ({ userId: "" }) } as AccessToken; // TBD: Get AccessToken from project abstraction
  }

  public static async startImodelServer(_imodelid: string): Promise<string> {
    return "https://localhost:3001";  // TODO: deploy and start up a separate instance of iModelBank for each iModel
  }

}

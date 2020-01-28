/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelAuthorizationClient } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { UserInfo, AccessToken, ImsActiveSecureTokenClient, IModelHubClient } from "@bentley/imodeljs-clients/lib/imodeljs-clients";

export class IModelHubUserMgr implements IModelAuthorizationClient {
  private _token: AccessToken | undefined;

  public async authorizeUser(requestContext: ClientRequestContext, _userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    requestContext.enter();
    const authToken = await (new ImsActiveSecureTokenClient()).getToken(new ClientRequestContext(), userCredentials);
    requestContext.enter();
    const client = new IModelHubClient(undefined);
    this._token = await client.getAccessToken(requestContext, authToken);
    return this._token;
  }

  public isAuthorized = true;
  public hasExpired = true;
  public hasSignedIn = true;
  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this._token === undefined)
      throw new Error("not logged in");
    return Promise.resolve(this._token);
  }
}

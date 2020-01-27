/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { UserInfo } from "../UserInfo";
import { IModelAuthorizationClient } from "../IModelCloudEnvironment";

/** Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 * @internal
 */
export class IModelBankDummyAuthorizationClient implements IModelAuthorizationClient {
  private _token?: AccessToken;

  public async authorizeUser(_requestContext: ClientRequestContext, userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    if (!userInfo)
      userInfo = { id: "", email: { id: userCredentials.email }, profile: { name: "", firstName: "", lastName: "" } };
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo };
    this._token = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!;
    return Promise.resolve(this._token);
  }

  public isAuthorized = true;
  public hasExpired = true;
  public hasSignedIn = true;
  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> { return Promise.resolve(this._token!); }
}

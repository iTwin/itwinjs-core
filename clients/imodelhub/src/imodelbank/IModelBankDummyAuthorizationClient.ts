/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { UserInfo, AccessToken } from "@bentley/itwin-client";
import { IModelAuthorizationClient } from "../IModelCloudEnvironment";

class DummyAccessToken extends AccessToken {
  public static foreignProjectAccessTokenJsonProperty = "ForeignProjectAccessToken";

  /** Sets up a new AccessToken based on some generic token abstraction used for iModelBank use cases
   * @internal
   */
  public static fromForeignProjectAccessTokenJson(foreignJsonStr: string): AccessToken | undefined {
    if (!foreignJsonStr.startsWith(`{\"${this.foreignProjectAccessTokenJsonProperty}\":`))
      return undefined;
    const props: any = JSON.parse(foreignJsonStr);
    if (props[this.foreignProjectAccessTokenJsonProperty] === undefined)
      return undefined;
    const tok = new DummyAccessToken(foreignJsonStr);

    const userInfoJson = props[this.foreignProjectAccessTokenJsonProperty].userInfo;
    const userInfo = UserInfo.fromJson(userInfoJson);
    tok.setUserInfo(userInfo);
    return tok;
  }

}

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
    foreignAccessTokenWrapper[DummyAccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo };
    this._token = DummyAccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!;
    return Promise.resolve(this._token);
  }

  public isAuthorized = true;
  public hasExpired = true;
  public hasSignedIn = true;
  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> { return Promise.resolve(this._token!); }
}

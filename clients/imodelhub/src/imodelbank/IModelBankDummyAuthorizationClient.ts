/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, BeEvent } from "@bentley/bentleyjs-core";
import { UserInfo, AccessToken } from "@bentley/itwin-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";

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
export class IModelBankDummyAuthorizationClient implements FrontendAuthorizationClient {
  private _token?: AccessToken;

  public constructor(private _userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public async signIn(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    if (!this._userInfo) {
      this._userInfo = {
        id: "",
        email: {
          id: this._userCredentials.email,
        },
        profile: {
          name: "",
          firstName: "",
          lastName: "",
        },
      };
    }

    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[DummyAccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo: this._userInfo };
    this._token = DummyAccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper))!;
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public async signOut(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();
  public get isAuthorized(): boolean {
    return !!this._token;
  }
  public get hasExpired(): boolean {
    return !this._token;
  }
  public get hasSignedIn(): boolean {
    return !!this._token;
  }

  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (!this._token) {
      return Promise.reject("User is not signed in.");
    }
    return Promise.resolve(this._token);
  }
}

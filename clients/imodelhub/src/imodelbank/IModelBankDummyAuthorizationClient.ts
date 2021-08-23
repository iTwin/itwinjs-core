/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessTokenString, UserInfo } from "@bentley/itwin-client";

/** Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 * @internal
 */
export class IModelBankDummyAuthorizationClient implements FrontendAuthorizationClient {
  private _token?: AccessTokenString;

  public constructor(private _userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public get expiry(): Date{
    // PlaceHolder
    return new Date();
  }

  public async signIn(): Promise<void> {
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
    foreignAccessTokenWrapper.ForeignProjectAccessToken = { userInfo: this._userInfo };
    this._token = JSON.stringify(foreignAccessTokenWrapper);
    this.onUserStateChanged.raiseEvent(this._token);
  }

  public async signOut(): Promise<void> {
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessTokenString | undefined) => void>();
  public get isAuthorized(): boolean {
    return !!this._token;
  }
  public get hasExpired(): boolean {
    return !this._token;
  }
  public get hasSignedIn(): boolean {
    return !!this._token;
  }

  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessTokenString> {
    if (!this._token) {
      throw new Error("User is not signed in.");
    }
    return this._token;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessTokenString, UserInfo } from "@bentley/itwin-client";

export function tokenFromUserCredentials(userCredentials: any): AccessTokenString {
  const tokenString = Buffer.from(`${userCredentials.email}:${userCredentials.password}`).toString("base64");
  return tokenString;
}

/** Implements the user permission abstraction by creating a BasicAccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this BasicAccessToken.
 * @internal
 */
export class IModelBankBasicAuthorizationClient implements FrontendAuthorizationClient {
  private _token?: AccessTokenString;

  public constructor(_userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public get expiry(): Date {
    // Placeholder
    return new Date();
  }

  public async signIn(_requestContext?: ClientRequestContext): Promise<void> {
    _requestContext?.enter();
    this._token = tokenFromUserCredentials(this._userCredentials);
    this.onUserStateChanged.raiseEvent(this._token);
  }

  public async signOut(_requestContext?: ClientRequestContext): Promise<void> {
    _requestContext?.enter();
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

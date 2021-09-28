/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BeEvent } from "@bentley/bentleyjs-core";
import { AuthorizationClient } from "@bentley/itwin-client";
/** @packageDocumentation
 * @module iModelBankClient
 */

/**
 * Converts user credentials to basic access token string
 * @internal
 */
export function tokenFromUserCredentials(userCredentials: any): AccessToken {
  const tokenString = Buffer.from(`${userCredentials.email}:${userCredentials.password}`).toString("base64");
  return tokenString;
}

/** Implements the user permission abstraction by creating a BasicAccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this BasicAccessToken.
 * @internal
 */
export class IModelBankBasicAuthorizationClient implements AuthorizationClient {
  private _token?: AccessToken;

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    this._token = tokenFromUserCredentials(this._userCredentials);
    this.onUserStateChanged.raiseEvent(this._token);
  }

  public async signOut(): Promise<void> {
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
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

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._token) {
      throw new Error("User is not signed in.");
    }
    return this._token;
  }
}

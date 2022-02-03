/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken} from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import type { AuthorizationClient } from "@itwin/core-common";
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
  private _token: AccessToken = "";

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    this._token = tokenFromUserCredentials(this._userCredentials);
    this.onAccessTokenChanged.raiseEvent(this._token);
  }

  public async signOut(): Promise<void> {
    this._token = "";
    this.onAccessTokenChanged.raiseEvent(this._token);
  }

  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();
  public get isAuthorized(): boolean {
    return this._token !== "";
  }
  public get hasExpired(): boolean {
    return !this._token;
  }
  public get hasSignedIn(): boolean {
    return this._token !== "";
  }

  public async getAccessToken(): Promise<AccessToken> {
    return this._token;
  }
}

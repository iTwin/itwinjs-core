/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, AuthStatus, BeEvent, BentleyError } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";

/**
 * Basic FrontendAuthorizationClient to use with an already created access token.
 * @internal
 */
export class TestFrontendAuthorizationClient implements AuthorizationClient {
  private _activeToken: AccessToken = "";

  constructor(private _accessToken: AccessToken) {
    this._activeToken = this._accessToken;
    if (!this._activeToken?.toLowerCase().includes("bearer"))
      this._activeToken = `Bearer ${this._accessToken}`;
    this.onAccessTokenChanged.raiseEvent(this._activeToken);
  }

  public get isAuthorized(): boolean {
    return !!this._activeToken;
  }

  public get hasExpired(): boolean {
    return !this._activeToken;
  }

  public get hasSignedIn(): boolean {
    return !!this._activeToken;
  }

  public async signIn(): Promise<void> {
    this._activeToken = this._accessToken;
    this.onAccessTokenChanged.raiseEvent(this._activeToken);
  }

  public async signOut(): Promise<void> {
    this._activeToken = "";
    this.onAccessTokenChanged.raiseEvent(this._activeToken);
  }

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._activeToken)
      throw new BentleyError(AuthStatus.Error, "Cannot get access token");
    return this._activeToken;
  }

  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();
}

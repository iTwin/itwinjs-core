/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AuthStatus, BeEvent, BentleyError } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessTokenString } from "@bentley/itwin-client";

/**
 * Basic FrontendAuthorizationClient to use with an already created access token.
 * @internal
 */
export class TestFrontendAuthorizationClient implements FrontendAuthorizationClient {
  private _activeToken?: AccessTokenString;
  private _expiresAt?: Date | undefined = undefined;

  constructor(private _accessToken?: AccessTokenString, expiresAt?: Date) {
    this._activeToken = this._accessToken;
    this._expiresAt = expiresAt;
    this.onUserStateChanged.raiseEvent(this._activeToken);
  }

  public isExpired(token?: AccessTokenString): boolean {
    token = token ?? this._activeToken;
    return !(token === this._activeToken && this._expiresAt !== undefined && this._expiresAt > new Date());
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
    this.onUserStateChanged.raiseEvent(this._activeToken);
  }

  public async signOut(): Promise<void> {
    this._activeToken = undefined;
    this.onUserStateChanged.raiseEvent(this._activeToken);
  }

  public async getAccessToken(): Promise<AccessTokenString> {
    if (!this._activeToken)
      throw new BentleyError(AuthStatus.Error, "Cannot get access token");
    return this._activeToken;
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessTokenString | undefined) => void>();
}

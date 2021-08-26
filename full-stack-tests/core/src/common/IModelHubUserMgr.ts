/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessTokenString } from "@bentley/itwin-client";
import { getAccessTokenFromBackend } from "@bentley/oidc-signin-tool/lib/frontend";

export class IModelHubUserMgr implements FrontendAuthorizationClient {
  private _token: AccessTokenString | undefined;
  private _expiresAt?: Date; // TODO: Find way to set this

  public constructor(private _userCredentials: any) {
  }

  public isExpired(token?: AccessTokenString ): boolean {
    // Should we make this check 1 minute in advance?
    token = token ?? this._token;
    return !(token === this._token && this._expiresAt !== undefined && this._expiresAt > new Date());
  }

  public async signIn(_requestContext?: ClientRequestContext): Promise<void> {
    _requestContext?.enter();
    this._token = await getAccessTokenFromBackend(this._userCredentials);
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

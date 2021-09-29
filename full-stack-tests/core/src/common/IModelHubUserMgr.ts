/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { getAccessTokenFromBackend } from "@itwin/oidc-signin-tool/lib/frontend";

export class IModelHubUserMgr implements FrontendAuthorizationClient {
  private _token: AccessToken | undefined;

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    this._token = await getAccessTokenFromBackend(this._userCredentials);
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
    if (!this._token)
      throw new Error("User is not signed in.");
    return this._token;
  }
}

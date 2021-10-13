/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { TestUtility } from "@itwin/oidc-signin-tool";
import { AuthorizationClient } from "@itwin/core-common";

export class TestIModelHubOidcAuthorizationClient implements AuthorizationClient {
  private _token: AccessToken = "";

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    this._token = await TestUtility.getAccessToken(this._userCredentials);
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
    return false;
  }
  public get hasSignedIn(): boolean {
    return this._token !== "";
  }

  public async getAccessToken(): Promise<AccessToken> {
    return this._token;
  }
}

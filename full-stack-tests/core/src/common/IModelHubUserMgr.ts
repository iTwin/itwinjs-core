/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { AccessToken} from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import { getAccessTokenFromBackend } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import type { AuthorizationClient } from "@itwin/core-common";

export class IModelHubUserMgr implements AuthorizationClient {
  private _token: AccessToken = "";

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    this._token = await getAccessTokenFromBackend(this._userCredentials);
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
    return false;
  }
  public get hasSignedIn(): boolean {
    return this._token !== "";
  }

  public async getAccessToken(): Promise<AccessToken> {
    return this._token;
  }
}

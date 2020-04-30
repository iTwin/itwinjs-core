/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken, UserInfo } from "@bentley/itwin-client";
import { getAccessTokenFromBackend } from "@bentley/oidc-signin-tool/lib/frontend";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";

export class IModelHubUserMgr implements FrontendAuthorizationClient {
  private _token: AccessToken | undefined;

  public constructor(_userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public async signIn(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = await getAccessTokenFromBackend(this._userCredentials);
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public async signOut(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
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

  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (!this._token) {
      return Promise.reject("User is not signed in.");
    }
    return Promise.resolve(this._token);
  }
}

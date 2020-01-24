/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, AuthStatus } from "@bentley/bentleyjs-core";
import { AccessToken, IAuthorizationClient } from "@bentley/imodeljs-clients";

// tslint:disable:ter-indent

// Trivial implementation of IAuthorizationClient
export class AuthorizationClient implements IAuthorizationClient {
  constructor(private _accessToken?: AccessToken) { }

  public get isAuthorized(): boolean {
    return !!this._accessToken;
  }

  public get hasExpired(): boolean {
    return !this._accessToken;
  }

  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._accessToken)
      throw new BentleyError(AuthStatus.Error, "Cannot get access token");
    return this._accessToken;
  }

  public setAccessToken(accessToken?: AccessToken) {
    this._accessToken = accessToken;
  }
}

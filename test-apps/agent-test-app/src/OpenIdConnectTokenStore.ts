/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { UserProfile, AccessToken } from "@bentley/imodeljs-clients";
import { TokenSet, UserInfo, Client } from "openid-client";

export class OpenIdConnectTokenStore {
  constructor(private _tokenSet: TokenSet, private _oidcClient: Client) { }

  // Get the current token set, refreshing it if necessary
  private async getTokenSet(): Promise<TokenSet> {
    if ((this._tokenSet.expires_at * 1000) < (Date.now() - 1 * 60 * 1000))
      this._tokenSet = await this._oidcClient.refresh(this._tokenSet.refresh_token); // Refresh the TokenSet if it's just 1 minute short of expiry
    return this._tokenSet;
  }

  // Gets the current user's profile
  private async getUserProfile(): Promise<UserProfile> {
    const { access_token } = await this.getTokenSet();
    const userInfo: UserInfo = await this._oidcClient.userinfo(access_token);
    return new UserProfile(userInfo.given_name, userInfo.family_name, userInfo.email!, userInfo.sub, userInfo.org_name!, userInfo.org!, userInfo.ultimate_site!, userInfo.usage_country_iso!);
  }

  /**
   * Gets the current user's access token, refreshing it if necessary
   */
  public async getAccessToken(): Promise<AccessToken> {
    const tokenSet: TokenSet = await this.getTokenSet();
    const userProfile: UserProfile = await this.getUserProfile();

    const startsAt: Date = new Date(tokenSet.expires_at - tokenSet.expires_in);
    const expiresAt: Date = new Date(tokenSet.expires_at);
    return AccessToken.fromJsonWebTokenString(tokenSet.access_token, userProfile, startsAt, expiresAt);
  }

}

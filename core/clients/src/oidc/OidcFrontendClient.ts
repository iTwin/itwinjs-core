/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { UserProfile } from "../UserProfile";
import { AccessToken } from "../Token";
import { OidcClient } from "./OidcClient";
import { UserManagerSettings, User, WebStorageStateStore } from "oidc-client";

/** Client configuration to generate OIDC/OAuth tokens for frontend or browser applications */
export interface OidcFrontendClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;
  /** Upon login, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI */
  redirectUri: string;
  /**
   * Optional storage object used to persist User for currently authenticated user.
   * e.g. userStore: new WebStorageStateStore({ store: window.localStorage })
   * Defaults to session storage if unspecified.
   * @hidden
   */
  userStore?: WebStorageStateStore;
  /**
   * Optional storage object used to persist State for currently authenticated user.
   * e.g. userStore: new WebStorageStateStore({ store: window.localStorage })
   * Defaults to session storage if unspecified.
   * @hidden
   */
  stateStore?: WebStorageStateStore;
}

/** Utility to generate OIDC/OAuth tokens for backend applications */
export class OidcFrontendClient extends OidcClient {
  public constructor(private _configuration: OidcFrontendClientConfiguration) {
    super();
  }

  public async getUserManagerSettings(actx: ActivityLoggingContext): Promise<UserManagerSettings> {
    const userManagerSettings: UserManagerSettings = {
      authority: await this.getUrl(actx),
      client_id: this._configuration.clientId,
      redirect_uri: this._configuration.redirectUri,
      silent_redirect_uri: this._configuration.redirectUri,
      automaticSilentRenew: true,
      response_type: "id_token token",
      scope: "openid email profile organization feature_tracking imodelhub context-registry-service",
      userStore: this._configuration.userStore,
      stateStore: this._configuration.stateStore,
    };
    return userManagerSettings;
  }

  public static createAccessToken(user: User): AccessToken {
    const startsAt: Date = new Date(user.expires_at - user.expires_in!);
    const expiresAt: Date = new Date(user.expires_at);
    const userProfile = new UserProfile(user.profile.given_name, user.profile.family_name, user.profile.email!, user.profile.sub, user.profile.org_name!, user.profile.org!, user.profile.ultimate_site!, user.profile.usage_country_iso!);
    return AccessToken.fromJsonWebTokenString(user.access_token, userProfile, startsAt, expiresAt);
  }
}

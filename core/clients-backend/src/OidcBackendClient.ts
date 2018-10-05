/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { OidcClient, AccessToken, UserProfile, IncludePrefix } from "@bentley/imodeljs-clients";
import { Issuer, Client as OpenIdClient, ClientConfiguration, GrantParams, TokenSet, UserInfo } from "openid-client";
import { ActivityLoggingContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";

/** Client configuration to create OIDC/OAuth tokens for backend applications */
export interface OidcBackendClientConfiguration {
  clientId: string;
  clientSecret: string;
}

/** Utility to generate OIDC/OAuth tokens for backend applications */
export abstract class OidcBackendClient extends OidcClient {
  private _clientConfiguration: ClientConfiguration;
  /**
   * Creates an instance of OidcBackendClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(configuration: OidcBackendClientConfiguration) {
    super();

    this._clientConfiguration = {
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
    };
  }

  private _issuer: Issuer;
  private async getIssuer(actx: ActivityLoggingContext): Promise<Issuer> {
    actx.enter();

    if (this._issuer)
      return this._issuer;

    const url = await this.getUrl(actx);
    this._issuer = await Issuer.discover(url);
    return this._issuer;
  }

  /**
   * Discover the endpoints of the service
   */
  public async discoverEndpoints(actx: ActivityLoggingContext): Promise<Issuer> {
    actx.enter();
    return this.getIssuer(actx);
  }

  private _client: OpenIdClient;
  protected async getClient(actx: ActivityLoggingContext): Promise<OpenIdClient> {
    actx.enter();

    if (this._client)
      return this._client;

    const issuer = await this.getIssuer(actx);
    this._client = new issuer.Client(this._clientConfiguration);
    return this._client;
  }

  private createUserProfile(userInfo: UserInfo): UserProfile {
    return new UserProfile(userInfo.given_name, userInfo.family_name, userInfo.email!, userInfo.sub, userInfo.org_name!, userInfo.org!, userInfo.ultimate_site!, userInfo.usage_country_iso!);
  }

  private createToken(tokenSet: TokenSet, userInfo: UserInfo): AccessToken {
    const startsAt: Date = new Date(tokenSet.expires_at - tokenSet.expires_in);
    const expiresAt: Date = new Date(tokenSet.expires_at);
    const userProfile = this.createUserProfile(userInfo);
    return AccessToken.fromJsonWebTokenString(tokenSet.access_token, userProfile, startsAt, expiresAt);
  }

  protected async exchangeToken(actx: ActivityLoggingContext, grantParams: GrantParams): Promise<AccessToken> {
    actx.enter();

    const scope = grantParams.scope;
    if (!scope.includes("openid") || !scope.includes("email") || !scope.includes("profile") || !scope.includes("organization"))
      throw new BentleyError(BentleyStatus.ERROR, "Scopes when fetching a JWT token must include 'openid email profile organization'");

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(grantParams);
    const userInfo: UserInfo = await client.userinfo(tokenSet.access_token);
    return this.createToken(tokenSet, userInfo);
  }

  /** Refresh the supplied JSON Web Token (assuming the client was registered for offline access) */
  public async refreshToken(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken> {
    actx.enter();

    // Refresh 1 minute before expiry
    const expiresAt = jwt.getExpiresAt();
    if (!expiresAt)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid JWT passed to refresh");
    if ((expiresAt.getTime() - Date.now()) > 1 * 60 * 1000)
      return jwt;

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.refresh(jwt.toTokenString(IncludePrefix.No)!);
    const userInfo: UserInfo = await client.userinfo(tokenSet.access_token);
    return this.createToken(tokenSet, userInfo);
  }
}

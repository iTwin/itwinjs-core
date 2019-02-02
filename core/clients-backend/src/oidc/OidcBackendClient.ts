/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { OidcClient, AccessToken, UserInfo } from "@bentley/imodeljs-clients";
import { Issuer, Client as OpenIdClient, ClientConfiguration, TokenSet } from "openid-client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Client configuration to create OIDC/OAuth tokens for backend applications */
export interface OidcBackendClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;
  /** Client application's secret key as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientSecret: string;
  /** List of space separated scopes to request access to various resources. */
  scope: string;
}

/** Utility to generate OIDC/OAuth tokens for backend applications */
export abstract class OidcBackendClient extends OidcClient {
  protected _configuration: OidcBackendClientConfiguration;

  /**
   * Creates an instance of OidcBackendClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(configuration: OidcBackendClientConfiguration) {
    super();
    this._configuration = configuration;
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

    const clientConfiguration: ClientConfiguration = {
      client_id: this._configuration.clientId,
      client_secret: this._configuration.clientSecret,
    };
    const issuer = await this.getIssuer(actx);
    this._client = new issuer.Client(clientConfiguration);
    return this._client;
  }

  protected createToken(tokenSet: TokenSet, userInfo?: UserInfo): AccessToken {
    const startsAt: Date = new Date(tokenSet.expires_at - tokenSet.expires_in);
    const expiresAt: Date = new Date(tokenSet.expires_at);
    return AccessToken.fromJsonWebTokenString(tokenSet.access_token, startsAt, expiresAt, userInfo);
  }

}

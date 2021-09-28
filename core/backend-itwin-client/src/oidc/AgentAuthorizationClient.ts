/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ClientMetadata, custom, GrantBody, Issuer, Client as OpenIdClient, TokenSet } from "openid-client";
import { AccessToken, AuthStatus, BentleyError } from "@bentley/bentleyjs-core";
import { AuthorizationClient, ImsAuthorizationClient, RequestGlobalOptions } from "@bentley/itwin-client";

/**
 * Configuration of clients for agent or service applications.
 * @see [[AgentAuthorizationClient]] for notes on registering an application
 * @beta
 */
export interface AgentAuthorizationClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  readonly clientId: string;
  /** Client application's secret key as registered with the Bentley IMS OIDC/OAuth2 provider. */
  readonly clientSecret: string;
  /** List of space separated scopes to request access to various resources. */
  readonly scope: string;
  /** The URL of the OIDC/OAuth2 provider. If left undefined, the iTwin Platform authority (`ims.bentley.com`) will be used by default. */
  readonly authority?: string;
}

/**
 * Utility to generate OIDC/OAuth tokens for agent or agent applications
 * * The application must register a client using the
 * [self service registration page](https://developer.bentley.com/register/).
 * * The client type must be "Agent"
 * * Use the Client Id/Client Secret/Scopes to create the agent configuration that's passed in.
 * * Ensure the application can access the iTwin Project/Asset - in production environments, this is done by
 * using the iTwin project portal to add add the email **`{Client Id}@apps.imsoidc.bentley.com`** as an authorized user
 * with the appropriate role that includes the required access permissions.
 * @beta
 */
export class AgentAuthorizationClient extends ImsAuthorizationClient implements AuthorizationClient {
  protected _configuration: AgentAuthorizationClientConfiguration;
  private _accessToken?: AccessToken;
  private _expiresAt?: Date;
  private _issuer?: Issuer<OpenIdClient>;

  constructor(agentConfiguration: AgentAuthorizationClientConfiguration) {
    super();

    custom.setHttpOptionsDefaults({
      timeout: RequestGlobalOptions.timeout.response,
      retry: RequestGlobalOptions.maxRetries,
      agent: {
        https: RequestGlobalOptions.httpsProxy,
      },
    });

    this._configuration = agentConfiguration;
  }

  private async getIssuer(): Promise<Issuer<OpenIdClient>> {
    if (this._issuer)
      return this._issuer;

    const url = await this.getUrl();
    this._issuer = await Issuer.discover(url);
    return this._issuer;
  }

  /**
   * Discover the endpoints of the service
   */
  public async discoverEndpoints(): Promise<Issuer<OpenIdClient>> {
    return this.getIssuer();
  }

  private _client?: OpenIdClient;
  protected async getClient(): Promise<OpenIdClient> {
    if (this._client)
      return this._client;

    const clientConfiguration: ClientMetadata = {
      client_id: this._configuration.clientId, // eslint-disable-line @typescript-eslint/naming-convention
      client_secret: this._configuration.clientSecret, // eslint-disable-line @typescript-eslint/naming-convention
    };

    const issuer = await this.getIssuer();
    this._client = new issuer.Client(clientConfiguration);

    return this._client;
  }

  private async generateAccessToken(): Promise<AccessToken> {
    const scope = this._configuration.scope;
    if (scope.includes("openid") || scope.includes("email") || scope.includes("profile") || scope.includes("organization"))
      throw new BentleyError(AuthStatus.Error, "Scopes for an Agent cannot include 'openid email profile organization'");

    const grantParams: GrantBody = {
      grant_type: "client_credentials", // eslint-disable-line @typescript-eslint/naming-convention
      scope,
    };

    let tokenSet: TokenSet;
    const client = await this.getClient();
    try {
      tokenSet = await client.grant(grantParams);
    } catch (error: any) {
      throw new BentleyError(AuthStatus.Error, error.message || "Authorization error", () => ({ error: error.error, message: error.message }));
    }

    this._accessToken = `Bearer ${tokenSet.access_token}`;
    if (tokenSet.expires_at)
      this._expiresAt = new Date(tokenSet.expires_at * 1000);
    return this._accessToken;
  }

  /**
   * Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return this.hasSignedIn && !this.hasExpired;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    if (!this._accessToken)
      return false;

    if (!this._expiresAt)
      throw new BentleyError(AuthStatus.Error, "Invalid JWT");

    return this._expiresAt.getTime() - Date.now() <= 1 * 60 * 1000; // Consider 1 minute before expiry as expired
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized client.
   * The token is refreshed if necessary.
   */
  public async getAccessToken(): Promise<AccessToken> {
    if (this.isAuthorized)
      return this._accessToken!;
    return this.generateAccessToken();
  }
}

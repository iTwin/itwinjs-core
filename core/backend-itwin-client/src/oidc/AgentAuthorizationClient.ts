/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { AuthStatus, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AccessTokenString, AuthorizationClient } from "@bentley/itwin-client";
import { GrantBody, TokenSet } from "openid-client";
import { BackendITwinClientLoggerCategory } from "../BackendITwinClientLoggerCategory";
import { BackendAuthorizationClient, BackendAuthorizationClientConfiguration } from "./BackendAuthorizationClient";

const loggerCategory = BackendITwinClientLoggerCategory.Authorization;

/**
 * Configuration of clients for agent or service applications.
 * @see [[AgentAuthorizationClient]] for notes on registering an application
 * @beta
 */
export type AgentAuthorizationClientConfiguration = BackendAuthorizationClientConfiguration;

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
export class AgentAuthorizationClient extends BackendAuthorizationClient implements AuthorizationClient {
  private _accessToken?: AccessTokenString;
  private _expiresAt?: Date;

  constructor(agentConfiguration: AgentAuthorizationClientConfiguration) {
    super(agentConfiguration);
  }

  private async generateAccessToken(requestContext: ClientRequestContext): Promise<AccessTokenString> {
    const scope = this._configuration.scope;
    if (scope.includes("openid") || scope.includes("email") || scope.includes("profile") || scope.includes("organization"))
      throw new BentleyError(AuthStatus.Error, "Scopes for an Agent cannot include 'openid email profile organization'");

    const grantParams: GrantBody = {
      grant_type: "client_credentials", // eslint-disable-line @typescript-eslint/naming-convention
      scope,
    };

    let tokenSet: TokenSet;
    const client = await this.getClient(requestContext);
    try {
      tokenSet = await client.grant(grantParams);
    } catch (error) {
      throw new BentleyError(AuthStatus.Error, error.message || "Authorization error", Logger.logError, loggerCategory, () => ({ error: error.error, message: error.message }));
    }

    this._accessToken = tokenSet.access_token;
    this._expiresAt = new Date(tokenSet.expires_at!); // TODO: Check if this is in proper format
    return this._accessToken;
  }

  public isExpired(token?: AccessTokenString ): boolean {
    // Should we make this check 1 minute in advance?
    token = token ?? this._accessToken;
    return !(token === this._accessToken && this._expiresAt !== undefined && this._expiresAt > new Date());
  }

  /**
   * Get the access token
   * @deprecated Use [[AgentAuthorizationClient.getAccessToken]] instead.
   */
  public async getToken(requestContext: ClientRequestContext): Promise<AccessTokenString> {
    return this.generateAccessToken(requestContext);
  }

  /**
   * Refresh the access token - simply checks if the token is still valid before re-fetching a new access token
   * @deprecated Use [[AgentAuthorizationClient.getAccessToken]] instead to always get a valid token.
   */
  // SHOULD WE REMOVE THIS NOW?
  public async refreshToken(requestContext: ClientRequestContext, jwt: AccessTokenString): Promise<AccessTokenString> {
    requestContext.enter();

    if (!this.isExpired(jwt)){
      return jwt;
    }

    this._accessToken = await this.generateAccessToken(requestContext);
    return this._accessToken;
  }

  /**
   * Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return this.hasSignedIn && !this.isExpired(this._accessToken);
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized client.
   * The token is refreshed if necessary.
   */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessTokenString> {
    if (this.isAuthorized)
      return this._accessToken!;
    return this.generateAccessToken(requestContext || new ClientRequestContext());
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { GrantBody, TokenSet } from "openid-client";
import { AccessToken, AuthStatus, BentleyError } from "@itwin/core-bentley";
import { AuthorizationClient } from "@bentley/itwin-client";
import { BackendAuthorizationClient, BackendAuthorizationClientConfiguration } from "./BackendAuthorizationClient";

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
 * * Ensure the application can access the iTwin - in production environments, this is done by
 * using the iTwin portal to add add the email **`{Client Id}@apps.imsoidc.bentley.com`** as an authorized user
 * with the appropriate role that includes the required access permissions.
 * @beta
 */
export class AgentAuthorizationClient extends BackendAuthorizationClient implements AuthorizationClient {
  private _accessToken?: AccessToken;
  private _expiresAt?: Date;

  constructor(agentConfiguration: AgentAuthorizationClientConfiguration) {
    super(agentConfiguration);
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

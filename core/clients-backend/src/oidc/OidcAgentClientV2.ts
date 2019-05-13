/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { GrantParams, TokenSet } from "openid-client";
import { AccessToken } from "@bentley/imodeljs-clients";
import { BentleyStatus, BentleyError, ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";

/**
 * Configuration of clients for agent or service applications.
 * @internal
 */
export type OidcAgentClientConfigurationV2 = OidcBackendClientConfiguration;

/**
 * Utility to generate OIDC/OAuth tokens for agent or service applications
 * @internal
 */
export class OidcAgentClientV2 extends OidcBackendClient {
  constructor(agentConfiguration: OidcAgentClientConfigurationV2) {
    super(agentConfiguration);
  }

  /** Get the access token */
  public async getToken(requestContext: ClientRequestContext): Promise<AccessToken> {
    const scope = this._configuration.scope;
    if (scope.includes("openid") || scope.includes("email") || scope.includes("profile") || scope.includes("organization"))
      throw new BentleyError(BentleyStatus.ERROR, "Scopes for an Agent cannot include 'openid email profile organization'");

    const grantParams: GrantParams = {
      grant_type: "client_credentials",
      scope,
    };

    const client = await this.getClient(requestContext);
    const tokenSet: TokenSet = await client.grant(grantParams);
    const userInfo = OidcBackendClient.parseUserInfo(tokenSet.access_token);
    return this.createToken(tokenSet, userInfo);
  }

  /** Refresh the access token - simply checks if the token is still valid before re-fetching a new access token */
  public async refreshToken(requestContext: ClientRequestContext, jwt: AccessToken): Promise<AccessToken> {
    requestContext.enter();

    // Refresh 1 minute before expiry
    const expiresAt = jwt.getExpiresAt();
    if (!expiresAt)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid JWT passed to refresh");
    if ((expiresAt.getTime() - Date.now()) < 1 * 60 * 1000)
      return jwt;

    return this.getToken(requestContext);
  }
}

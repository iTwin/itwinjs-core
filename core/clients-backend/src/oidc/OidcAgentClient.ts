/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { GrantParams, TokenSet } from "openid-client";
import { decode } from "jsonwebtoken";
import { AccessToken, UserInfo } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";

export type OidcAgentClientConfiguration = OidcBackendClientConfiguration;

/** Utility to generate OIDC/OAuth tokens for agent or service applications */
export class OidcAgentClient extends OidcBackendClient {
  constructor(agentConfiguration: OidcAgentClientConfiguration) {
    super(agentConfiguration);
  }

  /** Get the access token */
  public async getToken(actx: ActivityLoggingContext): Promise<AccessToken> {
    const scope = this._configuration.scope;
    if (scope.includes("openid") || scope.includes("email") || scope.includes("profile") || scope.includes("organization"))
      throw new BentleyError(BentleyStatus.ERROR, "Scopes for an Agent cannot include 'openid email profile organization'");

    const grantParams: GrantParams = {
      grant_type: "client_credentials",
      scope,
    };

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(grantParams);

    const decoded: any = decode(tokenSet.access_token, { json: true, complete: false });
    const userInfo = UserInfo.fromJson(decoded);

    return this.createToken(tokenSet, userInfo);
  }

  /** Refresh the access token - simply checks if the token is still valid before re-fetching a new access token */
  public async refreshToken(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken> {
    actx.enter();

    // Refresh 1 minute before expiry
    const expiresAt = jwt.getExpiresAt();
    if (!expiresAt)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid JWT passed to refresh");
    if ((expiresAt.getTime() - Date.now()) > 1 * 60 * 1000)
      return jwt;

    return this.getToken(actx);
  }
}

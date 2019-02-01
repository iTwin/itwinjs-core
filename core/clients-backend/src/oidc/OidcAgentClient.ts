/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { GrantParams, TokenSet } from "openid-client";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, IncludePrefix } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";
import { OidcDelegationClient } from "./OidcDelegationClient";

// @todo: We are using the V1 version of this API for now.
// Migrate to V2 after the Connect + IMS team can support -
// * Setting up a way for the agent client's "user" ({client_id}@apps.imsoidc.bentley.com)
//   to access Connect projects without the need to accept EULA agreements.
// * Provide a friendly name for this "user" - it currently shows up in Connect
//   with the first and last names as the above email instead of the client's name

/** Client configuration to create OIDC/OAuth tokens for agent applications */
export interface OidcAgentClientConfiguration extends OidcBackendClientConfiguration {
  serviceUserEmail: string;
  serviceUserPassword: string;
}

/** Utility to generate OIDC/OAuth tokens for agent or service applications */
export class OidcAgentClient extends OidcBackendClient {
  constructor(private _agentConfiguration: OidcAgentClientConfiguration) {
    super(_agentConfiguration as OidcBackendClientConfiguration);
  }

  public async getToken(actx: ActivityLoggingContext): Promise<AccessToken> {
    // Note: for now we start with an IMS saml token, and use OIDC delegation to get a JWT token
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(actx, this._agentConfiguration.serviceUserEmail, this._agentConfiguration.serviceUserPassword, this._configuration.clientId);
    const samlToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(actx, authToken);

    const delegationClient = new OidcDelegationClient(this._configuration);
    const jwt: AccessToken = await delegationClient.getJwtFromSaml(actx, samlToken);
    return jwt;
  }

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

export type OidcAgentClientConfigurationV2 = OidcBackendClientConfiguration;

/** Utility to generate OIDC/OAuth tokens for agent or service applications */
export class OidcAgentClientV2 extends OidcBackendClient {
  constructor(agentConfiguration: OidcAgentClientConfigurationV2) {
    super(agentConfiguration);
  }

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
    return this.createToken(tokenSet);
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
    return this.createToken(tokenSet);
  }
}

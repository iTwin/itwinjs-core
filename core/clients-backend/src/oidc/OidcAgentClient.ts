/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ClientRequestContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";
import { OidcDelegationClient } from "./OidcDelegationClient";

/** Client configuration to create OIDC/OAuth tokens for agent applications
 * @internal
 */
export interface OidcAgentClientConfiguration extends OidcBackendClientConfiguration {
  serviceUserEmail: string;
  serviceUserPassword: string;
}

/** Utility to generate OIDC/OAuth tokens for agent or service applications
 * @internal
 */
export class OidcAgentClient extends OidcBackendClient {
  constructor(private _agentConfiguration: OidcAgentClientConfiguration) {
    super(_agentConfiguration as OidcBackendClientConfiguration);
  }

  public async getToken(requestContext: ClientRequestContext): Promise<AccessToken> {
    // Note: for now we start with an IMS saml token, and use OIDC delegation to get a JWT token
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(requestContext, {
      email: this._agentConfiguration.serviceUserEmail,
      password: this._agentConfiguration.serviceUserPassword,
    }, this._configuration.clientId);
    const samlToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(requestContext, authToken);

    const delegationClient = new OidcDelegationClient(this._configuration);
    const jwt: AccessToken = await delegationClient.getJwtFromSaml(requestContext, samlToken);
    return jwt;
  }

  public async refreshToken(requestContext: ClientRequestContext, jwt: AccessToken): Promise<AccessToken> {
    requestContext.enter();

    // Refresh 1 minute before expiry
    const expiresAt = jwt.getExpiresAt();
    if (!expiresAt)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid JWT passed to refresh");
    if ((expiresAt.getTime() - Date.now()) > 1 * 60 * 1000)
      return jwt;

    return this.getToken(requestContext);
  }
}

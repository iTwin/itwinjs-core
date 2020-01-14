/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ClientRequestContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";
import { OidcDelegationClient } from "./OidcDelegationClient";

/** Client configuration to create OIDC/OAuth tokens for agent applications
 * @internal
 * @deprecated Use [[OidcAgentClientConfiguration]]
 */
export interface OidcAgentClientConfigurationV1 extends OidcBackendClientConfiguration {
  serviceUserEmail: string;
  serviceUserPassword: string;
}

/** Utility to generate OIDC/OAuth tokens for agent or service applications
 * @internal
 * @deprecated Use [[OidcAgentClient]].  Will be removed in iModel.js 2.0
 */
export class OidcAgentClientV1 extends OidcBackendClient {
  constructor(private _agentConfiguration: OidcAgentClientConfigurationV1) {
    super(_agentConfiguration as OidcBackendClientConfiguration);
  }

  public async getToken(requestContext: ClientRequestContext): Promise<AccessToken> {
    // Note: for now we start with an IMS SAML token, and use OIDC delegation to get a JWT token
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

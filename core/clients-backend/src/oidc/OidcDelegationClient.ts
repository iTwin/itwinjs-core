/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, IncludePrefix } from "@bentley/imodeljs-clients";
import { GrantParams, TokenSet } from "openid-client";
import { BentleyStatus, BentleyError, ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";

export type OidcDelegationClientConfiguration = OidcBackendClientConfiguration;

/** Utility to generate delegation OAuth or legacy SAML tokens for backend applications */
export class OidcDelegationClient extends OidcBackendClient {
  /**
   * Creates an instance of OidcBackendClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(configuration: OidcDelegationClientConfiguration) {
    super(configuration);
  }

  private async exchangeToJwtToken(requestContext: ClientRequestContext, accessToken: AccessToken, grantType: string): Promise<AccessToken> {
    requestContext.enter();

    const grantParams: GrantParams = {
      grant_type: grantType,
      scope: this._configuration.scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(requestContext);
    const tokenSet: TokenSet = await client.grant(grantParams);
    return this.createToken(tokenSet, accessToken.getUserInfo());
  }

  /** Get a JWT for the specified scope from a SAML token */
  public async getJwtFromSaml(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken> {
    requestContext.enter();
    return this.exchangeToJwtToken(requestContext, accessToken, "urn:ietf:params:oauth:grant-type:saml-token");
  }

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken> {
    requestContext.enter();
    return this.exchangeToJwtToken(requestContext, accessToken, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  }

  /** Get a SAML token for the specified scope from a JWT token */
  public async getSamlFromJwt(requestContext: ClientRequestContext, jwt: AccessToken): Promise<AccessToken> {
    requestContext.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope: this._configuration.scope,
      assertion: jwt.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(requestContext);
    const tokenSet: TokenSet = await client.grant(params);

    const samlToken = AccessToken.fromSamlTokenString(tokenSet.access_token, IncludePrefix.No);
    if (!samlToken)
      throw new BentleyError(BentleyStatus.ERROR, `Could not convert jwt to accessToken`);
    return samlToken;
  }

}

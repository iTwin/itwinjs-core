/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { GrantParams, TokenSet } from "openid-client";
import { BentleyError, BentleyStatus, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, IncludePrefix, SamlAccessToken } from "@bentley/itwin-client";
import { BackendAuthorizationClient, BackendAuthorizationClientConfiguration } from "./BackendAuthorizationClient";

/**
 * Configuration for [[OidcDelegationClient]]
 * @deprecated Use [[DelegationAuthorizationClientConfiguration]] instead
 * @beta
 */
export type OidcDelegationClientConfiguration = DelegationAuthorizationClientConfiguration;

/**
 * Utility to generate delegation OAuth or legacy SAML tokens for backend applications
 * @beta
 * @deprecated Use [[DelegationAuthorizationClient]] instead
 */
export type OidcDelegationClient = DelegationAuthorizationClient;

/**
 * Configuration for [[DelegationAuthorizationClient]]
 * @beta
 */
export type DelegationAuthorizationClientConfiguration = BackendAuthorizationClientConfiguration;

/**
 * Utility to generate delegation OAuth or legacy SAML tokens for backend applications
 * @beta
 */
export class DelegationAuthorizationClient extends BackendAuthorizationClient {
  /** Creates an instance of BackendAuthorizationClient.
   */
  public constructor(configuration: DelegationAuthorizationClientConfiguration) {
    super(configuration);
  }

  private async exchangeToJwtToken(requestContext: ClientRequestContext, accessToken: AccessToken | SamlAccessToken, grantType: string): Promise<AccessToken> {
    requestContext.enter();

    const grantParams: GrantParams = {
      grant_type: grantType,
      scope: this._configuration.scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(requestContext);
    const tokenSet: TokenSet = await client.grant(grantParams);

    const exchangedToken = AccessToken.fromTokenResponseJson(tokenSet);
    const userInfo = accessToken.getUserInfo();
    if (userInfo !== undefined)
      accessToken.setUserInfo(userInfo);
    return exchangedToken;
  }

  /** Get a JWT for the specified scope from a SAML token */
  public async getJwtFromSaml(requestContext: ClientRequestContext, samlToken: SamlAccessToken): Promise<AccessToken> {
    requestContext.enter();
    return this.exchangeToJwtToken(requestContext, samlToken, "urn:ietf:params:oauth:grant-type:saml-token");
  }

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken> {
    requestContext.enter();
    return this.exchangeToJwtToken(requestContext, accessToken, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  }

  /** Get a SAML token for the specified scope from a JWT token */
  public async getSamlFromJwt(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<SamlAccessToken> {
    requestContext.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope: this._configuration.scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(requestContext);
    const tokenSet: TokenSet = await client.grant(params);

    const samlToken = SamlAccessToken.fromSamlTokenString(tokenSet.access_token, IncludePrefix.No);
    if (!samlToken)
      throw new BentleyError(BentleyStatus.ERROR, `Could not convert jwt to accessToken`);
    return samlToken;
  }

}

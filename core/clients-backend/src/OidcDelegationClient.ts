/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, IncludePrefix } from "@bentley/imodeljs-clients";
import { GrantParams, TokenSet } from "openid-client";
import { ActivityLoggingContext, BentleyStatus, BentleyError } from "@bentley/bentleyjs-core";
import { OidcBackendClientConfiguration, OidcBackendClient } from "./OidcBackendClient";

/** Utility to generate delegation OAuth or legacy SAML tokens for backend applications */
export class OidcDelegationClient extends OidcBackendClient {
  /**
   * Creates an instance of OidcBackendClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(configuration: OidcBackendClientConfiguration) {
    super(configuration);
  }

  /** Get a JWT for the specified scope from a SAML token */
  public async getJwtFromSaml(actx: ActivityLoggingContext, accessToken: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:saml-token";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };
    return this.exchangeToken(actx, params);
  }

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(actx: ActivityLoggingContext, jwt: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: jwt.toTokenString(IncludePrefix.No),
    };
    return this.exchangeToken(actx, params);
  }

  /** Get a SAML token for the specified scope from a JWT token */
  public async getSamlFromJwt(actx: ActivityLoggingContext, jwt: AccessToken, scope: string): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: jwt.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(params);

    const samlToken = AccessToken.fromSamlTokenString(tokenSet.access_token, IncludePrefix.No);
    if (!samlToken)
      throw new BentleyError(BentleyStatus.ERROR, `Could not convert jwt to accessToken`);
    return samlToken;
  }

}

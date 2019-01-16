/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, IncludePrefix } from "@bentley/imodeljs-clients";
import { GrantParams, TokenSet, UserInfo as OpenIdUserInfo } from "openid-client";
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

  private async exchangeToJwtToken(actx: ActivityLoggingContext, accessToken: AccessToken, grantType: string): Promise<AccessToken> {
    actx.enter();

    const scope = this._configuration.scope;
    if (!scope.includes("openid") || !scope.includes("email") || !scope.includes("profile") || !scope.includes("organization"))
      throw new BentleyError(BentleyStatus.ERROR, "Scopes when fetching a JWT token must include 'openid email profile organization'");

    const grantParams: GrantParams = {
      grant_type: grantType,
      scope,
      assertion: accessToken.toTokenString(IncludePrefix.No),
    };

    const client = await this.getClient(actx);
    const tokenSet: TokenSet = await client.grant(grantParams);
    const userInfo: OpenIdUserInfo = await client.userinfo(tokenSet.access_token);
    return this.createToken(tokenSet, userInfo);
  }

  /** Get a JWT for the specified scope from a SAML token */
  public async getJwtFromSaml(actx: ActivityLoggingContext, accessToken: AccessToken): Promise<AccessToken> {
    actx.enter();
    return this.exchangeToJwtToken(actx, accessToken, "urn:ietf:params:oauth:grant-type:saml-token");
  }

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(actx: ActivityLoggingContext, accessToken: AccessToken): Promise<AccessToken> {
    actx.enter();
    return this.exchangeToJwtToken(actx, accessToken, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  }

  /** Get a SAML token for the specified scope from a JWT token */
  public async getSamlFromJwt(actx: ActivityLoggingContext, jwt: AccessToken): Promise<AccessToken> {
    actx.enter();

    const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
    const params: GrantParams = {
      grant_type: grantType,
      scope: this._configuration.scope,
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

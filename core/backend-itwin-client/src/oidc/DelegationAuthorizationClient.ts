/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, IncludePrefix } from "@bentley/itwin-client";
import { GrantBody, TokenSet } from "openid-client";
import { BackendAuthorizationClient, BackendAuthorizationClientConfiguration } from "./BackendAuthorizationClient";

/**
 * Configuration for [[DelegationAuthorizationClient]]
 * @beta
 */
export type DelegationAuthorizationClientConfiguration = BackendAuthorizationClientConfiguration;

/**
 * Utility to generate delegation OAuth tokens for backend applications
 * @beta
 */
export class DelegationAuthorizationClient extends BackendAuthorizationClient {
  /** Creates an instance of BackendAuthorizationClient.
   */
  public constructor(configuration: DelegationAuthorizationClientConfiguration) {
    super(configuration);
  }

  private async exchangeToJwtToken(requestContext: ClientRequestContext, accessToken: AccessToken, grantType: string): Promise<AccessToken> {
    requestContext.enter();

    const grantParams: GrantBody = {
      grant_type: grantType, // eslint-disable-line @typescript-eslint/naming-convention
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

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(requestContext: ClientRequestContext, accessToken: AccessToken): Promise<AccessToken> {
    requestContext.enter();
    return this.exchangeToJwtToken(requestContext, accessToken, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  }

}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { AccessToken } from "@itwin/core-bentley";
import { removeAccessTokenPrefix } from "@bentley/itwin-client";
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

  private async exchangeToJwtToken(accessToken: AccessToken | undefined, grantType: string): Promise<AccessToken | undefined> {

    const grantParams: GrantBody = {
      grant_type: grantType, // eslint-disable-line @typescript-eslint/naming-convention
      scope: this._configuration.scope,
      assertion: removeAccessTokenPrefix(accessToken),
    };

    const client = await this.getClient();
    const tokenSet: TokenSet = await client.grant(grantParams);
    const accessTokenString = `Bearer ${tokenSet.access_token}`;
    return accessTokenString;
  }

  /** Get a delegation JWT for a new scope from another JWT */
  public async getJwtFromJwt(accessToken?: AccessToken): Promise<AccessToken | undefined> {
    return this.exchangeToJwtToken(accessToken, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  }

}

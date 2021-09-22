/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ImsAuthorizationClient, RequestGlobalOptions } from "@bentley/itwin-client";
import { ClientMetadata, custom, Issuer, Client as OpenIdClient } from "openid-client";

/**
 * Client configuration to create OIDC/OAuth tokens for backend applications
 * @beta
 */
export interface BackendAuthorizationClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  readonly clientId: string;
  /** Client application's secret key as registered with the Bentley IMS OIDC/OAuth2 provider. */
  readonly clientSecret: string;
  /** List of space separated scopes to request access to various resources. */
  readonly scope: string;
  /** The URL of the OIDC/OAuth2 provider. If left undefined, the iTwin Platform authority (`ims.bentley.com`) will be used by default. */
  readonly authority?: string;
}

/**
 * Utility to generate OIDC/OAuth tokens for backend applications
 * @beta
 */
export abstract class BackendAuthorizationClient extends ImsAuthorizationClient {
  protected _configuration: BackendAuthorizationClientConfiguration;

  /**
   * Creates an instance of BackendAuthorizationClient.
   */
  public constructor(configuration: BackendAuthorizationClientConfiguration) {
    super();

    custom.setHttpOptionsDefaults({
      timeout: RequestGlobalOptions.timeout.response,
      retry: RequestGlobalOptions.maxRetries,
      agent: {
        https: RequestGlobalOptions.httpsProxy,
      },
    });

    this._configuration = configuration;
  }

  private _issuer?: Issuer<OpenIdClient>;
  private async getIssuer(): Promise<Issuer<OpenIdClient>> {
    if (this._issuer)
      return this._issuer;

    const url = await this.getUrl();
    this._issuer = await Issuer.discover(url);
    return this._issuer;
  }

  /**
   * Discover the endpoints of the service
   */
  public async discoverEndpoints(): Promise<Issuer<OpenIdClient>> {
    return this.getIssuer();
  }

  private _client?: OpenIdClient;
  protected async getClient(): Promise<OpenIdClient> {
    if (this._client)
      return this._client;

    const clientConfiguration: ClientMetadata = {
      client_id: this._configuration.clientId, // eslint-disable-line @typescript-eslint/naming-convention
      client_secret: this._configuration.clientSecret, // eslint-disable-line @typescript-eslint/naming-convention
    };

    const issuer = await this.getIssuer();
    this._client = new issuer.Client(clientConfiguration);

    return this._client;
  }

}

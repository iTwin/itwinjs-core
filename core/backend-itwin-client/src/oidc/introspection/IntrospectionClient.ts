/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Introspection
 */

import { Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ImsAuthorizationClient, IncludePrefix } from "@bentley/itwin-client";
import { ClientMetadata, Issuer, Client as OpenIdClient, custom as OpenIdCustom } from "openid-client";
import { BackendITwinClientLoggerCategory } from "../../BackendITwinClientLoggerCategory";
import { IntrospectionResponse } from "./IntrospectionResponse";
import { IntrospectionResponseCache, MemoryIntrospectionResponseCache } from "./IntrospectionResponseCache";

/** @alpha */
export class IntrospectionClient {
  private _client?: OpenIdClient;

  /**
   * @param _clientId
   * @param _clientSecret
   * @param _issuerUrl The OAuth token issuer URL. Defaults to Bentley's auth URL if undefined.
   * @param _cache Optional means of caching previously introspected tokens. Defaults to an in-memory cache.
   */
  public constructor(
    protected readonly _clientId: string,
    protected readonly _clientSecret: string,
    protected _issuerUrl?: string,
    private readonly _cache: IntrospectionResponseCache = new MemoryIntrospectionResponseCache(),
  ) {
  }

  private async getClient(requestContext: AuthorizedClientRequestContext): Promise<OpenIdClient> {
    if (this._client) {
      return this._client;
    }

    // Due to issues with a timeout or failed request to the authorization service increasing the standard timeout and adding retries.
    // Docs for this option here, https://github.com/panva/node-openid-client/tree/master/docs#customizing-http-requests
    OpenIdCustom.setHttpOptionsDefaults({
      timeout: 10000,
      retry: 3,
    });

    const issuerUrl = await this.getIssuerUrl(requestContext);
    const issuer = await Issuer.discover(issuerUrl);

    const clientMetadata: ClientMetadata = {
      client_id: this._clientId, /* eslint-disable-line @typescript-eslint/naming-convention */
      client_secret: this._clientSecret, /* eslint-disable-line @typescript-eslint/naming-convention */
    };
    this._client = new issuer.Client(clientMetadata);
    return this._client;
  }

  protected async getIssuerUrl(requestContext: AuthorizedClientRequestContext): Promise<string> {
    if (this._issuerUrl) {
      return this._issuerUrl;
    }

    const imsAuthorizationClient = new ImsAuthorizationClient();
    this._issuerUrl = await imsAuthorizationClient.getUrl(requestContext);
    return this._issuerUrl;
  }

  public async introspect(requestContext: AuthorizedClientRequestContext): Promise<IntrospectionResponse> {
    const accessTokenStr = requestContext.accessToken.toTokenString(IncludePrefix.No);

    try {
      const cachedResponse = await this._cache.get(accessTokenStr);
      if (!!cachedResponse) {
        return cachedResponse;
      }
    } catch (err) {
      Logger.logInfo(BackendITwinClientLoggerCategory.Introspection, `introspection response not found in cache: ${accessTokenStr}`, () => err);
    }

    let client: OpenIdClient;
    try {
      client = await this.getClient(requestContext);
    } catch (err) {
      Logger.logError(BackendITwinClientLoggerCategory.Introspection, `Unable to create oauth client`, () => err);
      throw err;
    }

    let introspectionResponse: IntrospectionResponse;
    try {
      introspectionResponse = await client.introspect(accessTokenStr) as IntrospectionResponse;
    } catch (err) {
      Logger.logError(BackendITwinClientLoggerCategory.Introspection, `Unable to introspect client token`, () => err);
      throw err;
    }

    this._cache.add(accessTokenStr, introspectionResponse); // eslint-disable-line @typescript-eslint/no-floating-promises

    return introspectionResponse;
  }
}

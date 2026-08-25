/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { HttpResponseError, RequestBasicCredentials } from "../../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../../request/utils";
import {
  accessClientRedirect, applyAccessClientToRequest, isAccessClientAuthFailure, MapLayerAccessClient, MapLayerAuthenticationFailedError, MapLayerUntrustedOriginError,
} from "../../../tile/internal";

/** @packageDocumentation
 * @module Tiles
 */

/** Options for a capabilities/XML request that an access client may authenticate.
 * @internal
 */
export interface WmsFetchOptions {
  credentials?: RequestBasicCredentials;
  /** The format's registered access client, given control over the outgoing request. */
  accessClient?: MapLayerAccessClient;
  /** The map-layer source URL identifying the layer to the access client. Defaults to the request URL,
   * which callers should avoid: capabilities request URLs differ from the layer's. */
  layerUrl?: string;
}

/** Options for [[WmsCapabilities.create]] and [[WmtsCapabilities.create]].
 * @internal
 */
export interface WmsCapabilitiesCreateOptions extends WmsFetchOptions {
  ignoreCache?: boolean;
  /** Custom query parameters appended to the GetCapabilities request. */
  queryParams?: { [key: string]: string };
}

/** @internal */
export class WmsUtilities {
  public static getBaseUrl(url: string): string {
    const lastIndex = url.lastIndexOf("?");
    return lastIndex > 0 ? url.slice(0, lastIndex) : url;
  }

  /**
 * fetch XML from HTTP request
 * @param url server URL to address the request
 */
  public static async fetchXml(url: string, options?: WmsFetchOptions): Promise<string> {
    const { credentials, accessClient, layerUrl } = options ?? {};

    let headers: Headers|undefined;
    if (credentials && credentials.user && credentials.password) {
      // Basic credentials are considered settings-derived credentials for this source. When the registry is
      // enforcing trusted origins, the source URL itself is the only implicitly trusted origin for basic auth;
      // opaque/custom-protocol URLs have no network origin and must therefore be treated as untrusted.
      const allowBasicAuth = !IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins
        || IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(url, url);
      if (allowBasicAuth) {
        headers = new Headers();
        setBasicAuthorization(headers, credentials);
      }
    }

    // Give the format's access client full control over the outgoing request (e.g. an Authorization header).
    let requestUrl = url;
    let clientAuthApplied = false;
    const context = { mapLayerUrl: new URL(layerUrl ?? url), userName: credentials?.user, password: credentials?.password };
    if (accessClient?.applyToRequest) {
      const urlObj = new URL(url);
      headers = headers ?? new Headers();
      clientAuthApplied = await applyAccessClientToRequest(urlObj, headers, context, accessClient);
      requestUrl = urlObj.toString();
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      // Client-shaped requests carry secrets too, so they get the same redirect policy as credentialed ones.
      redirect: clientAuthApplied ? accessClientRedirect() : undefined,
    });

    // The shaping client is the authority on what a failed authentication looks like; classify before the
    // generic non-200 handling so callers can transition to RequireAuth rather than a generic failure.
    if (clientAuthApplied) {
      if (await isAccessClientAuthFailure(response, context, accessClient))
        throw new MapLayerAuthenticationFailedError(requestUrl);

      if (response.status !== 200)
        throw new HttpResponseError(response.status, await response.text());
      return response.text();
    }

    return WmsUtilities.handleUnshapedResponse(response, requestUrl, credentials, headers);
  }

  /** Legacy (no access client) response handling: basic-auth/untrusted-origin classification and the SSO retry. */
  private static async handleUnshapedResponse(firstResponse: Response, url: string, credentials?: RequestBasicCredentials, headers?: Headers): Promise<string> {
    let response = firstResponse;
    if (!headers && credentials && credentials.user && credentials.password && (response.status === 401 || response.status === 403)) {
      throw new MapLayerUntrustedOriginError(url);
    }
    if (!credentials && response.status === 401 && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])) {
      // fetch follows redirects transparently, so trust decisions target the final (post-redirect) URL.
      const challengedUrl = response.url || url;
      if (!IModelApp.mapLayerFormatRegistry.isSsoAllowed(challengedUrl))
        throw new MapLayerUntrustedOriginError(challengedUrl);

      IModelApp.mapLayerFormatRegistry.logUntrustedOriginUse(challengedUrl);

      // We got a http 401 challenge, lets try SSO (i.e. Windows Authentication).
      response = await fetch(challengedUrl, {
        method: "GET",
        credentials: "include",
        redirect: IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined,
      });
    }

    if (response.status !== 200)
      throw new HttpResponseError(response.status, await response.text());
    return response.text();
  }
}

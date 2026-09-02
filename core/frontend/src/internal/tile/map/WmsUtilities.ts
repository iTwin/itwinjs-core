/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { HttpResponseError, RequestBasicCredentials } from "../../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../../request/utils";
import {
  isMapLayerAuthFailure, MapLayerAuthenticationFailedError, MapLayerUntrustedOriginError, shapedRequestRedirect, shapeMapLayerRequest,
} from "../../../tile/internal";

/** @packageDocumentation
 * @module Tiles
 */

/** Options for a capabilities/XML request that registered map-layer request listeners may shape.
 * @internal
 */
export interface WmsFetchOptions {
  credentials?: RequestBasicCredentials;
  /** The id of the map-layer format the request is made for, identifying it to the request/response listeners. */
  formatId?: string;
  /** The map-layer source URL identifying the layer to the listeners. Defaults to the request URL,
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
    const { credentials, formatId, layerUrl } = options ?? {};

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

    // Give registered request listeners full control over the outgoing request (e.g. an Authorization header).
    let requestUrl = url;
    let containsCredentials = false;
    const context = { mapLayerUrl: new URL(layerUrl ?? url), userName: credentials?.user, password: credentials?.password };
    if (IModelApp.mapLayerFormatRegistry?.hasMapLayerRequestListeners) {
      const urlObj = new URL(url);
      headers = headers ?? new Headers();
      containsCredentials = await shapeMapLayerRequest(urlObj, headers, formatId ?? "", context);
      requestUrl = urlObj.toString();
    }

    let response = await fetch(requestUrl, {
      method: "GET",
      headers,
      // Requests carrying listener-injected secrets get the same redirect policy as credentialed ones.
      redirect: containsCredentials ? shapedRequestRedirect() : undefined,
    });

    // A request carrying listener-injected credentials never falls back to the legacy basic-auth /
    // NTLM-SSO handling: the injecting listener is the authentication authority for it.
    if (!containsCredentials)
      response = await WmsUtilities.handleLegacyChallenges(response, requestUrl, credentials, headers);

    // Classify the final (post-retry) response before the generic non-200 handling so callers can
    // transition to RequireAuth rather than a generic failure.
    if (await isMapLayerAuthFailure(response, formatId ?? "", context, containsCredentials))
      throw new MapLayerAuthenticationFailedError(requestUrl);

    if (response.status !== 200)
      throw new HttpResponseError(response.status, await response.text());
    return response.text();
  }

  /** Legacy (no injected credentials) challenge handling: basic-auth/untrusted-origin classification and the SSO retry. */
  private static async handleLegacyChallenges(firstResponse: Response, url: string, credentials?: RequestBasicCredentials, headers?: Headers): Promise<Response> {
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

    return response;
  }
}

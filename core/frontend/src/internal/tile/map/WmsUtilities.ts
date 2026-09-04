/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { HttpResponseError, RequestBasicCredentials } from "../../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../../request/utils";
import {
  credentialedFetchRedirect, fetchMapLayerRequest, MapLayerUntrustedOriginError,
} from "../../../tile/internal";

/** @packageDocumentation
 * @module Tiles
 */

/** Options for a capabilities/XML request routed through the registered [[MapLayerFetchHandler]]s, if any.
 * @internal
 */
export interface WmsFetchOptions {
  credentials?: RequestBasicCredentials;
  /** The id of the map-layer format the request is made for, passed to the handler as [[MapLayerRequest.formatId]]. */
  formatId?: string;
  /** The map-layer source URL, passed to the handler as [[MapLayerRequest.layerUrl]]. Defaults to the request URL,
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
    const hasCredentials = !!(credentials && credentials.user && credentials.password);
    if (hasCredentials) {
      // Basic credentials are considered settings-derived credentials for this source. When the registry is
      // enforcing trusted origins, the source URL itself is the only implicitly trusted origin for basic auth;
      // opaque/custom-protocol URLs have no network origin and must therefore be treated as untrusted.
      // Optional chaining: some callers run before IModelApp startup.
      const allowBasicAuth = !IModelApp.mapLayerFormatRegistry?.restrictCredentialsToTrustedOrigins
        || IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(url, url);
      if (allowBasicAuth) {
        headers = new Headers();
        setBasicAuthorization(headers, credentials);
      }
    }
    const credentialsWithheld = hasCredentials && headers === undefined;

    // Route the request through the registered fetch handler (if any). Handler failures — including
    // MapLayerAuthenticationFailedError — propagate so callers can transition to RequireAuth.
    const { response, managedByHandler } = await fetchMapLayerRequest({
      url,
      formatId: formatId ?? "",
      layerUrl: layerUrl ?? url,
      headers,
      send: async (request, credentialed) => {
        const rsp = await fetch(request.url, {
          method: "GET",
          headers: request.headers,
          // Sends the handler modified may carry injected secrets: same redirect policy as credentialed ones.
          redirect: credentialed ? credentialedFetchRedirect() : undefined,
        });

        // A send the handler modified never falls back to the legacy basic-auth / NTLM-SSO handling:
        // the handler is the authentication authority for it.
        return credentialed ? rsp : WmsUtilities.handleLegacyChallenges(rsp, request.url, credentials, credentialsWithheld);
      },
    });

    if (response.status !== 200) {
      // A status in a response managed by the fetch handler is not an authentication failure (it would have
      // thrown MapLayerAuthenticationFailedError): report it without a status so callers do not classify it.
      if (managedByHandler)
        throw new Error(`Map-layer fetch handler returned status ${response.status} for '${url}'`);
      throw new HttpResponseError(response.status, await response.text());
    }
    return response.text();
  }

  /** Legacy (no injected credentials) challenge handling: basic-auth/untrusted-origin classification and the SSO retry.
   * `credentialsWithheld` is true when basic credentials exist but were not attached because the origin is untrusted.
   */
  private static async handleLegacyChallenges(firstResponse: Response, url: string, credentials: RequestBasicCredentials | undefined, credentialsWithheld: boolean): Promise<Response> {
    let response = firstResponse;
    if (credentialsWithheld && (response.status === 401 || response.status === 403)) {
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

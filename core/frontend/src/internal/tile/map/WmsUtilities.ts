/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { HttpResponseError, RequestBasicCredentials } from "../../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../../request/utils";
import {
  credentialedRequestRedirect, fetchMapLayerRequest, MapLayerSendArgs, MapLayerUntrustedOriginError,
} from "../../../tile/internal";

/** @packageDocumentation
 * @module Tiles
 */

/** Options for a capabilities/XML request that registered map-layer request listeners may customize.
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

    // Route the request through the registered fetch handler (if any). Handler failures — including
    // MapLayerAuthenticationFailedError — propagate so callers can transition to RequireAuth.
    let urlObj: URL | undefined;
    if (undefined !== IModelApp.mapLayerFormatRegistry?.mapLayerFetchHandler) {
      urlObj = new URL(url);
      headers = headers ?? new Headers();
    }

    const send = async (sendArgs: MapLayerSendArgs): Promise<Response> => {
      const rsp = await fetch(sendArgs.url, {
        method: "GET",
        headers: sendArgs.headers,
        // Sends declared as carrying handler-injected secrets get the same redirect policy as credentialed ones.
        redirect: sendArgs.credentialed ? credentialedRequestRedirect() : undefined,
      });

      // A send issued through a fetch handler never falls back to the legacy basic-auth / NTLM-SSO
      // handling: the handler is the authentication authority for it.
      return sendArgs.credentialed ? rsp : WmsUtilities.handleLegacyChallenges(rsp, sendArgs.url, credentials, sendArgs.headers);
    };

    const response = urlObj
      ? await fetchMapLayerRequest({ url: urlObj, formatId: formatId ?? "", layerUrl: layerUrl ?? url, baseHeaders: headers, send })
      : await send({ credentialed: false, headers, url });

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

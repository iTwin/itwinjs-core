/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { HttpResponseError, RequestBasicCredentials } from "../../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../../request/utils";
import { MapLayerUntrustedOriginError } from "../../../tile/internal";

/** @packageDocumentation
 * @module Tiles
 */

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
  public static async fetchXml(url: string, credentials?: RequestBasicCredentials): Promise<string> {

    let headers: Headers|undefined;
    if (credentials && credentials.user && credentials.password) {
      headers = new Headers();
      setBasicAuthorization(headers, credentials);
    }

    let response = await fetch(url, { method: "GET", headers });
    if (!credentials && response.status === 401 && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])) {
      // fetch follows redirects transparently, so trust decisions target the final (post-redirect) URL.
      const challengedUrl = response.url || url;
      if (!IModelApp.mapLayerFormatRegistry.isSsoAllowed(challengedUrl))
        throw new MapLayerUntrustedOriginError(challengedUrl);

      IModelApp.mapLayerFormatRegistry.logUntrustedOriginUse(challengedUrl);

      // We got a http 401 challenge, lets try SSO (i.e. Windows Authentication).
      response = await fetch(challengedUrl, { method: "GET", credentials: "include", redirect: "error" });
    }

    if (response.status !== 200)
      throw new HttpResponseError(response.status, await response.text());
    return response.text();
  }
}

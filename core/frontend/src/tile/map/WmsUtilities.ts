/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { HttpResponseError, RequestBasicCredentials } from "../../request/Request";
import { headersIncludeAuthMethod, setBasicAuthorization } from "../../request/utils";

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
 * @internal
 */
  public static async fetchXml(url: string, credentials?: RequestBasicCredentials): Promise<string> {

    let headers: Headers|undefined;
    if (credentials && credentials.user && credentials.password) {
      headers = new Headers();
      setBasicAuthorization(headers, credentials);
    }

    let response = await fetch(url, { method: "GET", headers });
    if (!credentials && response.status === 401 && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])) {
    // We got a http 401 challenge, lets try SSO (i.e. Windows Authentication)
      response = await fetch(url, { method: "GET", credentials: "include" });
    }

    if (response.status !== 200)
      throw new HttpResponseError(response.status, await response.text());
    return response.text();
  }
}

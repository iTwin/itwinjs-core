/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString } from "@itwin/core-common";
import { RequestBasicCredentials } from "./Request";

/**
 * Check whether or not one of the requested authentication method is listed in the HTTP 'WWW-Authenticate' response header
 * @param headers Headers object
 * @param query List of authentication method to lookup (case-insensitive)
 * @note For CORS requests, the 'Access-Control-Expose-Headers' header from the server must make the 'WWW-Authenticate' available to the browser, otherwise this won't work.
 * @internal
 */
export function headersIncludeAuthMethod(headers: Headers, query: string[]): boolean {
  const wwwAuthenticate = headers.get("WWW-authenticate");
  const lowerCaseQuery = query.map(((value)=>value.toLowerCase()));     // not case-sensitive
  if (wwwAuthenticate !== null) {
    const authMethods = wwwAuthenticate.split(",").map(((value)=>value.toLowerCase().trim()));
    for (const queryValue of lowerCaseQuery) {
      if (authMethods.includes(queryValue))
        return true;
    }
  }
  return false;
}

/**
 * Set the value of the 'Authorization' header with Basic authentication value
 * scheme: 'Authorization: Basic <credentials>'
 * @internal
 */
export function setBasicAuthorization(headers: Headers, credentials: RequestBasicCredentials): void;
/** @internal */
export function setBasicAuthorization(headers: Headers, user: string, password: string): void;
/** @internal */
export function setBasicAuthorization(headers: Headers, userOrCreds: string|RequestBasicCredentials, password?: string): void {
  let username: string|undefined;
  let pwd: string|undefined;
  if (typeof userOrCreds === "string") {
    username = userOrCreds;
    pwd  = password;
  } else {
    username = userOrCreds.user;
    pwd  = userOrCreds.password;
  }

  if (username !== undefined && pwd !== undefined)
    headers.set("Authorization", `Basic ${Base64EncodedString.encode(`${username}:${pwd}`)}`);
}

/**
 * Set number of milliseconds a request can take before automatically being terminated
 * @internal
 */
export function setRequestTimeout(opts: RequestInit, ms: number, abortController?: AbortController ): void {
  const controller = abortController ?? new AbortController();
  setTimeout(() => controller.abort(), ms);
  opts.signal = controller.signal;
}


/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString } from "@itwin/core-common";
import { RequestBasicCredentials } from "./Request";

/**
 * Check whether or not one of the requested authentication method is listed in the HTTP 'WWW-Authenticate' response header
 * @param headers Headers object
 * @param query List of authentication method to lookup
 * @note For CORS requests, the 'Access-Control-Expose-Headers' header from the server must make the 'WWW-Authenticate' available to the browser, otherwise this won't work.
 * @internal
 */
export function headersIncludeAuthMethod(headers: Headers, query: string[]): boolean {
  const headersArray = Array.from(headers);
  const foundAuth = headersArray.filter((pair)=> pair[0].toLowerCase() === "www-authenticate");
  if (foundAuth.length > 0) {
    const authMethods = foundAuth.map((pair)=>pair[1].toLowerCase().split(",").map(((value)=>value.trim()))).flat();
    for (const queryValue of query) {
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


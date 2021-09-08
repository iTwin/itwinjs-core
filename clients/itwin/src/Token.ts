/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

/**
 * Function to remove any prefix from an access token string.
 * @param accessToken Access token string
 * @internal
 */
export function removeAccessTokenPrefix(accessToken: AccessToken | undefined): AccessToken | undefined {
  return accessToken ? accessToken.substr(accessToken.indexOf(" ") + 1) : undefined;
}

/**
 * Class solely to hold the dictionary of mappings from token prefix (string) to the token's constructor
 * @internal
 */
class TokenPrefixToTypeContainer {
  public static tokenPrefixToConstructorDict: { [key: string]: any } = {};
}

export type AccessToken = string;

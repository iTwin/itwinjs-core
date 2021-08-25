/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

/**
 * Option to specify if the prefix identifying the token is included when serializing the access token.
 * * JWTs (Jason Web Tokens) are identified with a "Bearer" prefix.
 * * Typically the prefix is required for calls made across the wire.
 * @beta
 */
export enum IncludePrefix {
  Yes = 0,
  No = 1,
}

/**
 * When TokenPrefix is used as a decorator for a class, this function gets access to that class's constructor. That class's constructor is stored
 * in a dictionary that maps token prefix to constructor.
 * @param prefix Prefix of the Token
 * @internal
 */
export function TokenPrefix(prefix: string) { // eslint-disable-line @typescript-eslint/naming-convention
  return (constructor: any) => {
    TokenPrefixToTypeContainer.tokenPrefixToConstructorDict[prefix] = constructor;
  };
}

/**
 * Class solely to hold the dictionary of mappings from token prefix (string) to the token's constructor
 * @internal
 */
class TokenPrefixToTypeContainer {
  public static tokenPrefixToConstructorDict: { [key: string]: any } = {};
}

/** Properties for transmitting AccessTokens between processes
 * @beta
 */
export interface AccessTokenProps {
  tokenString: string;
  startsAt?: string;
  expiresAt?: string;
}

export type AccessTokenString = string | undefined;

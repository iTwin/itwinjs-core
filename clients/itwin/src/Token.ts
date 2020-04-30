/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */
import { Logger, AuthStatus, BentleyError } from "@bentley/bentleyjs-core";
import { UserInfo } from "./UserInfo";
import { ITwinClientLoggerCategory } from "./ITwinClientLoggerCategory";

const loggerCategory = ITwinClientLoggerCategory.Authorization;

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

/** Token issued by DelegationSecureTokenService for API access
 * @beta
 */
export class AccessToken {
  private static _jwtTokenPrefix = "Bearer";

  private _jwt: string;
  private _userInfo?: UserInfo;
  private _startsAt?: Date;
  private _expiresAt?: Date;

  /** Create a new AccessToken given a JWT (Jason Web Token) */
  public constructor(jwt: string, startsAt?: Date, expiresAt?: Date, userInfo?: UserInfo) {
    this._jwt = jwt;
    this._startsAt = startsAt;
    this._expiresAt = expiresAt;
    this._userInfo = userInfo;
  }

  /** @internal */
  public getUserInfo(): UserInfo | undefined {
    return this._userInfo;
  }

  /** @internal */
  public setUserInfo(userInfo: UserInfo) {
    this._userInfo = userInfo;
  }

  /** @internal */
  public getExpiresAt(): Date | undefined {
    return this._expiresAt;
  }

  /** @internal */
  public getStartsAt(): Date | undefined {
    return this._startsAt;
  }

  /**
   * Convert this AccessToken to a string that can be passed across the wire
   * @param includePrefix Include the token prefix to identify the type of token - "Bearer" for JSON Web Tokens (JWTs)
   * @beta
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    return (includePrefix === IncludePrefix.Yes) ? AccessToken._jwtTokenPrefix + " " + this._jwt : this._jwt;
  }

  /**
   * Create an AccessToken from a string that's typically passed across the wire
   * - The AccessToken will not include the user information or expiry information
   * - The token must include the "Bearer" prefix that identifies JSON Web Tokens (JWTs)
   * - The token is NOT validated in any way other than the basic prefix check described above
   * @param tokenStr String representation of the token
   * @throws [[BentleyError]] If the token does not have the required prefix
   * @beta
   */
  public static fromTokenString(tokenStr: string): AccessToken {
    if (!tokenStr.startsWith(AccessToken._jwtTokenPrefix)) {
      throw new BentleyError(AuthStatus.Error, "Invalid access token", Logger.logError, loggerCategory, () => ({ tokenStr }));
    }
    const jwt = tokenStr.substr(AccessToken._jwtTokenPrefix.length + 1);
    return new AccessToken(jwt);
  }

  /**
   * Creates a strongly typed AccessToken object from an untyped JSON with the same properties as [[AccessToken]]
   * @param jsonObj
   * @throws [BentleyError]($bentley) if the supplied tokenResponse is undefined, or does not contain an "access_token" field
   * @beta
   */
  public static fromJson(jsonObj: any): AccessToken {
    if (!jsonObj || !jsonObj._jwt) {
      throw new BentleyError(AuthStatus.Error, "Expected JSON representing the token to contain the _jwt field", Logger.logError, loggerCategory, () => jsonObj);
    }
    const jwt = jsonObj._jwt;
    const startsAt = jsonObj._startsAt !== undefined ? new Date(jsonObj._startsAt) : undefined;
    const expiresAt = jsonObj._expiresAt !== undefined ? new Date(jsonObj._expiresAt) : undefined;
    const userInfo = UserInfo.fromJson(jsonObj._userInfo);

    const token = new AccessToken(jwt, startsAt, expiresAt, userInfo);
    return token;
  }

  /**
   * Creates AccessToken from the typical token responses obtained from Authorization servers
   * - The fields from the token response to different names in AccessToken to keep with naming guidelines
   * - Only basic validation is done - the input tokenResponse must be defined, and have an "access_token" field in it
   * @param tokenResponse Response containing the token string as obtained from the authorization server
   * @param userProfileResponse Response containing the user profile information as obtained from the authorization server
   * @returns Strongly typed AccessToken
   * @see [[AccessToken.fromJson]] for use cases that involve serialization/deserialization of AccessToken
   * @throws [BentleyError]($bentley) if the supplied tokenResponse does not contain an "access_token" field
   * @internal
   */
  public static fromTokenResponseJson(tokenResponse: any, userProfileResponse?: any): AccessToken {
    if (!tokenResponse || !tokenResponse.access_token)
      throw new BentleyError(AuthStatus.Error, "Expected tokenResponse to contain access_token field", Logger.logError, loggerCategory, () => tokenResponse);

    const startsAt = new Date((tokenResponse.expires_at - tokenResponse.expires_in) * 1000);
    const expiresAt = new Date(tokenResponse.expires_at * 1000);
    const userInfo = userProfileResponse ? UserInfo.fromTokenResponseJson(userProfileResponse) : undefined;

    const token = new AccessToken(tokenResponse.access_token);
    token._startsAt = startsAt;
    token._expiresAt = expiresAt;
    token._userInfo = userInfo;
    return token;
  }
}

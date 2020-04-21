/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */
import { Base64 } from "js-base64";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { UserInfo } from "./UserInfo";

/** @internal */
export enum IncludePrefix {
  Yes = 0,
  No = 1,
}

/** Token issued by DelegationSecureTokenService for API access
 * @beta
 */
export class AccessToken {
  private static _jwtTokenPrefix = "Bearer";

  protected _jwt?: string;
  protected _userInfo?: UserInfo;
  protected _startsAt?: Date;
  protected _expiresAt?: Date;

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
   * @internal
   */
  public static foreignProjectAccessTokenJsonProperty = "ForeignProjectAccessToken";
  private _foreignJwt?: string;

  /** Sets up a new AccessToken based on some generic token abstraction used for iModelBank use cases
   * @internal
   */
  public static fromForeignProjectAccessTokenJson(foreignJsonStr: string): AccessToken | undefined {
    if (!foreignJsonStr.startsWith(`{\"${this.foreignProjectAccessTokenJsonProperty}\":`))
      return undefined;
    const props: any = JSON.parse(foreignJsonStr);
    if (props[this.foreignProjectAccessTokenJsonProperty] === undefined)
      return undefined;
    const tok = new AccessToken();
    tok._foreignJwt = foreignJsonStr;
    tok._userInfo = props[this.foreignProjectAccessTokenJsonProperty].userInfo;
    return tok;
  }

  /** Create an AccessToken from a JWT token for OIDC workflows
   * Does NOT validate the token.
   * @internal
   */
  public static fromJsonWebTokenString(jwt: string, startsAt?: Date, expiresAt?: Date, userInfo?: UserInfo): AccessToken {
    const token = new AccessToken();
    token._jwt = jwt;
    token._startsAt = startsAt;
    token._expiresAt = expiresAt;
    token._userInfo = userInfo;
    return token;
  }

  /**
   * Convert this AccessToken to a string
   * @param includePrefix Include the token prefix to identify JWT or SAML tokens
   * @internal
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    if (this._jwt)
      return (includePrefix === IncludePrefix.Yes) ? AccessToken._jwtTokenPrefix + " " + this._jwt : this._jwt;

    if (this._foreignJwt) {
      return Base64.encode(this._foreignJwt); // TODO: migrate iModelBank to support Oidc tokens (_jwt)
    }

    throw new BentleyError(BentleyStatus.ERROR, "Cannot convert invalid access token to string");
  }

  /**
   * Create an AccessToken from a string. The token must include the prefix to differentiate between JWT and SAML.
   * @param tokenStr String representation of the token
   * @internal
   */
  public static fromTokenString(tokenStr: string): AccessToken {
    if (tokenStr.startsWith(AccessToken._jwtTokenPrefix)) {
      const jwtString = tokenStr.substr(AccessToken._jwtTokenPrefix.length + 1);
      return AccessToken.fromJsonWebTokenString(jwtString);
    }

    if (tokenStr.startsWith(`{\"${AccessToken.foreignProjectAccessTokenJsonProperty}\":`)) {
      const accessToken = AccessToken.fromForeignProjectAccessTokenJson(tokenStr);
      if (!accessToken)
        throw new BentleyError(BentleyStatus.ERROR, "Invalid access token");
    }

    throw new BentleyError(BentleyStatus.ERROR, "Invalid access token");
  }

  /**
   * Creates an AccessToken from an untyped JSON object
   * @param jsonObj
   * @internal
   */
  public static fromJson(jsonObj: any): AccessToken | undefined {
    if (jsonObj._jwt) {
      const jwt = jsonObj._jwt;
      const startsAt = jsonObj._startsAt !== undefined ? new Date(jsonObj._startsAt) : undefined;
      const expiresAt = jsonObj._expiresAt !== undefined ? new Date(jsonObj._expiresAt) : undefined;
      const userInfo = UserInfo.fromJson(jsonObj._userInfo);
      return AccessToken.fromJsonWebTokenString(jwt, startsAt, expiresAt, userInfo);
    }

    if (jsonObj._foreignJwt) {
      const foreignTok = AccessToken.fromForeignProjectAccessTokenJson(jsonObj._foreignJwt);
      if (foreignTok !== undefined)
        return foreignTok;
    }

    return undefined;
  }
}

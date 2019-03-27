/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import * as xpath from "xpath";
import { DOMParser } from "xmldom";
import { UserInfo } from "./UserInfo";
import { Base64 } from "js-base64";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";

export enum IncludePrefix {
  Yes = 0,
  No = 1,
}

/** Base class for JWT and SAML tokens
 * @beta
 */
export abstract class Token {
  protected _samlAssertion?: string;
  protected _saml?: string;
  protected _jwt?: string;

  protected _userInfo?: UserInfo;
  protected _startsAt?: Date;
  protected _expiresAt?: Date;
  protected _x509Certificate?: string;

  protected constructor() {
  }

  protected getSaml(): string | undefined {
    if (this._saml)
      return this._saml;
    if (!this._samlAssertion)
      return undefined;
    this._saml = Base64.encode(this._samlAssertion);
    return this._saml;
  }

  public getSamlAssertion(): string | undefined {
    if (this._samlAssertion)
      return this._samlAssertion;
    if (!this._saml)
      return undefined;
    this._samlAssertion = Base64.decode(this._saml);
    return this._samlAssertion;
  }

  public getUserInfo(): UserInfo | undefined {
    if (this._userInfo || this._jwt)
      return this._userInfo;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._userInfo;
  }

  public setUserInfo(userInfo: UserInfo) {
    this._userInfo = userInfo;
  }

  public getExpiresAt(): Date | undefined {
    if (this._expiresAt || this._jwt)
      return this._expiresAt;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._expiresAt;
  }

  public getStartsAt(): Date | undefined {
    if (this._startsAt || this._jwt)
      return this._startsAt;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._startsAt;
  }

  protected parseSamlAssertion(): boolean {
    this._samlAssertion = this.getSamlAssertion();
    if (!this._samlAssertion)
      return false;

    const select: xpath.XPathSelect = xpath.useNamespaces({
      ds: "http://www.w3.org/2000/09/xmldsig#",
      saml: "urn:oasis:names:tc:SAML:1.0:assertion",
    });
    const dom: Document = (new DOMParser()).parseFromString(this._samlAssertion);

    this._x509Certificate = select("/saml:Assertion/ds:Signature/ds:KeyInfo/ds:X509Data/ds:X509Certificate/text()", dom).toString();

    const startsAtStr: string = select("string(/saml:Assertion/saml:Conditions/@NotBefore)", dom).toString();
    this._startsAt = new Date(startsAtStr);

    const expiresAtStr: string = select("string(/saml:Assertion/saml:Conditions/@NotOnOrAfter)", dom).toString();

    const extractAttribute: (attributeName: string) => string = (attributeName: string) =>
      select("/saml:Assertion/saml:AttributeStatement/saml:Attribute[@AttributeName='" +
        attributeName + "']/saml:AttributeValue/text()", dom).toString();

    const id = extractAttribute("userid");
    const email = {
      id: extractAttribute("emailaddress"),
    };
    const profile = {
      name: extractAttribute("name"),
      firstName: extractAttribute("givenname"),
      lastName: extractAttribute("surname"),
    };
    const organization = {
      id: extractAttribute("organizationid"),
      name: extractAttribute("organization"),
    };
    const featureTracking = {
      ultimateSite: extractAttribute("ultimatesite"),
      usageCountryIso: extractAttribute("usagecountryiso"),
    };

    this._userInfo = new UserInfo(id, email, profile, organization, featureTracking);
    this._startsAt = new Date(startsAtStr);
    this._expiresAt = new Date(expiresAtStr);

    return !!this._x509Certificate && !!this._startsAt && !!this._expiresAt;
  }
}

/** Token issued by Active Secure Token Service or Federated Authentication Service for user authentication/authorization
 * @beta
 */
export class AuthorizationToken extends Token {

  /** Sets up a new AuthorizationToken based on the SAML that was passed in.
   * Does NOT validate the resulting token.
   */
  public static fromSamlAssertion(samlAssertion: string): AuthorizationToken {
    const token = new AuthorizationToken();
    token._samlAssertion = samlAssertion;
    return token;
  }

  /** Creates a string representation of the contained token */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    if (!this.parseSamlAssertion() || !this._x509Certificate)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid access token");

    const prefix = (includePrefix === IncludePrefix.Yes) ? "X509 access_token=" : "";
    return prefix + Buffer.from(this._x509Certificate, "utf8").toString("base64");
  }
}

/** Token issued by DelegationSecureTokenService for API access
 * @beta
 */
export class AccessToken extends Token {
  private static _samlTokenPrefix = "Token";
  private static _jwtTokenPrefix = "Bearer";
  public static foreignProjectAccessTokenJsonProperty = "ForeignProjectAccessToken";
  private _foreignJwt?: string;

  /** Returns true if it's a Jason Web Token, and false if it's a SAML token */
  public get isJwt(): boolean {
    return !!this._jwt;
  }

  /** Sets up a new AccessToken based on the SAML that was passed in.
   * Does NOT validate the resulting token.
   * @beta
   */
  public static fromSamlAssertion(samlAssertion: string): AccessToken {
    const token = new AccessToken();
    token._samlAssertion = samlAssertion;
    return token;
  }

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

  /** Create an AccessToken from a SAML string for Windows Federated Authentication workflows.
   * Does NOT validate the token.
   */
  public static fromSamlTokenString(accessTokenStr: string, includesPrefix: IncludePrefix = IncludePrefix.Yes): AccessToken {
    let saml = accessTokenStr;
    if (includesPrefix === IncludePrefix.Yes) {
      const prefixLength = AccessToken._samlTokenPrefix.length;
      if (accessTokenStr.substr(0, prefixLength).toLowerCase() !== AccessToken._samlTokenPrefix.toLowerCase())
        throw new BentleyError(BentleyStatus.ERROR, "Invalid saml token");
      saml = accessTokenStr.slice(6);
      if (!saml)
        throw new BentleyError(BentleyStatus.ERROR, "Invalid saml token");
    }
    const token = new AccessToken();
    token._saml = saml;
    return token;
  }

  /** Create an AccessToken from a JWT token for OIDC workflows
   * Does NOT validate the token.
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
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    if (this._jwt)
      return (includePrefix === IncludePrefix.Yes) ? AccessToken._jwtTokenPrefix + " " + this._jwt : this._jwt;

    const saml = this.getSaml();
    if (saml)
      return (includePrefix === IncludePrefix.Yes) ? AccessToken._samlTokenPrefix + " " + saml : saml;

    if (this._foreignJwt)
      return this._foreignJwt;

    throw new BentleyError(BentleyStatus.ERROR, "Cannot convert invalid access token to string");
  }

  /**
   * Create an AccessToken from a string. The token must include the prefix to differentiate between JWT and SAML.
   * @param tokenStr String representation of the token
   */
  public static fromTokenString(tokenStr: string): AccessToken {
    if (tokenStr.startsWith(AccessToken._jwtTokenPrefix)) {
      const jwtString = tokenStr.substr(AccessToken._jwtTokenPrefix.length + 1);
      return AccessToken.fromJsonWebTokenString(jwtString);
    }

    if (tokenStr.startsWith(AccessToken._samlTokenPrefix)) {
      tokenStr.substr(AccessToken._samlTokenPrefix.length + 1);
      const samlString = tokenStr.substr(AccessToken._samlTokenPrefix.length + 1);
      return AccessToken.fromSamlTokenString(samlString, IncludePrefix.No);
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
   */
  public static fromJson(jsonObj: any): AccessToken | undefined {
    if (jsonObj._jwt)
      return AccessToken.fromJsonWebTokenString(jsonObj._jwt, jsonObj._startsAt, jsonObj._expiresAt, jsonObj._userInfo);

    if (jsonObj._foreignJwt) {
      const foreignTok = AccessToken.fromForeignProjectAccessTokenJson(jsonObj._foreignJwt);
      if (foreignTok !== undefined)
        return foreignTok;
    }

    return AccessToken.fromSamlAssertion(jsonObj._samlAssertion) as AccessToken;
  }
}

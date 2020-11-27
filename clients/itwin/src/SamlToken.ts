/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { Base64 } from "js-base64";
import { DOMParser } from "xmldom";
import * as xpath from "xpath";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { IncludePrefix } from "./Token";
import { UserInfo } from "./UserInfo";

/* eslint-disable deprecation/deprecation */

/** Base class for JWT and SAML tokens
 * @internal
 * @deprecated
 */
export abstract class SamlToken {
  protected _samlAssertion?: string;
  protected _saml?: string;

  protected _userInfo?: UserInfo;
  protected _startsAt?: Date;
  protected _expiresAt?: Date;
  protected _x509Certificate?: string;

  protected constructor() {
  }

  /** @internal */
  protected getSaml(): string | undefined {
    if (this._saml)
      return this._saml;
    if (!this._samlAssertion)
      return undefined;
    this._saml = Base64.encode(this._samlAssertion);
    return this._saml;
  }

  /** @internal */
  public getSamlAssertion(): string | undefined {
    if (this._samlAssertion)
      return this._samlAssertion;
    if (!this._saml)
      return undefined;
    this._samlAssertion = Base64.decode(this._saml);
    return this._samlAssertion;
  }

  /** @internal */
  public getUserInfo(): UserInfo | undefined {
    if (this._userInfo)
      return this._userInfo;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._userInfo;
  }

  /** @internal */
  public setUserInfo(userInfo: UserInfo): void {
    this._userInfo = userInfo;
  }

  /** @internal */
  public getExpiresAt(): Date | undefined {
    if (this._expiresAt)
      return this._expiresAt;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._expiresAt;
  }

  /** @internal */
  public getStartsAt(): Date | undefined {
    if (this._startsAt)
      return this._startsAt;
    if (!this.parseSamlAssertion())
      return undefined;
    return this._startsAt;
  }

  /** @internal */
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
      select(`/saml:Assertion/saml:AttributeStatement/saml:Attribute[@AttributeName='${attributeName}']/saml:AttributeValue/text()`, dom).toString();

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
 * @internal
 * @deprecated
 */
export class SamlAuthorizationToken extends SamlToken {
  /** Sets up a new AuthorizationToken based on the SAML that was passed in.
   * Does NOT validate the resulting token.
   * @internal
   */
  public static fromSamlAssertion(samlAssertion: string): SamlAuthorizationToken {
    const token = new SamlAuthorizationToken();
    token._samlAssertion = samlAssertion;
    return token;
  }

  /** Creates a string representation of the contained token
   * @internal
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    if (!this.parseSamlAssertion() || !this._x509Certificate)
      throw new BentleyError(BentleyStatus.ERROR, "Invalid access token");

    const prefix = (includePrefix === IncludePrefix.Yes) ? "X509 access_token=" : "";
    return prefix + Buffer.from(this._x509Certificate, "utf8").toString("base64");
  }
}

/** Token issued by DelegationSecureTokenService for API access
 * @internal
 * @deprecated
 */
export class SamlAccessToken extends SamlToken {
  private static _samlTokenPrefix = "Token";

  /** Sets up a new AccessToken based on the SAML that was passed in.
   * Does NOT validate the resulting token.
   * @internal
   */
  public static fromSamlAssertion(samlAssertion: string): SamlAccessToken {
    const token = new SamlAccessToken();
    token._samlAssertion = samlAssertion;
    return token;
  }

  /** Create an AccessToken from a SAML string for Windows Federated Authentication workflows.
   * Does NOT validate the token.
   * @internal
   */
  public static fromSamlTokenString(accessTokenStr: string, includesPrefix: IncludePrefix = IncludePrefix.Yes): SamlAccessToken {
    let saml = accessTokenStr;
    if (includesPrefix === IncludePrefix.Yes) {
      const prefixLength = SamlAccessToken._samlTokenPrefix.length;
      if (accessTokenStr.substr(0, prefixLength).toLowerCase() !== SamlAccessToken._samlTokenPrefix.toLowerCase())
        throw new BentleyError(BentleyStatus.ERROR, "Invalid saml token");
      saml = accessTokenStr.slice(6);
      if (!saml)
        throw new BentleyError(BentleyStatus.ERROR, "Invalid saml token");
    }
    const token = new SamlAccessToken();
    token._saml = saml;
    return token;
  }

  /**
   * Convert this AccessToken to a string
   * @param includePrefix Include the token prefix to identify JWT or SAML tokens
   * @internal
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    const saml = this.getSaml();
    if (!saml)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot convert invalid access token to string");
    return (includePrefix === IncludePrefix.Yes) ? `${SamlAccessToken._samlTokenPrefix} ${saml}` : saml;
  }

  /**
   * Create an AccessToken from a string. The token must include the prefix to differentiate between JWT and SAML.
   * @param tokenStr String representation of the token
   * @internal
   */
  public static fromTokenString(tokenStr: string): SamlAccessToken {
    if (!tokenStr.startsWith(SamlAccessToken._samlTokenPrefix))
      throw new BentleyError(BentleyStatus.ERROR, "Invalid access token");
    tokenStr.substr(SamlAccessToken._samlTokenPrefix.length + 1);
    const samlString = tokenStr.substr(SamlAccessToken._samlTokenPrefix.length + 1);
    return SamlAccessToken.fromSamlTokenString(samlString, IncludePrefix.No);
  }

  /**
   * Creates an AccessToken from an untyped JSON object
   * @param jsonObj
   * @internal
   */
  public static fromJson(jsonObj: any): SamlAccessToken | undefined {
    return SamlAccessToken.fromSamlAssertion(jsonObj._samlAssertion);
  }
}

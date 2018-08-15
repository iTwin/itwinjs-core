/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import * as xpath from "xpath";
import { DOMParser } from "xmldom";
import { UserProfile } from "./UserProfile";
import { Base64 } from "js-base64";

/** Token base class */
export abstract class Token {
  protected _samlAssertion: string;

  protected _userProfile?: UserProfile;
  private _startsAt?: Date;
  private _expiresAt?: Date;
  protected _x509Certificate?: string;

  protected constructor(samlAssertion: string) {
    this._samlAssertion = samlAssertion;
  }

  public getSamlAssertion(): string | undefined {
    return this._samlAssertion;
  }

  public getUserProfile(): UserProfile | undefined {
    return this._userProfile;
  }

  public getExpiresAt(): Date | undefined {
    return this._expiresAt;
  }

  public getStartsAt(): Date | undefined {
    return this._startsAt;
  }

  protected parseSamlAssertion(): boolean {
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

    this._userProfile = {
      firstName: extractAttribute("givenname"),
      lastName: extractAttribute("surname"),
      email: extractAttribute("emailaddress"),
      userId: extractAttribute("userid"),
      organization: extractAttribute("organization"),
      ultimateId: extractAttribute("ultimatesite"),
      usageCountryIso: extractAttribute("usagecountryiso"),
    };

    this._startsAt = new Date(startsAtStr);
    this._expiresAt = new Date(expiresAtStr);

    return !!this._x509Certificate && !!this._startsAt && !!this._expiresAt && !!this._userProfile;
  }
}

/** Token issued by Active Secure Token Service or Federated Authentication Service for user authentication/authorization  */
export class AuthorizationToken extends Token {

  public static fromSamlAssertion(samlAssertion: string): AuthorizationToken | undefined {
    const token = new AuthorizationToken(samlAssertion);
    return token.parseSamlAssertion() ? token : undefined;
  }

  public toTokenString(): string | undefined {
    if (!this._x509Certificate)
      return undefined;
    return "X509 access_token=" + Buffer.from(this._x509Certificate, "utf8").toString("base64");
  }

  public static clone(unTypedObj: any): AuthorizationToken {
    const authToken = new AuthorizationToken(unTypedObj.samlAssertion);
    Object.assign(authToken, unTypedObj);
    return authToken;
  }
}

/** Token issued by DelegationSecureTokenService for API access  */
export class AccessToken extends Token {
  private _accessTokenString?: string;
  private static _tokenPrefix = "Token";
  public static foreignProjectAccessTokenJsonProperty = "ForeignProjectAccessToken";

  public static fromSamlAssertion(samlAssertion: string): AuthorizationToken | undefined {
    const token = new AccessToken(samlAssertion);
    return token.parseSamlAssertion() ? token : undefined;
  }

  public static fromForeignProjectAccessTokenJson(foreignJsonStr: string): AccessToken | undefined {
    if (!foreignJsonStr.startsWith(`{\"${this.foreignProjectAccessTokenJsonProperty}\":`))
      return undefined;
    const props: any = JSON.parse(foreignJsonStr);
    if (props[this.foreignProjectAccessTokenJsonProperty] === undefined)
      return undefined;
    const tok = new AccessToken(foreignJsonStr);
    tok._userProfile = props[this.foreignProjectAccessTokenJsonProperty].userProfile;
    return tok;
  }

  public static fromTokenString(accessTokenString: string): AccessToken | undefined {
    const index = accessTokenString.toLowerCase().indexOf(AccessToken._tokenPrefix.toLowerCase());
    if (index < 0)
      return undefined;

    const extractedStr = accessTokenString.slice(6);
    if (!extractedStr)
      return undefined;

    // Need to replace the trailing \u0000 - see https://github.com/nodejs/node/issues/4775
    const samlStr = Base64.atob(extractedStr).replace(/\0$/, "");
    if (!samlStr)
      return undefined;

    return AccessToken.fromSamlAssertion(samlStr);
  }

  public toTokenString(): string | undefined {
    if (this._accessTokenString)
      return this._accessTokenString;

    if (!this._samlAssertion)
      return undefined;

    const tokenStr: string = Base64.btoa(this._samlAssertion);
    return AccessToken._tokenPrefix + " " + tokenStr;
  }

  public static fromJson(jsonObj: any): AccessToken | undefined {
    const foreignTok = AccessToken.fromForeignProjectAccessTokenJson(jsonObj.samlAssertion);
    if (foreignTok !== undefined)
      return foreignTok;
    return AccessToken.fromSamlAssertion(jsonObj.samlAssertion);
  }

}

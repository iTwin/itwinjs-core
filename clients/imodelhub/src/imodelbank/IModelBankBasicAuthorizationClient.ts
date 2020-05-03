/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessToken, IncludePrefix, UserInfo } from "@bentley/itwin-client";

/**
 * Implements AccessToken that uses Basic access authentication
 * @internal
 */
export class BasicAccessToken extends AccessToken {
  private _prefix: string = "Basic ";
  private _token: string;

  /**
   * Create a BasicAccessToken from user credentials
   * @param userCredentials User credentials containing email and password of the user.
   */
  public static fromCredentials(userCredentials: any): AccessToken {
    const basicToken = new BasicAccessToken("");
    basicToken._token = Buffer.from(userCredentials.email + ":" + userCredentials.password).toString("base64");
    return basicToken;
  }

  /**
   * Creates a token to be used in Authorization header.
   * @param includePrefix Set to Yes if prefix (Basic) should be included before the token.
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    let token: string = "";
    if (includePrefix === IncludePrefix.Yes)
      token += this._prefix;
    token += this._token;
    return token;
  }
}

/** Implements the user permission abstraction by creating a BasicAccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this BasicAccessToken.
 * @internal
 */
export class IModelBankBasicAuthorizationClient implements FrontendAuthorizationClient {
  private _token?: AccessToken;

  public constructor(_userInfo: UserInfo | undefined, private _userCredentials: any) {
  }

  public async signIn(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = BasicAccessToken.fromCredentials(this._userCredentials);
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public async signOut(_requestContext: ClientRequestContext): Promise<void> {
    _requestContext.enter();
    this._token = undefined;
    this.onUserStateChanged.raiseEvent(this._token);
    return Promise.resolve();
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();
  public get isAuthorized(): boolean {
    return !!this._token;
  }
  public get hasExpired(): boolean {
    return !this._token;
  }
  public get hasSignedIn(): boolean {
    return !!this._token;
  }

  public async getAccessToken(_requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (!this._token) {
      return Promise.reject("User is not signed in.");
    }
    return Promise.resolve(this._token);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, IncludePrefix } from "../Token";
import { UserInfo } from "../UserInfo";
import { IModelAuthorizationClient } from "../IModelCloudEnvironment";

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
    const basicToken = new BasicAccessToken();
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
export class BasicAuthorizationClient implements IModelAuthorizationClient {
  public async authorizeUser(_requestContext: ClientRequestContext, _userInfo: UserInfo | undefined, userCredentials: any): Promise<AccessToken> {
    return Promise.resolve(BasicAccessToken.fromCredentials(userCredentials));
  }
}

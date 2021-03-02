/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthStatus, BentleyError, Logger } from "@bentley/bentleyjs-core";
import { ITwinClientLoggerCategory } from "../ITwinClientLoggerCategory";
import { AccessToken, IncludePrefix, TokenPrefix } from "../Token";
chai.should();

const loggerCategory = ITwinClientLoggerCategory.Authorization;
@TokenPrefix("Basic")
class BasicAccessToken extends AccessToken {

  constructor(tokenStr: string) {
    super(tokenStr, undefined, undefined, undefined);
    this.setPrefix("Basic");
  }
  /**
   * Create a BasicAccessToken from user credentials
   * @param userCredentials User credentials containing email and password of the user.
   */
  public static fromCredentials(userCredentials: any): AccessToken {
    const basicToken = new BasicAccessToken("");
    basicToken._tokenString = Buffer.from(`${userCredentials.email}:${userCredentials.password}`).toString("base64");
    return basicToken;
  }
  /**
   * Creates a token to be used in Authorization header.
   * @param includePrefix Set to Yes if prefix (Basic) should be included before the token.
   */
  public toTokenString(includePrefix: IncludePrefix = IncludePrefix.Yes): string {
    let token: string = "";
    if (includePrefix === IncludePrefix.Yes)
      token += `${this._prefix} `;

    token += this._tokenString;
    return token;
  }
  /**
   * initialize the tokenString field of the current instance of BasicAccessToken
   * @param tokenStr String representation of the token
   */
  public initFromTokenString(tokenStr: string): void {
    if (!tokenStr.startsWith(this._prefix)) {
      throw new BentleyError(AuthStatus.Error, "Invalid access token", Logger.logError, loggerCategory, () => ({ tokenStr }));
    }
    const userPass = tokenStr.substr(this._prefix.length + 1);
    this._tokenString = userPass;
  }
}
describe("AccessToken", async () => {

  it("should retrieve a Basic Access Token from token string", () => {
    const token: AccessToken = new BasicAccessToken("user:password");
    const tokenString: string = token.toTokenString(); // will have "Basic" as prefix
    const newToken: AccessToken = AccessToken.fromTokenString(tokenString);
    chai.assert(newToken instanceof BasicAccessToken);
    chai.assert(newToken.toTokenString() === "Basic user:password");
  });
  it("should retrieve an AccessToken from token string", () => {
    const token: AccessToken = new AccessToken("98187ejlaskjd");
    const tokenString: string = token.toTokenString();
    const newToken: AccessToken = AccessToken.fromTokenString(tokenString);
    chai.assert((newToken instanceof AccessToken));
    chai.assert(newToken.toTokenString() === "Bearer 98187ejlaskjd");
  });
  it("should properly create an AccessToken from a json object", () => {
    const jsonObject = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      tokenString: "abc123",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      userInfo: { id: "blah" },
    };
    const token = AccessToken.fromJson(jsonObject); // fromJson expects _tokenString not tokenString, so we must disable the lint rule.
    chai.assert(token.toTokenString() === "Bearer abc123");
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, ImsUserCredentials } from "../ImsClients";
import { UserInfo } from "../UserInfo";
import { TestUsers } from "./TestConfig";

chai.should();

describe("ImsFederatedAuthenticationClient", () => {
  const requestContext = new ClientRequestContext();
  const authorizationClient = new ImsActiveSecureTokenClient();

  it("should find the access token with the right credentials (#integration)", async function (this: Mocha.ITestCallbackContext) {
    let loginError: any;
    try {
      await authorizationClient.getToken(requestContext, { email: TestUsers.regular.email, password: "WrongPassword" });
    } catch (err) {
      loginError = err;
    }
    chai.assert(!!loginError);

    const authToken = await authorizationClient.getToken(requestContext, TestUsers.regular);
    chai.assert(!!authToken);

    const tokenStr = authToken!.toTokenString();
    chai.assert(!!tokenStr);

    chai.expect(tokenStr!.startsWith("X509 access_token="));
    chai.expect(tokenStr!.length > 1000);

    const userInfo: UserInfo | undefined = authToken!.getUserInfo();
    chai.assert(!!userInfo);

    chai.expect(userInfo!.email!.id.toLowerCase() === TestUsers.regular.email.toLowerCase());
  });
});

describe("ImsDelegationSecureTokenClient", () => {
  const authorizationClient = new ImsActiveSecureTokenClient();
  const delegationClient = new ImsDelegationSecureTokenClient();
  const requestContext = new ClientRequestContext();

  it("should find the delegation token with the right credentials for all test users  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const users: ImsUserCredentials[] = [
      TestUsers.regular,
      TestUsers.manager,
      TestUsers.super,
      TestUsers.superManager,
    ];

    for (const user of users) {
      const authToken: AuthorizationToken = await authorizationClient.getToken(requestContext, user);
      chai.expect(!!authToken);

      const accessToken: AccessToken = await delegationClient.getToken(requestContext, authToken);
      chai.expect(!!accessToken);

      const tokenString = accessToken.toTokenString();
      chai.expect(!!tokenString);
      chai.expect(tokenString!.startsWith("Token "));
      chai.expect(tokenString!.length).is.greaterThan(1000);

      const roundTrippedTokenString = AccessToken.fromSamlTokenString(tokenString!)!.toTokenString();
      chai.expect(roundTrippedTokenString).equals(tokenString);
    }
  });

});

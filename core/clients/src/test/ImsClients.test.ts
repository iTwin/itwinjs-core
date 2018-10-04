/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "../ImsClients";
import { UserProfile } from "../UserProfile";
import { TestUsers, UserCredentials } from "./TestConfig";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();

describe("ImsFederatedAuthenticationClient", () => {
  const actx = new ActivityLoggingContext("");
  // NOTE: Getting to client at the same time nto going to work  URL for DEV/QA from ims is same
  // ===========================================================================================
  it("should find the access token with the right credentials (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const clients: ImsActiveSecureTokenClient[] = [
      new ImsActiveSecureTokenClient(),
    ];

    for (const client of clients) {
      let loginError: any;
      try {
        await client.getToken(actx, TestUsers.regular.email, "WrongPassword");
      } catch (err) {
        loginError = err;
      }
      chai.assert(!!loginError);

      const authToken = await client.getToken(actx, TestUsers.regular.email, TestUsers.regular.password);
      chai.assert(!!authToken);

      const tokenStr = authToken!.toTokenString();
      chai.assert(!!tokenStr);

      chai.expect(tokenStr!.startsWith("X509 access_token="));
      chai.expect(tokenStr!.length > 1000);

      const userProfile: UserProfile | undefined = authToken!.getUserProfile();
      chai.assert(!!userProfile);

      chai.expect(userProfile!.email.toLowerCase() === TestUsers.regular.email.toLowerCase());
    }
  });

});

describe("ImsDelegationSecureTokenClient", () => {
  const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
  const actx = new ActivityLoggingContext("");

  it.skip("should find the delegation token with the right credentials for all test users  (#integration)", async function (this: Mocha.ITestCallbackContext) {

    const clients: ImsDelegationSecureTokenClient[] = [
      new ImsDelegationSecureTokenClient(),
    ];
    const users: UserCredentials[] = [
      TestUsers.regular,
      TestUsers.manager,
      TestUsers.super,
      TestUsers.superManager,
    ];

    for (const accessClient of clients) {
      for (const user of users) {
        const authToken: AuthorizationToken = await authorizationClient.getToken(actx, user.email, user.password);
        chai.expect(!!authToken);

        const accessToken: AccessToken = await accessClient.getToken(actx, authToken);
        chai.expect(!!accessToken);

        const tokenString = accessToken.toTokenString();
        chai.expect(!!tokenString);
        chai.expect(tokenString!.startsWith("Token "));
        chai.expect(tokenString!.length).is.greaterThan(1000);

        const roundTrippedTokenString = AccessToken.fromSamlTokenString(tokenString!)!.toTokenString();
        chai.expect(roundTrippedTokenString).equals(tokenString);
      }
    }
  }); // .timeout(15000);

});

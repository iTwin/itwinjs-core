/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsFederatedAuthentiationClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "../ImsClients";
import { UserProfile } from "../UserProfile";
import { TestConfig, TestUsers } from "./TestConfig";

chai.should();

describe("ImsFederatedAuthentiationClient", () => {
  before(function(this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();
  });

  it("should setup its URLs correctly", async () => {
    let url: string = await new ImsFederatedAuthentiationClient("DEV").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");

    url = await new ImsFederatedAuthentiationClient("QA").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");

    url = await new ImsFederatedAuthentiationClient("PROD").getUrl();
    chai.expect(url).equals("https://ims.bentley.com");

    url = await new ImsFederatedAuthentiationClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");
  });
});

describe("ImsActiveSecureTokenClient", () => {
  before(function(this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();
  });

  it("should setup its URLs correctly", async () => {
    const prodClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient("PROD");

    let url: string = await (new ImsActiveSecureTokenClient("DEV")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    url = await (new ImsActiveSecureTokenClient("QA")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    url = await prodClient.getUrl();
    chai.expect(url).equals("https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    url = await (new ImsActiveSecureTokenClient("PERF")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");
  });

  it("should find the access token with the right credentials", async () => {

    const clients: ImsActiveSecureTokenClient[] = [
      new ImsActiveSecureTokenClient("DEV"),
      new ImsActiveSecureTokenClient("QA"),
    ];

    for (const client of clients) {
      let loginError: any;
      try {
        await client.getToken(TestUsers.regular.email, "WrongPassword");
      } catch (err) {
        loginError = err;
      }
      chai.assert(!!loginError);

      const authToken = await client.getToken(TestUsers.regular.email, TestUsers.regular.password);
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
  const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient(TestConfig.deploymentEnv);

  before(function(this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();
  });

  it("should setup its URLs correctly", async () => {
    let url: string = await new ImsDelegationSecureTokenClient("DEV").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    url = await new ImsDelegationSecureTokenClient("QA").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    url = await new ImsDelegationSecureTokenClient("PROD").getUrl();
    chai.expect(url).equals("https://ims.bentley.com/rest/DelegationSTSService");

    url = await new ImsDelegationSecureTokenClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");
  });

  it("should find the delegation token with the right credentials", async () => {
    const clients: ImsDelegationSecureTokenClient[] = [
      new ImsDelegationSecureTokenClient("DEV"),
      new ImsDelegationSecureTokenClient("QA"),
    ];

    for (const accessClient of clients) {
      const authToken: AuthorizationToken = await authorizationClient.getToken(TestUsers.user1.email, TestUsers.user1.password);
      chai.expect(!!authToken);

      const accessToken: AccessToken = await accessClient.getToken(authToken);
      chai.expect(!!accessToken);

      const tokenString = accessToken.toTokenString();
      chai.expect(!!tokenString);
      chai.expect(tokenString!.startsWith("Token "));
      chai.expect(tokenString!.length).is.greaterThan(1000);

      const roundTrippedTokenString = AccessToken.fromTokenString(tokenString!)!.toTokenString();
      chai.expect(roundTrippedTokenString).equals(tokenString);
    }
  }).timeout(15000);

});

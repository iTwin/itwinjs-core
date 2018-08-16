/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { ImsFederatedAuthenticationClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "../ImsClients";
import { UserProfile } from "../UserProfile";
import { TestConfig, TestUsers, UserCredentials } from "./TestConfig";

import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";

chai.should();

export class FederatedImsUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com",
    QA: "https://qa-ims.bentley.com",
    PROD: "https://ims.bentley.com",
    PERF: "https://qa-ims.bentley.com",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(ImsFederatedAuthenticationClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("ImsFederatedAuthenticationClient", () => {
  it("should setup its URLs correctly", async () => {
    FederatedImsUrlMock.mockGetUrl("DEV");
    let url: string = await new ImsFederatedAuthenticationClient("DEV").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("QA");
    url = await new ImsFederatedAuthenticationClient("QA").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PROD");
    url = await new ImsFederatedAuthenticationClient("PROD").getUrl();
    chai.expect(url).equals("https://ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PERF");
    url = await new ImsFederatedAuthenticationClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com");
  });
});

export class ActiveImsUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    QA: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    PROD: "https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
    PERF: "https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(ImsActiveSecureTokenClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("ImsActiveSecureTokenClient", () => {
  it("should setup its URLs correctly", async () => {
    const prodClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient("PROD");

    ActiveImsUrlMock.mockGetUrl("DEV");
    let url: string = await (new ImsActiveSecureTokenClient("DEV")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("QA");
    url = await (new ImsActiveSecureTokenClient("QA")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PROD");
    url = await prodClient.getUrl();
    chai.expect(url).equals("https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PERF");
    url = await (new ImsActiveSecureTokenClient("PERF")).getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");
  });

  it("should find the access token with the right credentials", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

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

export class DelegationImsUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://qa-ims.bentley.com/rest/DelegationSTSService",
    QA: "https://qa-ims.bentley.com/rest/DelegationSTSService",
    PROD: "https://ims.bentley.com/rest/DelegationSTSService",
    PERF: "https://qa-ims.bentley.com/rest/DelegationSTSService",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(ImsDelegationSecureTokenClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("ImsDelegationSecureTokenClient", () => {
  const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient(TestConfig.deploymentEnv);

  it("should setup its URLs correctly", async () => {
    DelegationImsUrlMock.mockGetUrl("DEV");
    let url: string = await new ImsDelegationSecureTokenClient("DEV").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("QA");
    url = await new ImsDelegationSecureTokenClient("QA").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PROD");
    url = await new ImsDelegationSecureTokenClient("PROD").getUrl();
    chai.expect(url).equals("https://ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PERF");
    url = await new ImsDelegationSecureTokenClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");
  });

  it.skip("should find the delegation token with the right credentials for all test users", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const clients: ImsDelegationSecureTokenClient[] = [
      new ImsDelegationSecureTokenClient("DEV"),
      new ImsDelegationSecureTokenClient("QA"),
    ];
    const users: UserCredentials[] = [
      TestUsers.regular,
      TestUsers.manager,
      TestUsers.super,
      TestUsers.superManager,
    ];

    for (const accessClient of clients) {
      for (const user of users) {
        const authToken: AuthorizationToken = await authorizationClient.getToken(user.email, user.password);
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
    }
  }); // .timeout(15000);

});

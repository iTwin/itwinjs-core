/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { UlasClient, FeatureLogEntry, LogPostingResponse, LogPostingSource, UsageType } from "../UlasClient";
import { TestConfig, TestUsers } from "./TestConfig";

import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";
import { Guid, BentleyStatus } from "@bentley/bentleyjs-core";

export class UlasClientUrlMock {
  private static readonly urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    QA: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    PROD: "https://connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    PERF: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this.urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(UlasClient.searchKey, env, this.urlDescriptor[env]);
  }
}

describe("UlasClient", () => {

  let accessToken: AccessToken;
  const ulasClient = new UlasClient("QA");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login(TestUsers.super);
    accessToken = await ulasClient.getAccessToken(authToken);
  });

  it("should set up its URLs", async () => {
    UlasClientUrlMock.mockGetUrl("DEV");
    let url: string = await new UlasClient("DEV").getUrl();
    chai.expect(url).equals("https://dev-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("QA");
    url = await new UlasClient("QA").getUrl();
    chai.expect(url).equals("https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("PROD");
    url = await new UlasClient("PROD").getUrl();
    chai.expect(url).equals("https://connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("PERF");
    url = await new UlasClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");
  });

  it("Post feature log", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const myFeatureId = new Guid(true);
    const entry = new FeatureLogEntry(myFeatureId, 43);
    entry.productVersion = [3, 4, 99];
    entry.logPostingSource = LogPostingSource.RealTime;
    entry.usageType = UsageType.Beta;
    entry.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) });
    entry.usageData.push({ name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await ulasClient.logFeature(accessToken, entry);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);
  });

});

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { UlasClient, UsageLogEntry, FeatureLogEntry, FeatureStartedLogEntry, FeatureEndedLogEntry, LogPostingResponse, LogPostingSource, UsageType } from "../UlasClient";
import { TestConfig, TestUsers } from "./TestConfig";

import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";
import { Guid, BentleyStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";

export class UlasClientUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    QA: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    PROD: "https://connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    PERF: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(UlasClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("UlasClient", () => {

  let accessToken: AccessToken;
  const ulasClient = new UlasClient("QA");
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login(TestUsers.super);
    accessToken = await ulasClient.getAccessToken(actx, authToken);
  });

  it("should set up its URLs", async () => {
    UlasClientUrlMock.mockGetUrl("DEV");
    let url: string = await new UlasClient("DEV").getUrl(actx);
    chai.expect(url).equals("https://dev-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("QA");
    url = await new UlasClient("QA").getUrl(actx);
    chai.expect(url).equals("https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("PROD");
    url = await new UlasClient("PROD").getUrl(actx);
    chai.expect(url).equals("https://connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");

    UlasClientUrlMock.mockGetUrl("PERF");
    url = await new UlasClient("PERF").getUrl(actx);
    chai.expect(url).equals("https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi");
  });

  it("Post usage log", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const entry = new UsageLogEntry(43);
    entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 99 };
    entry.logPostingSource = LogPostingSource.RealTime;
    entry.usageType = UsageType.Beta;
    const resp: LogPostingResponse = await ulasClient.logUsage(actx, accessToken, entry);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log without host hash", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const entry = new UsageLogEntry(43);
    entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 99 };
    // set host name and user name, but do not provide a hash
    entry.hostName = "mymachine";
    entry.hostUserName = "johnny";
    entry.logPostingSource = LogPostingSource.RealTime;
    entry.usageType = UsageType.Beta;
    const resp: LogPostingResponse = await ulasClient.logUsage(actx, accessToken, entry);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const myFeatureId = new Guid(true);
    const entry = new FeatureLogEntry(myFeatureId, 43);
    entry.productVersion = { major: 3, minor: 4, sub1: 99 };
    entry.logPostingSource = LogPostingSource.RealTime;
    entry.usageType = UsageType.Beta;
    entry.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await ulasClient.logFeature(actx, accessToken, entry);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log without host hash", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const myFeatureId = new Guid(true);
    const entry = new FeatureLogEntry(myFeatureId, 43);
    entry.productVersion = { major: 3, minor: 4, sub1: 99 };
    // set host name and user name, but do not provide a hash
    entry.hostName = "mymachine";
    entry.hostUserName = "johnny";
    entry.logPostingSource = LogPostingSource.RealTime;
    entry.usageType = UsageType.Beta;
    entry.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await ulasClient.logFeature(actx, accessToken, entry);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);
  });

  it("Post multiple feature logs", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const feature1Id = new Guid(true);
    const feature2Id = new Guid(true);
    const entry1 = new FeatureLogEntry(feature1Id, 43);
    entry1.productVersion = { major: 3, minor: 4, sub1: 99 };
    entry1.logPostingSource = LogPostingSource.RealTime;
    entry1.usageType = UsageType.Beta;
    entry1.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) }, { name: "imodelsize", value: 596622 });
    const entry2 = new FeatureLogEntry(feature2Id, 43);
    entry2.productVersion = { major: 3, minor: 4, sub1: 99 };
    entry2.logPostingSource = LogPostingSource.RealTime;
    entry2.usageType = UsageType.Beta;
    entry2.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) }, { name: "imodelsize", value: 400 });
    const resp: LogPostingResponse = await ulasClient.logFeature(actx, accessToken, entry1, entry2);
    chai.assert(resp);
    chai.assert.equal(resp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(resp.message, "Accepted");
    chai.assert.isAtLeast(resp.time, 0);

    // test that the method throws if no feature log entry is passed
    let hasThrown: boolean = false;
    try {
      await ulasClient.logFeature(actx, accessToken);
    } catch (e) {
      hasThrown = true;
    }
    chai.assert.isTrue(hasThrown, "Passing no FeatureLogEntry to UlasClient.logFeature is expected to throw.");
  });

  it("Post duration feature log", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const myFeatureId = new Guid(true);
    const startEntry = new FeatureStartedLogEntry(myFeatureId, 43);
    startEntry.productVersion = { major: 3, minor: 4 };
    startEntry.logPostingSource = LogPostingSource.RealTime;
    startEntry.usageType = UsageType.Beta;
    startEntry.usageData.push({ name: "imodelid", value: (new Guid(true).toString()) }, { name: "user", value: "123-123" });
    const startResp: LogPostingResponse = await ulasClient.logFeature(actx, accessToken, startEntry);
    chai.assert(startResp);
    chai.assert.equal(startResp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(startResp.message, "Accepted");
    chai.assert.isAtLeast(startResp.time, 0);

    const endEntry = new FeatureEndedLogEntry(myFeatureId, 43, startEntry.entryId);
    endEntry.productVersion = startEntry.productVersion;
    endEntry.logPostingSource = startEntry.logPostingSource;
    endEntry.usageType = startEntry.usageType;
    endEntry.usageData = startEntry.usageData;
    const endResp: LogPostingResponse = await ulasClient.logFeature(actx, accessToken, endEntry);
    chai.assert(endResp);
    chai.assert.equal(endResp.status, BentleyStatus.SUCCESS);
    chai.assert.equal(endResp.message, "Accepted");
    chai.assert.isAtLeast(endResp.time, 0);
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GuidString, Guid, BentleyStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AuthorizationToken, AccessToken } from "../Token";
import { UserInfo } from "../UserInfo";
import { UlasClient, UsageLogEntry, FeatureLogEntry, FeatureStartedLogEntry, FeatureEndedLogEntry, LogPostingResponse, UsageType } from "../ulas/UlasClient";
import { TestConfig } from "./TestConfig";

import * as os from "os";

describe("UlasClient - SAML Token (#integration)", () => {

  let authToken: AuthorizationToken;
  let accessToken: AccessToken;
  const client: UlasClient = new UlasClient();
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    authToken = await TestConfig.login();
    accessToken = await client.getAccessToken(actx, authToken);
  });

  function populateUserInfo(entry: UsageLogEntry | FeatureLogEntry, userInfo?: UserInfo, hostUserName?: string): void {
    if (!userInfo)
      return;

    const featureTrackingInfo = userInfo.featureTracking;

    const imsId: GuidString = userInfo.id;
    const ultimateSite: number = !featureTrackingInfo ? 0 : parseInt(featureTrackingInfo.ultimateSite, 10);
    const usageCountryIso: string = !featureTrackingInfo ? "" : featureTrackingInfo.usageCountryIso;

    entry.userInfo = { imsId, ultimateSite, usageCountryIso, hostUserName };
  }

  it("Post usage log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), usageType);
      populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
      entry.productId = 43;
      entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 99 };

      const resp: LogPostingResponse = await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post usage log with project id (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.projectId = Guid.createValue();
    entry.productId = 43;
    entry.productVersion = { major: 0, minor: 4 };

    const resp: LogPostingResponse = await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.projectId = Guid.createValue();
    entry.productId = 43;

    const resp: LogPostingResponse = await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log - hostName and hostUserName special cases (#integration)", async function (this: Mocha.ITestCallbackContext) {
    for (const host of [{ name: "::1", user: os.userInfo().username }, { name: "127.0.0.1", user: os.userInfo().username }, { name: "localhost", user: os.userInfo().username },
    { name: os.hostname(), user: "BENTLEY\\\\me" }, { name: os.hostname(), user: "BENTLEY/me" }, { name: os.hostname(), user: "Administrator" },
    { name: os.hostname(), user: "system" }, { name: os.hostname(), user: "" }, { name: os.hostname() }]) {
      const entry: UsageLogEntry = new UsageLogEntry(host.name, UsageType.Beta);
      populateUserInfo(entry, accessToken.getUserInfo(), host.user);
      entry.productId = 43;
      entry.productVersion = { major: 3, minor: 4, sub1: 5 };

      const resp: LogPostingResponse = await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Invalid usage log entry (#integration)", async function (this: Mocha.ITestCallbackContext) {
    let entry: UsageLogEntry = new UsageLogEntry("", UsageType.HomeUse);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.productId = 43;
    entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 101 };

    let hasThrown: boolean = false;
    try {
      await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "UlasClient.logUsage is expected to throw if hostName is not specified.");

    entry = new UsageLogEntry(os.hostname(), 100 as UsageType);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.productId = 43;
    entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 101 };

    hasThrown = false;
    try {
      await client.logUsage(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "UlasClient.logUsage is expected to throw if UsageType is not one of the enum values.");
  });

  it("AccessToken without feature tracking claims (#integration)", async function (this: Mocha.ITestCallbackContext) {
    enum TokenMode {
      Valid,
      NoUserProfile,
      NoUserId,
      NoUltimateId,
    }

    for (const mode of [TokenMode.Valid, TokenMode.NoUserProfile, TokenMode.NoUserId, TokenMode.NoUltimateId]) {
      let token: AccessToken;
      if (mode === TokenMode.NoUserProfile) {
        // fake token that does not contain a user profile
        token = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify({ ForeignProjectAccessToken: {} }))!;
      } else {
        // token from which some user profile information is removed. UlasClient does not examine the actual token string.
        authToken = await TestConfig.login();
        token = await client.getAccessToken(actx, authToken);
        switch (mode) {
          case TokenMode.NoUserId:
            token.getUserInfo()!.id = "";
            break;

          case TokenMode.NoUltimateId:
            token.getUserInfo()!.featureTracking = { ultimateSite: "", usageCountryIso: "" };
            break;

          default:
            break;
        }
      }

      const uEntry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);
      populateUserInfo(uEntry, token.getUserInfo(), os.userInfo().username);
      uEntry.productId = 43;
      uEntry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 101 };

      let hasThrown: boolean = false;
      try {
        await client.logUsage(new ActivityLoggingContext(Guid.createValue()), token, uEntry);
      } catch (e) {
        hasThrown = true;
      }
      assert.equal(hasThrown, mode !== TokenMode.Valid, "UlasClient.logUsage is expected to throw if access token does not have valid user profile info.");

      const fEntry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);
      populateUserInfo(fEntry, token.getUserInfo(), os.userInfo().username);
      fEntry.productId = 43;
      fEntry.productVersion = { major: 3, minor: 4, sub1: 99 };

      hasThrown = false;
      try {
        await client.logFeature(new ActivityLoggingContext(Guid.createValue()), token, fEntry);
      } catch (e) {
        hasThrown = true;
      }
      assert.equal(hasThrown, mode !== TokenMode.Valid, "UlasClient.logFeature is expected to throw if access token does not have valid user profile info.");
    }
  });

  it("Post feature log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const myFeatureId: GuidString = Guid.createValue();

    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry = new FeatureLogEntry(myFeatureId, os.hostname(), usageType);
      populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
      entry.productId = 43;
      entry.productVersion = { major: 3, minor: 4, sub1: 99 };

      const resp: LogPostingResponse = await client.logFeature(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post feature log with project id (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.productId = 43;
    entry.productVersion = { major: 3, minor: 4, sub1: 99 };
    entry.projectId = Guid.createValue();
    entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await client.logFeature(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);
    populateUserInfo(entry, accessToken.getUserInfo(), os.userInfo().username);
    entry.productId = 43;
    entry.projectId = Guid.createValue();
    entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await client.logFeature(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log - hostName and hostUserName special cases (#integration)", async function (this: Mocha.ITestCallbackContext) {
    for (const host of [{ name: "::1", user: os.userInfo().username }, { name: "127.0.0.1", user: os.userInfo().username }, { name: "localhost", user: os.userInfo().username },
    { name: os.hostname(), user: "BENTLEY\\\\me" }, { name: os.hostname(), user: "BENTLEY/me" }, { name: os.hostname(), user: "Administrator" },
    { name: os.hostname(), user: "system" }]) {
      const entry = new FeatureLogEntry(Guid.createValue(), host.name, UsageType.Beta);
      populateUserInfo(entry, accessToken.getUserInfo(), host.user);
      entry.productId = 43;
      entry.productVersion = { major: 3, minor: 4, sub1: 5, sub2: 99 };
      entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
      const resp: LogPostingResponse = await client.logFeature(new ActivityLoggingContext(Guid.createValue()), accessToken, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post multiple feature logs (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const feature1Id: GuidString = Guid.createValue();
    const feature2Id: GuidString = Guid.createValue();
    const entry1 = new FeatureLogEntry(feature1Id, os.hostname(), UsageType.HomeUse);
    populateUserInfo(entry1, accessToken.getUserInfo(), os.userInfo().username);
    entry1.productId = 43;
    entry1.productVersion = { major: 3, minor: 4, sub1: 99 };
    entry1.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });

    // omit product version in second entry
    const entry2 = new FeatureLogEntry(feature2Id, os.hostname(), UsageType.Beta);
    populateUserInfo(entry2, accessToken.getUserInfo(), os.userInfo().username);
    entry2.productId = 43;
    entry2.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 400 });
    let actCtx = new ActivityLoggingContext(Guid.createValue());
    const resp: LogPostingResponse = await client.logFeature(actCtx, accessToken, entry1, entry2);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);

    // test that the method throws if no feature log entry is passed
    let hasThrown: boolean = false;
    try {
      actCtx = new ActivityLoggingContext(Guid.createValue());
      await client.logFeature(actCtx, accessToken);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "Passing no FeatureLogEntry to UlasClient.logFeature is expected to throw.");
  });

  it("Post duration feature log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const myFeatureId: GuidString = Guid.createValue();
    let startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    populateUserInfo(startEntry, accessToken.getUserInfo(), os.userInfo().username);
    startEntry.productId = 43;
    startEntry.productVersion = { major: 3, minor: 4 };
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });

    let actCtx = new ActivityLoggingContext(Guid.createValue());
    let startResp: LogPostingResponse = await client.logFeature(actCtx, accessToken, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    let endEntry: FeatureEndedLogEntry = FeatureEndedLogEntry.fromStartEntry(startEntry);
    actCtx = new ActivityLoggingContext(Guid.createValue());
    let endResp: LogPostingResponse = await client.logFeature(actCtx, accessToken, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);

    // once more, now with building end entry from scratch
    startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.HomeUse);
    populateUserInfo(startEntry, accessToken.getUserInfo(), os.userInfo().username);
    startEntry.productId = 43;
    startEntry.productVersion = { major: 3, minor: 4 };
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });
    actCtx = new ActivityLoggingContext(Guid.createValue());
    startResp = await client.logFeature(actCtx, accessToken, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    endEntry = new FeatureEndedLogEntry(myFeatureId, startEntry.entryId, os.hostname(), UsageType.HomeUse);
    populateUserInfo(endEntry, accessToken.getUserInfo(), os.userInfo().username);
    endEntry.productId = 32;
    endEntry.productVersion = { major: 3, minor: 4 };
    actCtx = new ActivityLoggingContext(Guid.createValue());
    endResp = await client.logFeature(actCtx, accessToken, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });

  it("Post duration feature log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const myFeatureId: GuidString = Guid.createValue();
    let startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    populateUserInfo(startEntry, accessToken.getUserInfo(), os.userInfo().username);
    startEntry.productId = 43;
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });

    let actCtx = new ActivityLoggingContext(Guid.createValue());
    let startResp: LogPostingResponse = await client.logFeature(actCtx, accessToken, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    let endEntry: FeatureEndedLogEntry = FeatureEndedLogEntry.fromStartEntry(startEntry);
    actCtx = new ActivityLoggingContext(Guid.createValue());
    let endResp: LogPostingResponse = await client.logFeature(actCtx, accessToken, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);

    // once more, now with building end entry from scratch
    startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.HomeUse);
    populateUserInfo(startEntry, accessToken.getUserInfo(), os.userInfo().username);
    startEntry.productId = 43;
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });
    actCtx = new ActivityLoggingContext(Guid.createValue());
    startResp = await client.logFeature(actCtx, accessToken, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    endEntry = new FeatureEndedLogEntry(myFeatureId, startEntry.entryId, os.hostname(), UsageType.HomeUse);
    populateUserInfo(endEntry, accessToken.getUserInfo(), os.userInfo().username);
    endEntry.productId = 32;
    actCtx = new ActivityLoggingContext(Guid.createValue());
    endResp = await client.logFeature(actCtx, accessToken, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });

});

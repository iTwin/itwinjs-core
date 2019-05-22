/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GuidString, Guid, BentleyStatus, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { UlasClient, UsageLogEntry, FeatureLogEntry, FeatureStartedLogEntry, FeatureEndedLogEntry, LogPostingResponse, UsageType } from "../ulas/UlasClient";
import { TestConfig } from "./TestConfig";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

import * as os from "os";

describe("UlasClient - SAML Token (#integration)", () => {
  const client: UlasClient = new UlasClient();
  let accessToken: AccessToken;

  before(async function (this: Mocha.IHookCallbackContext) {
    const authToken = await TestConfig.login();
    accessToken = await client.getAccessToken(new ClientRequestContext(), authToken);
  });

  it("Post usage log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.5.99");
    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), usageType);

      const resp: LogPostingResponse = await client.logUsage(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post usage log with project id (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "0.4");
    const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);
    entry.projectId = Guid.createValue();

    const resp: LogPostingResponse = await client.logUsage(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log with session id (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "0.5", Guid.createValue());
    const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);

    const resp: LogPostingResponse = await client.logUsage(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const entry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);
    entry.projectId = Guid.createValue();

    const resp: LogPostingResponse = await client.logUsage(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post usage log - hostName special cases (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.5");
    for (const hostName of [
      "::1",
      "127.0.0.1",
      "localhost",
    ]) {
      const entry: UsageLogEntry = new UsageLogEntry(hostName, UsageType.Beta);

      const resp: LogPostingResponse = await client.logUsage(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Invalid usage log entry (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.5.101");
    let entry: UsageLogEntry = new UsageLogEntry("", UsageType.HomeUse);

    let hasThrown: boolean = false;
    try {
      await client.logUsage(requestContext, entry);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "UlasClient.logUsage is expected to throw if hostName is not specified.");

    entry = new UsageLogEntry(os.hostname(), 100 as UsageType);

    hasThrown = false;
    try {
      await client.logUsage(requestContext, entry);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "UlasClient.logUsage is expected to throw if UsageType is not one of the enum values.");
  });

  it.only("AccessToken without feature tracking claims (#integration)", async function (this: Mocha.ITestCallbackContext) {
    enum TokenMode {
      Complete,
      NoUserProfile,
      NoUserId,
      NoUltimateId,
    }

    const passingTokenModes = [TokenMode.Complete, TokenMode.NoUserId, TokenMode.NoUltimateId];

    for (const mode of [TokenMode.Complete, TokenMode.NoUserProfile, TokenMode.NoUserId, TokenMode.NoUltimateId]) {
      let tempAccessToken: AccessToken;

      if (mode === TokenMode.NoUserProfile) {
        // fake token that does not contain a user profile
        tempAccessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify({ ForeignProjectAccessToken: {} }))!;
      } else {
        // token from which some user profile information is removed. UlasClient does not utilize this information, and instead defers this task to the ULAS server, which examines the token string itself.
        const authToken = await TestConfig.login();
        tempAccessToken = await client.getAccessToken(new ClientRequestContext(), authToken);
        switch (mode) {
          case TokenMode.NoUserId:
            tempAccessToken.getUserInfo()!.id = "";
            break;

          case TokenMode.NoUltimateId:
            tempAccessToken.getUserInfo()!.featureTracking = { ultimateSite: "", usageCountryIso: "" };
            break;

          default:
            break;
        }

      }

      let tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.5.101");

      const uEntry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);

      let hasThrown: boolean = false;
      try {
        await client.logUsage(tempRequestContext, uEntry);
      } catch (e) {
        hasThrown = true;
      }
      assert.equal(hasThrown, !passingTokenModes.includes(mode), "UlasClient.logUsage is expected to throw if access token does not have required user profile info.");

      const fEntry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);

      tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.99");

      hasThrown = false;
      try {
        await client.logFeature(tempRequestContext, fEntry);
      } catch (e) {
        hasThrown = true;
      }
      assert.equal(hasThrown, !passingTokenModes.includes(mode), "UlasClient.logFeature is expected to throw if access token does not have required user profile info.");
    }
  });

  it("Post feature log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");
    const myFeatureId: GuidString = Guid.createValue();

    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry = new FeatureLogEntry(myFeatureId, os.hostname(), usageType);

      const resp: LogPostingResponse = await client.logFeature(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post feature log with project id (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);
    entry.projectId = Guid.createValue();
    entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await client.logFeature(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);
    entry.projectId = Guid.createValue();
    entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
    const resp: LogPostingResponse = await client.logFeature(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log - hostName special cases (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.5.99");
    for (const hostName of [
      "::1",
      "127.0.0.1",
      "localhost",
    ]) {
      const entry = new FeatureLogEntry(Guid.createValue(), hostName, UsageType.Beta);
      entry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });
      const resp: LogPostingResponse = await client.logFeature(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post multiple feature logs (#integration)", async function (this: Mocha.ITestCallbackContext) {
    let requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");
    const feature1Id: GuidString = Guid.createValue();
    const feature2Id: GuidString = Guid.createValue();
    const entry1 = new FeatureLogEntry(feature1Id, os.hostname(), UsageType.HomeUse);
    entry1.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 596622 });

    // omit product version in second entry
    requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const entry2 = new FeatureLogEntry(feature2Id, os.hostname(), UsageType.Beta);
    entry2.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "imodelsize", value: 400 });
    const resp: LogPostingResponse = await client.logFeature(requestContext, entry1, entry2);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);

    // test that the method throws if no feature log entry is passed
    let hasThrown: boolean = false;
    try {
      await client.logFeature(requestContext);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "Passing no FeatureLogEntry to UlasClient.logFeature is expected to throw.");
  });

  it("Post duration feature log (#integration)", async function (this: Mocha.ITestCallbackContext) {
    let requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4");
    const myFeatureId: GuidString = Guid.createValue();
    let startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });

    let startResp: LogPostingResponse = await client.logFeature(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    let endEntry: FeatureEndedLogEntry = FeatureEndedLogEntry.fromStartEntry(startEntry);
    let endResp: LogPostingResponse = await client.logFeature(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);

    // once more, now with building end entry from scratch
    startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.HomeUse);
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });
    startResp = await client.logFeature(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "32", "3.4");
    endEntry = new FeatureEndedLogEntry(myFeatureId, startEntry.entryId, os.hostname(), UsageType.HomeUse);
    endResp = await client.logFeature(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });

  it("Post duration feature log without product version (#integration)", async function (this: Mocha.ITestCallbackContext) {
    let requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const myFeatureId: GuidString = Guid.createValue();
    let startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });

    let startResp: LogPostingResponse = await client.logFeature(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    let endEntry: FeatureEndedLogEntry = FeatureEndedLogEntry.fromStartEntry(startEntry);
    let endResp: LogPostingResponse = await client.logFeature(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);

    // once more, now with building end entry from scratch
    startEntry = new FeatureStartedLogEntry(myFeatureId, os.hostname(), UsageType.HomeUse);
    startEntry.usageData.push({ name: "imodelid", value: Guid.createValue() }, { name: "user", value: "123-123" });
    startResp = await client.logFeature(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "32");
    endEntry = new FeatureEndedLogEntry(myFeatureId, startEntry.entryId, os.hostname(), UsageType.HomeUse);
    endResp = await client.logFeature(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });
});

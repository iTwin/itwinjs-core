/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as os from "os";
import { BentleyStatus, Config, Guid, GuidString } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestBrowserAuthorizationClientConfiguration, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import {
  EndFeatureLogEntry, FeatureLogEntry, LogPostingResponse, StartFeatureLogEntry, UsageLoggingClient, UsageType,
} from "../../UsageLoggingClient";

describe("UlasClient - OIDC Token (#integration)", () => {
  const client: UsageLoggingClient = new UsageLoggingClient();
  let accessToken: AccessToken;

  before(async () => {
    const oidcConfig: TestBrowserAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_oidc_ulas_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_ulas_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_ulas_test_scopes"),
    };

    // Need to cast to any and then back to AccessToken because of circular dependency with the oidc-signin-tool
    accessToken = (await getAccessTokenFromBackend(TestUsers.regular, oidcConfig) as any) as AccessToken;
  });

  it("AccessToken without feature tracking claims (#integration)", async () => {
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
        tempAccessToken = new AccessToken("");
      } else {
        tempAccessToken = (await getAccessTokenFromBackend(TestUsers.regular) as any) as AccessToken;

        // token from which some user profile information is removed. UlasClient does not utilize this information, and instead defers this task to the ULAS server, which examines the token string itself.
        // Need to cast to any and then back to AccessToken because of circular dependency with the oidc-signin-tool
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

      // const uEntry: UsageLogEntry = new UsageLogEntry(os.hostname(), UsageType.Trial);

      // let hasThrown: boolean = false;
      // try {
      //   await client.logUsage(tempRequestContext, uEntry);
      // } catch (e) {
      //   hasThrown = true;
      // }
      // assert.equal(hasThrown, !passingTokenModes.includes(mode), "UlasClient.logUsage is expected to throw if access token does not have required user profile info.");

      const fEntry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial);

      tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.99");

      let hasThrown = false;
      try {
        await client.logFeatureUsage(tempRequestContext, fEntry);
      } catch (e) {
        hasThrown = true;
      }
      assert.equal(hasThrown, !passingTokenModes.includes(mode), "UlasClient.logFeatureUsage is expected to throw if access token does not have required user profile info.");
    }
  });

  it("Post feature log (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");

    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), usageType);

      const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post feature log using iTwin productID and no projectId (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "2686", "3.4.99");

    for (const usageType of [UsageType.Beta, UsageType.HomeUse, UsageType.PreActivation, UsageType.Production, UsageType.Trial]) {
      const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), usageType);

      const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post feature log with project id (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial, Guid.createValue());
    entry.additionalData.imodelid = Guid.createValue();
    entry.additionalData.imodelsize = "596622";
    const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log without product version (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const entry = new FeatureLogEntry(Guid.createValue(), os.hostname(), UsageType.Trial, Guid.createValue());
    entry.additionalData.imodelid = Guid.createValue();
    entry.additionalData.imodelsize = "596622";
    const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);
  });

  it("Post feature log - hostName special cases (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.5.99");
    for (const hostName of [
      "::1",
      "127.0.0.1",
      "localhost",
    ]) {
      const entry = new FeatureLogEntry(Guid.createValue(), hostName, UsageType.Beta);
      entry.additionalData.imodelid = Guid.createValue();
      entry.additionalData.imodelsize = "596622";
      const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry);
      assert(resp);
      assert.equal(resp.status, BentleyStatus.SUCCESS);
      assert.equal(resp.message, "Accepted");
      assert.isTrue(Guid.isGuid(resp.requestId));
      assert.isAtLeast(resp.time, 0);
    }
  });

  it("Post multiple feature logs (#integration)", async () => {
    let requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4.99");
    const feature1Id: GuidString = Guid.createValue();
    const feature2Id: GuidString = Guid.createValue();
    const entry1 = new FeatureLogEntry(feature1Id, os.hostname(), UsageType.HomeUse);
    entry1.additionalData.imodelid = Guid.createValue();
    entry1.additionalData.imodelsize = "596622";

    // omit product version in second entry
    requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const entry2 = new FeatureLogEntry(feature2Id, os.hostname(), UsageType.Beta);
    entry2.additionalData.imodelid = Guid.createValue();
    entry2.additionalData.imodelsize = "400";
    const resp: LogPostingResponse = await client.logFeatureUsage(requestContext, entry1, entry2);
    assert(resp);
    assert.equal(resp.status, BentleyStatus.SUCCESS);
    assert.equal(resp.message, "Accepted");
    assert.isTrue(Guid.isGuid(resp.requestId));
    assert.isAtLeast(resp.time, 0);

    // test that the method throws if no feature log entry is passed
    let hasThrown: boolean = false;
    try {
      await client.logFeatureUsage(requestContext);
    } catch (e) {
      hasThrown = true;
    }
    assert.isTrue(hasThrown, "Passing no FeatureLogEntry to UlasClient.logFeature is expected to throw.");
  });

  it("Post duration feature log (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43", "3.4");
    const myFeatureId: GuidString = Guid.createValue();
    const startEntry = new StartFeatureLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    startEntry.additionalData.imodelid = Guid.createValue();
    startEntry.additionalData.user = "123-123";

    const startResp: LogPostingResponse = await client.logFeatureUsage(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    const endEntry: EndFeatureLogEntry = EndFeatureLogEntry.createFromStartEntry(startEntry);
    const endResp: LogPostingResponse = await client.logFeatureUsage(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });

  it("Post duration feature log without product version (#integration)", async () => {
    const requestContext = new AuthorizedClientRequestContext(accessToken, undefined, "43");
    const myFeatureId: GuidString = Guid.createValue();
    const startEntry = new StartFeatureLogEntry(myFeatureId, os.hostname(), UsageType.Beta);
    startEntry.additionalData.imodelid = Guid.createValue();
    startEntry.additionalData.user = "123-123";

    const startResp: LogPostingResponse = await client.logFeatureUsage(requestContext, startEntry);
    assert(startResp);
    assert.equal(startResp.status, BentleyStatus.SUCCESS);
    assert.equal(startResp.message, "Accepted");
    assert.isAtLeast(startResp.time, 0);

    const endEntry: EndFeatureLogEntry = EndFeatureLogEntry.createFromStartEntry(startEntry);
    const endResp: LogPostingResponse = await client.logFeatureUsage(requestContext, endEntry);
    assert(endResp);
    assert.equal(endResp.status, BentleyStatus.SUCCESS);
    assert.equal(endResp.message, "Accepted");
    assert.isAtLeast(endResp.time, 0);
  });
});

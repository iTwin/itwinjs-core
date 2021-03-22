/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as os from "os";
import { Config, Guid } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getTestAccessToken, TestBrowserAuthorizationClientConfiguration, TestUsers } from "@bentley/oidc-signin-tool";
import { TelemetryEvent } from "@bentley/telemetry-client";
import { AuthorizedBackendRequestContext, IModelJsNative } from "../../imodeljs-backend";
import { UsageLoggingUtilities } from "../../usage-logging/UsageLoggingUtilities";

// Configuration needed
//    imjs_test_regular_user_name
//    imjs_test_regular_user_password
//    imjs_oidc_ulas_test_client_id
//    imjs_oidc_ulas_test_redirect_uri
//    imjs_oidc_ulas_test_scopes

describe.skip("UsageLoggingUtilities - OIDC Token (#integration)", () => {
  const imodelJsProductId = 2686;
  let requestContext: AuthorizedBackendRequestContext;
  const defaultAuthType = IModelJsNative.AuthType.OIDC;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    const oidcConfig: TestBrowserAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_oidc_ulas_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_ulas_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_ulas_test_scopes"),
    };
    const accessToken = await getTestAccessToken(oidcConfig, TestUsers.regular);
    requestContext = new AuthorizedBackendRequestContext(accessToken);
  });

  it("Check Entitlements (#integration)", async () => {
    const status: IModelJsNative.Entitlement = UsageLoggingUtilities.checkEntitlement(requestContext, Guid.createValue(), defaultAuthType, imodelJsProductId, "localhost");

    assert.equal(status.allowed, true);
    assert.equal(status.usageType, "Production");
  });

  it("Invalid project id check entitlements (#integration)", async () => {
    assert.throws(() => UsageLoggingUtilities.checkEntitlement(requestContext, "", defaultAuthType, imodelJsProductId, "localhost"),
      Error, "Could not validate entitlements");
  });

  it("Invalid app version check entitlements (#integration)", async () => {
    assert.throws(() => UsageLoggingUtilities.checkEntitlement(requestContext, "", defaultAuthType, imodelJsProductId, "localhost"),
      Error, "Could not validate entitlements");
  });

  it("Post usage log (#integration)", async () => {
    for (const usageType of [IModelJsNative.UsageType.Beta, IModelJsNative.UsageType.HomeUse, IModelJsNative.UsageType.PreActivation, IModelJsNative.UsageType.Trial, IModelJsNative.UsageType.Trial]) {
      await UsageLoggingUtilities.postUserUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), usageType);
    }
  });

  it("Post usage log with session id (#integration)", async () => {
    await UsageLoggingUtilities.postUserUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
  });

  it("Post usage log without product version (#integration)", async () => {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43");
    let exceptionThrown = false;
    try {
      await UsageLoggingUtilities.postUserUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
    } catch (err) {
      exceptionThrown = true;
    }

    assert.isFalse(exceptionThrown, "Expected user usage log posted without product version to accepted with a default value productVersion");
  });

  it("Post usage log - invalid usage type (#integration)", async function (this: Mocha.Context) {
    let exceptionThrown = false;
    try {
      const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.5.101");
      await UsageLoggingUtilities.postUserUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), 100 as IModelJsNative.UsageType);
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown, "expected usage log with invalid usage type to be rejected");
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
        tempAccessToken = new AccessToken(JSON.stringify({ ForeignProjectAccessToken: {} }))!; // eslint-disable-line @typescript-eslint/naming-convention
      } else {
        // token from which some user profile information is removed. UlasClient does not utilize this information, and instead defers this task to the ULAS server, which examines the token string itself.
        tempAccessToken = requestContext.accessToken;

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

      const assertMessage = passingTokenModes.includes(mode)
        ? `is expected to pass for token mode: ${TokenMode[mode]}`
        : `is expected to throw for token mode: ${TokenMode[mode]} because it lacks required user profile info`;

      let tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.5.101");
      let exceptionThrown = false;
      try {
        await UsageLoggingUtilities.postUserUsage(tempRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
      } catch (err) {
        exceptionThrown = true;
      }
      // NEEDS_WORK: Temporarily disabled await for native logging requests (See VSTS#394565)
      // assert.equal(exceptionThrown, !passingTokenModes.includes(mode), `UlasClient.logUsage ${assertMessage}.`);

      tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.99");
      try {
        await UsageLoggingUtilities.postFeatureUsage(tempRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
      } catch (error) {
        exceptionThrown = true;
      }
      assert.equal(exceptionThrown, !passingTokenModes.includes(mode), `UlasClient.trackFeature ${assertMessage}.`);
    }
  });

  it("Post feature log (#integration)", async () => {
    for (const usageType of [IModelJsNative.UsageType.Beta, IModelJsNative.UsageType.HomeUse, IModelJsNative.UsageType.PreActivation, IModelJsNative.UsageType.Trial, IModelJsNative.UsageType.Trial]) {
      await UsageLoggingUtilities.postFeatureUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), usageType);
    }
  });

  it("Post feature log with project id (#integration)", async () => {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, Guid.createValue());
  });

  it("Post feature log with invalid project id (#integration)", async () => {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    let exceptionThrown = false;
    try {
      await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, "Non-Guid project id");
    } catch (err) {
      exceptionThrown = true;
    }
    assert.isFalse(exceptionThrown, "Providing an invalid projectId is not expected to fail. The invalid projectId should be ignored.");
  });

  it("Post feature log without product version (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43");
    let exceptionThrown = false;
    try {
      await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
    } catch (err) {
      exceptionThrown = true;
    }

    assert.isFalse(exceptionThrown, "Expected feature usage log posted without product version to accepted with a default value productVersion");
  });

  it("Post feature log - with both startDate and endDate (#integration)", async function (this: Mocha.Context) {
    const startDate = new Date();
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const endDate = new Date();
    await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, undefined, startDate, endDate);
  });

  it("Post feature log - with startDate and no endDate (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const startDate = new Date();
    await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, undefined, startDate);
  });

  it("Post feature log - with endDate and no startDate (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const endDate = new Date();
    await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, undefined, undefined, endDate);
  });

  it("Post feature log - with no startDate or endDate (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    let exceptionThrown = false;
    try {
      await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, undefined, undefined, undefined);
    } catch (err) {
      exceptionThrown = true;
    }

    assert.isFalse(exceptionThrown, "Sending undefined start and end dates when posting feature logs should not throw an exception.");
  });

  it("Post feature log - with additional metadata (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const metadata = {
      iModelId: Guid.createValue(),
      iModelJsVersion: "1.2.3.4",
    };
    await UsageLoggingUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial, undefined, undefined, undefined, metadata);
  });

  it("Post feature log - from telemetry data (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const telemetryData = new TelemetryEvent(
      "UsageLoggingUtilities TestFeature",
      "fa1c504d-3bdc-4718-95af-5fdf08a176af",
      Guid.createValue(),
      Guid.createValue(),
      Guid.createValue(),
    );

    UsageLoggingUtilities.configure({
      hostApplicationId: "43",
      hostApplicationVersion: "4.5.6",
    });
    await UsageLoggingUtilities.postFeatureUsageFromTelemetry(localRequestContext, telemetryData, IModelJsNative.UsageType.Trial);
  });
});

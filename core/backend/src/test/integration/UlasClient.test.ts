/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext, Config } from "@bentley/imodeljs-clients";
import { getTestOidcToken, TestOidcConfiguration, TestUsers } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as os from "os";
import { AuthorizedBackendRequestContext, IModelJsNative } from "../../imodeljs-backend";
import { AdditionalFeatureData, UlasUtilities } from "../../ulas/UlasUtilities";
import { IModelTestUtils } from "../IModelTestUtils";

// Configuration needed
//    imjs_test_regular_user_name
//    imjs_test_regular_user_password
//    imjs_oidc_ulas_test_client_id
//    imjs_oidc_ulas_test_redirect_uri
//    imjs_oidc_ulas_test_scopes

describe("UlasUtilities - OIDC Token (#integration)", () => {
  const imodelJsProductId = 2686;
  let requestContext: AuthorizedBackendRequestContext;
  const defaultAuthType = IModelJsNative.AuthType.OIDC;

  before(async () => {
    IModelTestUtils.setupLogging();
    IModelTestUtils.setupDebugLogLevels();

    const oidcConfig: TestOidcConfiguration = {
      clientId: Config.App.getString("imjs_oidc_ulas_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_ulas_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_ulas_test_scopes"),
    };
    const accessToken = await getTestOidcToken(oidcConfig, TestUsers.regular);
    requestContext = new AuthorizedBackendRequestContext(accessToken);
  });

  after(async () => {
    IModelTestUtils.resetDebugLogLevels();
  });

  it("Check Entitlements (#integration)", async function (this: Mocha.Context) {
    const status: IModelJsNative.Entitlement = UlasUtilities.checkEntitlement(requestContext, Guid.createValue(), defaultAuthType, imodelJsProductId, "localhost");

    assert.equal(status.allowed, true);
    assert.equal(status.usageType, "Production");
  });

  it("Invalid project id check entitlements (#integration)", async function (this: Mocha.Context) {
    let exceptionThrown = false;
    try {
      UlasUtilities.checkEntitlement(requestContext, "", defaultAuthType, imodelJsProductId, "localhost");
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
  });

  it("Invalid app version check entitlements (#integration)", async function (this: Mocha.Context) {
    let exceptionThrown = false;
    try {
      UlasUtilities.checkEntitlement(requestContext, "", defaultAuthType, imodelJsProductId, "localhost");
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
  });

  it("Post usage log (#integration)", async function (this: Mocha.Context) {
    for (const usageType of [IModelJsNative.UsageType.Beta, IModelJsNative.UsageType.HomeUse, IModelJsNative.UsageType.PreActivation, IModelJsNative.UsageType.Production, IModelJsNative.UsageType.Trial]) {
      UlasUtilities.postUserUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), usageType);
    }
  });

  it("Post usage log with session id (#integration)", async function (this: Mocha.Context) {
    UlasUtilities.postUserUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
  });

  it("Post usage log without product version (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43");
    let exceptionThrown = false;
    try {
      UlasUtilities.postUserUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
    } catch (err) {
      exceptionThrown = true;
    }

    assert.isTrue(exceptionThrown, "Expected usage log posted without product version to be rejected");
  });

  it("Post usage log - hostName special cases (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.5");
    for (const hostName of [
      "::1",
      "127.0.0.1",
      "localhost",
    ]) {
      UlasUtilities.postUserUsage(localRequestContext, Guid.createValue(), defaultAuthType, hostName, IModelJsNative.UsageType.Beta);
    }
  });

  it("Post usage log - invalid usage type (#integration)", async function (this: Mocha.Context) {
    let exceptionThrown = false;
    try {
      const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.5.101");
      UlasUtilities.postUserUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), 100 as IModelJsNative.UsageType);
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown, "expected usage log with invalid usage type to be rejected");
  });

  it("AccessToken without feature tracking claims (#integration)", async function (this: Mocha.Context) {
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
        UlasUtilities.postUserUsage(tempRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production);
      } catch (err) {
        exceptionThrown = true;
      }
      assert.equal(exceptionThrown, !passingTokenModes.includes(mode), `UlasClient.logUsage ${assertMessage}.`);

      tempRequestContext = new AuthorizedClientRequestContext(tempAccessToken, undefined, "43", "3.4.99");
      try {
        UlasUtilities.postFeatureUsage(tempRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Trial);
      } catch (error) {
        exceptionThrown = true;
      }
      assert.equal(exceptionThrown, !passingTokenModes.includes(mode), `UlasClient.trackFeature ${assertMessage}.`);
    }
  });

  it("Post feature log (#integration)", async function (this: Mocha.Context) {
    for (const usageType of [IModelJsNative.UsageType.Beta, IModelJsNative.UsageType.HomeUse, IModelJsNative.UsageType.PreActivation, IModelJsNative.UsageType.Production, IModelJsNative.UsageType.Trial]) {
      UlasUtilities.postFeatureUsage(requestContext, Guid.createValue(), defaultAuthType, os.hostname(), usageType);
    }
  });

  it("Post feature log with project id (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    UlasUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production, Guid.createValue());
  });

  it("Post feature log with invalid project id (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    let exceptionThrown = false;
    try {
      UlasUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production, "Non-Guid project id");
    } catch (err) {
      exceptionThrown = true;
    }
    assert.isFalse(exceptionThrown, "Providing an invalid projectId is not expected to fail. The invalid projectId should be ignored.");
  });

  it("Post feature log without product version (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43");
    let exceptionThrown = false;
    try {
      UlasUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production);
    } catch (err) {
      exceptionThrown = true;
    }

    assert.isTrue(exceptionThrown, "Attempting to track feature logs without a product version should throw an exception.");
  });

  it("Post feature log - hostName special cases (#integration)", async function (this: Mocha.Context) {
    for (const hostName of [
      "::1",
      "127.0.0.1",
      "localhost",
    ]) {
      UlasUtilities.postFeatureUsage(requestContext, Guid.createValue(), defaultAuthType, hostName, IModelJsNative.UsageType.Production);
    }
  });

  it("Post feature log - with startDate and endDate (#integration)", async function (this: Mocha.Context) {
    const startDate = new Date();
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const endDate = new Date();
    UlasUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production, undefined, startDate, endDate);
  });

  it("Post feature log - with additional metadata (#integration)", async function (this: Mocha.Context) {
    const localRequestContext = new AuthorizedClientRequestContext(requestContext.accessToken, undefined, "43", "3.4.99");
    const metadata: AdditionalFeatureData = {
      iModelId: Guid.createValue(),
      iModelJsVersion: "1.2.3.4",
    };
    UlasUtilities.postFeatureUsage(localRequestContext, Guid.createValue(), defaultAuthType, os.hostname(), IModelJsNative.UsageType.Production, undefined, undefined, undefined, metadata);
  });
});

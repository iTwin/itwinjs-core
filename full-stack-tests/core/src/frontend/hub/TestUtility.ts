/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AccessToken, GuidString, Logger } from "@bentley/bentleyjs-core";
import { ITwin } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelApp, NativeApp, NativeAppAuthorization } from "@bentley/imodeljs-frontend";
import { getAccessTokenFromBackend, TestUserCredentials } from "@bentley/oidc-signin-tool/lib/frontend";
import { IModelHubUserMgr } from "../../common/IModelHubUserMgr";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { ITwinPlatformAbstraction, ITwinPlatformCloudEnv, ITwinStackCloudEnv } from "./ITwinPlatformEnv";

export class TestUtility {
  public static testContextName = "iModelJsIntegrationTest";
  public static testIModelNames = {
    noVersions: "NoVersionsTest",
    stadium: "Stadium Dataset 1",
    readOnly: "ReadOnlyTest",
    readWrite: "ReadWriteTest",
    connectionRead: "ConnectionReadTest",
    smallTex: "SmallTex",
    sectionDrawingLocations: "SectionDrawingLocations",
    // Includes a display style with a schedule script embedded in JSON.
    synchro: "SYNCHRO.UTK",
    // A version of the above that uses BisCore 1.0.13 and includes a second display style with schedule script stored
    // separately on a RenderTimeline element.
    synchroNew: "SYNCHRO.UTK.1.0.13",
  };

  public static testSnapshotIModels = {
    mirukuru: "mirukuru.ibim",
  };

  private static iTwinId: GuidString | undefined = undefined;
  /** Returns the ContextId if a Context with the name exists. Otherwise, returns undefined. */
  public static async getTestContextId(): Promise<GuidString> {
    if (undefined !== TestUtility.iTwinId)
      return TestUtility.iTwinId;
    return TestUtility.queryContextIdByName(TestUtility.testContextName);
  }

  public static itwinPlatformEnv: ITwinPlatformAbstraction;

  public static async getAccessToken(user: TestUserCredentials): Promise<AccessToken> {
    return getAccessTokenFromBackend(user);
  }

  /** The initialize methods wraps creating and setting up all of the clients needed to perform integrations tests. If a user is provided,
   * a headless sign-in will be attempted in both Web and Electron setups.
   *
   * By default, it will setup the tests to use the iTwin Platform but can be configured to use an iTwin Stack implementation as well.
   *
   * @param user The user to sign-in with to perform all of the tests.
   */
  public static async initialize(user?: TestUserCredentials): Promise<void> {
    // If provided, create, setup and sign-in with the Auth client.
    let authorizationClient: FrontendAuthorizationClient | undefined;
    if (user) {
      if (NativeApp.isValid) {
        authorizationClient = new NativeAppAuthorization({ clientId: "testapp", redirectUri: "", scope: "" });
        await NativeApp.callNativeHost("setAccessToken", (await getAccessTokenFromBackend(user)));
      } else {
        authorizationClient = new IModelHubUserMgr(user);
        await authorizationClient.signIn();
      }
    }

    const cloudParams = await TestRpcInterface.getClient().getCloudEnv();
    if (cloudParams.iModelBank)
      this.itwinPlatformEnv = new ITwinStackCloudEnv(cloudParams.iModelBank.url);
    else
      this.itwinPlatformEnv = new ITwinPlatformCloudEnv(authorizationClient);
  }

  public static async queryContextIdByName(contextName: string): Promise<string> {
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken())!;
    const iTwin: ITwin = await this.itwinPlatformEnv.contextMgr.getITwinByName(accessToken, contextName);
    assert(iTwin && iTwin.id);
    return iTwin.id;
  }

  public static async queryIModelIdbyName(iTwinId: string, iModelName: string): Promise<string> {
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken())!;
    const iModelId = await this.itwinPlatformEnv.hubAccess.queryIModelByName({ accessToken: accessToken, iTwinId, iModelName });
    assert.isDefined(iModelId);
    return iModelId!;
  }

  /** Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded */
  public static async purgeAcquiredBriefcases(iModelId: string, acquireThreshold: number = 16): Promise<void> {
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken())!;
    const briefcaseIds = await this.itwinPlatformEnv.hubAccess.getMyBriefcaseIds({ accessToken, iModelId });

    if (briefcaseIds.length > acquireThreshold) {
      Logger.logInfo("TestUtility", `Reached limit of maximum number of briefcases for ${iModelId}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      for (const briefcaseId of briefcaseIds)
        promises.push(this.itwinPlatformEnv.hubAccess.releaseBriefcase({ accessToken, iModelId, briefcaseId }));
      await Promise.all(promises);
    }
  }
}

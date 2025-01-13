/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AccessToken, GuidString, Logger, ProcessDetector } from "@itwin/core-bentley";
import { ITwin } from "@itwin/itwins-client";
import { AuthorizationClient } from "@itwin/core-common";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/Renderer";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp, IModelAppOptions, LocalhostIpcApp, MockRender, NativeApp } from "@itwin/core-frontend";
import { getAccessTokenFromBackend, TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { IModelHubUserMgr } from "../common/IModelHubUserMgr";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { ITwinPlatformAbstraction, ITwinPlatformCloudEnv } from "./hub/ITwinPlatformEnv";
import { setBackendAccessToken } from "../certa/certaCommon";

export class TestUtility {
  public static testITwinName = "iModelJsIntegrationTest";
  public static testIModelNames = {
    codePush: "CodesPushTest",
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
    realityDataAccess: "Tuxford_qa",
  };

  public static testSnapshotIModels = {
    mirukuru: "mirukuru.ibim",
  };

  private static iTwinId: GuidString | undefined = undefined;
  /** Returns the iTwinId if an iTwin with the name exists. Otherwise, returns undefined. */
  public static async getTestITwinId(): Promise<GuidString> {
    if (undefined !== TestUtility.iTwinId)
      return TestUtility.iTwinId;
    TestUtility.iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    return TestUtility.iTwinId;
  }

  public static iTwinPlatformEnv: ITwinPlatformAbstraction;

  public static async getAccessToken(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
    return getAccessTokenFromBackend(user, oidcConfig);
  }

  /** The initialize methods wraps creating and setting up all of the clients needed to perform integrations tests. If a user is provided,
   * a headless sign-in will be attempted in both Web and Electron setups.
   *
   * By default, it will setup the tests to use the iTwin Platform but can be configured to use an iTwin Stack implementation as well.
   *
   * @param user The user to sign-in with to perform all of the tests.
   */
  public static async initialize(user: TestUserCredentials): Promise<void> {
    // If provided, create, setup and sign-in with the Auth client.
    if (!IModelApp.initialized)
      throw new Error("IModelApp must be initialized");

    let authorizationClient: AuthorizationClient | undefined;
    if (NativeApp.isValid) {
      authorizationClient = new ElectronRendererAuthorization(
        { clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID! },
      );
      IModelApp.authorizationClient = authorizationClient;
      const accessToken = await setBackendAccessToken(user);
      if ("" === accessToken)
        throw new Error("no access token");

    } else {
      authorizationClient = new IModelHubUserMgr(user);
      IModelApp.authorizationClient = authorizationClient;
      await (authorizationClient as IModelHubUserMgr).signIn();
    }

    this.iTwinPlatformEnv = new ITwinPlatformCloudEnv(authorizationClient);

    ((IModelApp as any)._hubAccess) = this.iTwinPlatformEnv.hubAccess;
  }

  public static async queryITwinIdByName(iTwinName: string): Promise<string> {
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      throw new Error("no access token");

    const iTwin: ITwin = await this.iTwinPlatformEnv.iTwinMgr.getITwinByName(accessToken, iTwinName);
    assert(iTwin && iTwin.id);
    return iTwin.id;
  }

  public static async queryIModelIdByName(iTwinId: string, iModelName: string): Promise<string> {
    const accessToken = await IModelApp.getAccessToken();
    const iModelId = await this.iTwinPlatformEnv.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
    assert.isDefined(iModelId);
    if (!iModelId)
      throw new Error("no access token");
    return iModelId;
  }

  /** Purges all acquired briefcases for the current user for the specified iModel, if the specified threshold of acquired briefcases is exceeded */
  public static async purgeAcquiredBriefcases(iModelId: string, acquireThreshold: number = 16): Promise<void> {
    const accessToken = await IModelApp.getAccessToken();
    const briefcaseIds = await this.iTwinPlatformEnv.hubAccess.getMyBriefcaseIds({ accessToken, iModelId });

    if (briefcaseIds.length > acquireThreshold) {
      Logger.logInfo("TestUtility", `Reached limit of maximum number of briefcases for ${iModelId}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      for (const briefcaseId of briefcaseIds)
        promises.push(this.iTwinPlatformEnv.hubAccess.releaseBriefcase({ accessToken, iModelId, briefcaseId }));
      await Promise.all(promises);
    }
  }

  public static get iModelAppOptions(): IModelAppOptions {
    return {
      applicationVersion: "1.2.1.1",
      rpcInterfaces,
    };
  }

  public static systemFactory: MockRender.SystemFactory = () => TestUtility.createDefaultRenderSystem();
  private static createDefaultRenderSystem() { return new MockRender.System(); }

  /** Helper around the different startup workflows for different app types.
   * If running in an Electron render process (via ProcessDetector.isElectronAppFrontend), the ElectronApp.startup is called.
   *
   * Otherwise, IModelApp.startup is used directly.
   */
  public static async startFrontend(opts?: IModelAppOptions, mockRender?: boolean, enableWebEdit?: boolean): Promise<void> {
    const iopts = { ...TestUtility.iModelAppOptions, ...opts };
    if (mockRender)
      iopts.renderSys = this.systemFactory();

    if (ProcessDetector.isElectronAppFrontend) {
      // electron version of certa does not serve assets like worker scripts.
      if (iopts.tileAdmin)
        iopts.tileAdmin.decodeImdlInWorker = false;
      else
        iopts.tileAdmin = { decodeImdlInWorker: false };

      return ElectronApp.startup({ iModelApp: iopts });
    }

    if (enableWebEdit) {
      let socketUrl = new URL(window.location.toString());
      socketUrl.port = (parseInt(socketUrl.port, 10) + 2000).toString();
      socketUrl = LocalhostIpcApp.buildUrlForSocket(socketUrl);

      return LocalhostIpcApp.startup({ iModelApp: iopts, localhostIpcApp: { socketUrl } });
    } else {
      return IModelApp.startup(iopts);
    }
  }

  /** Helper around the different shutdown workflows for different app types.
   * If running in an Electron render process (via ProcessDetector.isElectronAppFrontend), the ElectronApp.startup is called.
   */
  public static async shutdownFrontend(): Promise<void> {
    this.systemFactory = () => TestUtility.createDefaultRenderSystem();

    if (ProcessDetector.isElectronAppFrontend)
      return ElectronApp.shutdown();

    return IModelApp.shutdown();
  }
}

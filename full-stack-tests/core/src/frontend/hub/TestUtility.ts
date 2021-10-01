/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AccessToken, GuidString, Logger } from "@itwin/core-bentley";
import { ITwin } from "@bentley/itwin-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { Briefcase, BriefcaseQuery, IModelCloudEnvironment, IModelQuery } from "@bentley/imodelhub-client";
import { IModelApp, IModelHubFrontend } from "@itwin/core-frontend";
import { AuthorizationClient } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials } from "@itwin/oidc-signin-tool/lib/frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { IModelBankCloudEnv } from "./IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./IModelHubCloudEnv";
import { ITwin } from "@bentley/itwin-registry-client";

export class TestUtility {
  public static testITwinName = "iModelJsIntegrationTest";
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
  /** Returns the iTwinId if an iTwin with the name exists. Otherwise, returns undefined. */
  public static async getTestITwinId(): Promise<GuidString> {
    if (undefined !== TestUtility.iTwinId)
      return TestUtility.iTwinId;
    return TestUtility.queryITwinIdByName(TestUtility.testITwinName);
  }

  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async getAccessToken(user: TestUserCredentials): Promise<AccessToken> {
    return getAccessTokenFromBackend(user);
  }

  public static async initializeTestProject(testITwinName: string, user: TestUserCredentials): Promise<AuthorizationClient> {
    const cloudParams = await TestRpcInterface.getClient().getCloudEnv();
    if (cloudParams.iModelBank) {
      this.imodelCloudEnv = new IModelBankCloudEnv(cloudParams.iModelBank.url, false);
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    const authorizationClient = this.imodelCloudEnv.getAuthorizationClient(user) as FrontendAuthorizationClient;
    await authorizationClient.signIn();
    const accessToken = (await authorizationClient.getAccessToken())!;
    if (this.imodelCloudEnv instanceof IModelBankCloudEnv) {
      await this.imodelCloudEnv.bootstrapIModelBankITwin(accessToken, testITwinName);
    }

    return authorizationClient;
  }

  public static async queryITwinIdByName(iTwinName: string): Promise<string> {
    const accessToken = await IModelApp.getAccessToken();
    const iTwin: ITwin = await this.imodelCloudEnv.iTwinMgr.getITwinByName(accessToken, iTwinName);
    assert(iTwin && iTwin.id);
    return iTwin.id;
  }

  public static async queryIModelIdByName(iTwinId: string, iModelName: string): Promise<string> {
    const accessToken = await IModelApp.getAccessToken();
    const iModels = await this.imodelCloudEnv.imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

  /** Purges all acquired briefcases for the current user for the specified iModel, if the specified threshold of acquired briefcases is exceeded */
  public static async purgeAcquiredBriefcases(iModelId: string, acquireThreshold: number = 16): Promise<void> {
    const accessToken = await IModelApp.getAccessToken();
    const briefcases = await IModelHubFrontend.iModelClient.briefcases.get(accessToken, iModelId, new BriefcaseQuery().ownedByMe());
    if (briefcases.length > acquireThreshold) {
      Logger.logInfo("TestUtility", `Reached limit of maximum number of briefcases for ${iModelId}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: Briefcase) => {
        promises.push(IModelHubFrontend.iModelClient.briefcases.delete(accessToken, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }
}

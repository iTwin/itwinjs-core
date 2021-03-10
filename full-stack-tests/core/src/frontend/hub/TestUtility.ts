/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Guid, Id64String, Logger } from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { BriefcaseQuery, Briefcase as HubBriefcase, IModelCloudEnvironment, IModelQuery, LockLevel, LockQuery } from "@bentley/imodelhub-client";
import { AuthorizedFrontendRequestContext, IModelApp, IModelConnection, NativeApp, NativeAppAuthorization } from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials } from "@bentley/oidc-signin-tool/lib/frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { IModelBankCloudEnv } from "./IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./IModelHubCloudEnv";

export class TestUtility {
  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async getAuthorizedClientRequestContext(user: TestUserCredentials): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext(accessToken);
  }

  public static async initializeTestProject(testProjectName: string, user: TestUserCredentials): Promise<FrontendAuthorizationClient> {
    const cloudParams = await TestRpcInterface.getClient().getCloudEnv();
    if (cloudParams.iModelBank) {
      this.imodelCloudEnv = new IModelBankCloudEnv(cloudParams.iModelBank.url, false);
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    let authorizationClient: FrontendAuthorizationClient;
    if (NativeApp.isValid) {
      authorizationClient = new NativeAppAuthorization({ clientId: "testapp", redirectUri: "", scope: "" });
      await NativeApp.callNativeHost("silentLogin", (await getAccessTokenFromBackend(user)).toJSON());
    } else {
      authorizationClient = this.imodelCloudEnv.getAuthorizationClient(undefined, user);
      await authorizationClient.signIn();
    }
    const accessToken = await authorizationClient.getAccessToken();
    if (this.imodelCloudEnv instanceof IModelBankCloudEnv) {
      await this.imodelCloudEnv.bootstrapIModelBankProject(new AuthorizedClientRequestContext(accessToken), testProjectName);
    }

    return authorizationClient;
  }

  public static async getTestProjectId(projectName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const project: Project = await this.imodelCloudEnv.contextMgr.queryProjectByName(requestContext, projectName);
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(projectId: string, iModelName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const iModels = await this.imodelCloudEnv.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

  public static async createIModel(name: string, contextId: string, deleteIfExists = false) {
    return TestRpcInterface.getClient().createIModel(name, contextId, deleteIfExists);
  }

  public static async deleteIModel(id: string, contextId: string) {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await this.imodelCloudEnv.imodelClient.iModels.delete(requestContext, contextId, id);
  }

  /** Generate a name (for an iModel) that's unique */
  public static generateUniqueName(baseName: string) {
    return `${baseName} - ${Guid.createValue()}`;
  }

  public static async getModelLockLevel(iModel: IModelConnection, modelId: Id64String): Promise<LockLevel> {
    const req = new AuthorizedClientRequestContext(await IModelApp.authorizationClient!.getAccessToken());
    const lockedModels = await IModelApp.iModelClient.locks.get(req, iModel.iModelId!, new LockQuery().byObjectId(modelId));
    if (lockedModels.length === 0 || lockedModels[0].lockLevel === undefined)
      return LockLevel.None;
    return lockedModels[0].lockLevel;
  }

  /** Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded */
  public static async purgeAcquiredBriefcases(iModelId: string, acquireThreshold: number = 16): Promise<void> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const briefcases: HubBriefcase[] = await IModelApp.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe());
    if (briefcases.length > acquireThreshold) {
      Logger.logInfo("TestUtility", `Reached limit of maximum number of briefcases for ${iModelId}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(IModelApp.iModelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }
}

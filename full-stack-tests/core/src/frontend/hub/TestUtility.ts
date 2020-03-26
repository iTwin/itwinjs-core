/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Project, IModelQuery, Briefcase as HubBriefcase, BriefcaseQuery, AccessToken, AuthorizedClientRequestContext, LockLevel, LockQuery } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Logger, ClientRequestContext, Id64String } from "@bentley/bentleyjs-core";
import { IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { IModelBankCloudEnv } from "./IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./IModelHubCloudEnv";

import { TestUserCredentials, getAccessTokenFromBackend } from "@bentley/oidc-signin-tool/lib/frontend";

export class TestUtility {
  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async getAuthorizedClientRequestContext(user: TestUserCredentials): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext(accessToken);
  }

  public static async initializeTestProject(testProjectName: string, user: TestUserCredentials): Promise<AccessToken> {
    const cloudParams = await TestRpcInterface.getClient().getCloudEnv();
    if (cloudParams.iModelBank) {
      this.imodelCloudEnv = new IModelBankCloudEnv(cloudParams.iModelBank.url, false);
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    const accessToken = await this.imodelCloudEnv.authorization.authorizeUser(new ClientRequestContext(), undefined, user);

    if (this.imodelCloudEnv instanceof IModelBankCloudEnv) {
      await this.imodelCloudEnv.bootstrapIModelBankProject(new AuthorizedClientRequestContext(accessToken), testProjectName);
    }

    return accessToken;
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

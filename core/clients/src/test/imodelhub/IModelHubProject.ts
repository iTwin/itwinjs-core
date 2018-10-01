/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, UserProfile, ConnectClient, Project, IModelClient, DeploymentEnv } from "../..";
import { IModelHubClient, IModelQuery } from "../..";
import { TestConfig } from "../TestConfig";
import { HubIModel } from "../../imodelhub";
import { IModelProjectClient, IModelProjectIModelCreateParams, IModelOrchestrationClient, IModelAuthorizationClient, IModelCloudEnvironment } from "../../IModelCloudEnvironment";
import { getDefaultClient } from "./TestUtils";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Guid } from "../../../node_modules/@bentley/bentleyjs-core/lib/Id";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestIModelHubProject extends IModelProjectClient {
  public terminate(): void { }

  public async queryProject(alctx: ActivityLoggingContext, accessToken: AccessToken, query: any | undefined): Promise<Project> {
    const client = await new ConnectClient(TestConfig.deploymentEnv);
    return client.getProject(alctx, accessToken, query);
  }
  public async createIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, params: IModelProjectIModelCreateParams): Promise<HubIModel> {
    const client = getDefaultClient();
    return client.IModels().create(alctx, accessToken, projectId, params.name, params.seedFile, params.description, params.tracker);
  }
  public deleteIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: Guid): Promise<void> {
    const client = getDefaultClient();
    return client.IModels().delete(alctx, accessToken, projectId, iModelId);
  }
  public async queryIModels(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = getDefaultClient();
    return client.IModels().get(alctx, accessToken, projectId, query);
  }
}

class TestIModelHubOrchestrator implements IModelOrchestrationClient {
  public getClientForIModel(_alctx: ActivityLoggingContext, _projectId: string, _imodelId: Guid): Promise<IModelClient> {
    return Promise.resolve(getDefaultClient());
  }
}

class TestIModelHubUserMgr implements IModelAuthorizationClient {
  public async authorizeUser(alctx: ActivityLoggingContext, _userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken> {
    const authToken = await TestConfig.login(userCredentials, env);
    const client = getDefaultClient() as IModelHubClient;
    return client.getAccessToken(alctx, authToken);
  }
}

export class TestIModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly project = new TestIModelHubProject();
  public readonly orchestrator = new TestIModelHubOrchestrator();
  public readonly authorization = new TestIModelHubUserMgr();
  public terminate(): void { }
}

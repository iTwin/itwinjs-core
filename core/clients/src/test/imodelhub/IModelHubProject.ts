/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, UserProfile, ConnectClient, Project, IModelClient, DeploymentEnv } from "../..";
import { IModelHubClient, IModelQuery } from "../..";
import { TestConfig } from "../TestConfig";
import { IModelRepository } from "../../imodelhub";
import { IModelProjectAbstraction, IModelProjectAbstractionIModelCreateParams, IModelServerOrchestrator } from "../../IModelProjectAbstraction";
import { getDefaultClient } from "./TestUtils";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
export class TestIModelHubProject extends IModelProjectAbstraction {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }
  public async authorizeUser(alctx: ActivityLoggingContext, _userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken> {
    const authToken = await TestConfig.login(userCredentials, env);
    const client = getDefaultClient() as IModelHubClient;
    return client.getAccessToken(alctx, authToken);
  }
  public async queryProject(alctx: ActivityLoggingContext, accessToken: AccessToken, query: any | undefined): Promise<Project> {
    const client = await new ConnectClient(TestConfig.deploymentEnv);
    return client.getProject(alctx, accessToken, query);
  }
  public async createIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, params: IModelProjectAbstractionIModelCreateParams): Promise<IModelRepository> {
    const client = getDefaultClient();
    return client.IModels().create(alctx, accessToken, projectId, params.name, params.seedFile, params.description, params.tracker);
  }
  public deleteIModel(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: string): Promise<void> {
    const client = getDefaultClient();
    return client.IModels().delete(alctx, accessToken, projectId, iModelId);
  }
  public async queryIModels(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<IModelRepository[]> {
    const client = getDefaultClient();
    return client.IModels().get(alctx, accessToken, projectId, query);
  }
}

export class TestIModelHubServerOrchestrator implements IModelServerOrchestrator {
  public getClientForIModel(_alctx: ActivityLoggingContext, _projectId: string, _imodelId: string): IModelClient {
    return getDefaultClient();
  }
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, UserProfile, ConnectClient, Project, IModelClient, DeploymentEnv } from "../..";
import { IModelHubClient, IModelQuery } from "../..";
import { TestConfig } from "../TestConfig";
import { IModelRepository } from "../../imodelhub";
import { IModelProjectAbstraction, IModelProjectAbstractionIModelCreateParams } from "../../IModelProjectAbstraction";
import { getDefaultClient } from "./TestUtils";

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
export class TestIModelHubProject extends IModelProjectAbstraction {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }
  public async authorizeUser(_userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken> {
    const authToken = await TestConfig.login(userCredentials, env);
    const client = getDefaultClient() as IModelHubClient;
    return client.getAccessToken(authToken);
  }
  public async queryProject(accessToken: AccessToken, query: any | undefined): Promise<Project> {
    const client = await new ConnectClient(TestConfig.deploymentEnv);
    return client.getProject(accessToken, query);
  }
  public async createIModel(accessToken: AccessToken, projectId: string, params: IModelProjectAbstractionIModelCreateParams): Promise<IModelRepository> {
    const client = getDefaultClient();
    return client.IModels().create(accessToken, projectId, params.name, params.seedFile, params.description, params.tracker);
  }
  public deleteIModel(accessToken: AccessToken, projectId: string, iModelId: string): Promise<void> {
    const client = getDefaultClient();
    return client.IModels().delete(accessToken, projectId, iModelId);
  }
  public async queryIModels(accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<IModelRepository[]> {
    const client = getDefaultClient();
    return client.IModels().get(accessToken, projectId, query);
  }
  public getClientForIModel(_projectId: string, _imodelId: string): IModelClient {
    return getDefaultClient();
  }
}

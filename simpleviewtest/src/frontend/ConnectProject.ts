/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ConnectClient, AccessToken, Project, ConnectRequestQueryOptions, IModelHubClient, IModelQuery, IModelRepository, VersionQuery, Version, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, IModelClient, DeploymentEnv } from "@bentley/imodeljs-clients/lib";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend";
import { IModelVersion } from "@bentley/imodeljs-common/lib/common";
import { OpenMode } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { showStatus } from "./Utils";
import { SimpleViewState } from "./SimpleViewState";

/** Parameters for starting SimpleViewTest with a specified initial configuration */
interface ConnectProjectConfiguration {
  userName: string;
  password: string;
  projectName: string;
  iModelName: string;
}

export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

class ProjectApi {
  private static connectClient: ConnectClient;

  // Initialize the project Api
  public static async init(env: DeploymentEnv): Promise<void> {
    ProjectApi.connectClient = new ConnectClient(env);
  }

  public static async getProjectByName(accessToken: AccessToken, projectScope: ProjectScope, projectName: string): Promise<Project | undefined> {

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: 100,
      $skip: 0,
    };

    let projectList: Project[] = [];
    if (projectScope === ProjectScope.Invited) {
      projectList = await ProjectApi.connectClient.getInvitedProjects(accessToken, queryOptions);
    }

    if (projectScope === ProjectScope.Favorites) {
      queryOptions.isFavorite = true;
    } else if (projectScope === ProjectScope.MostRecentlyUsed) {
      queryOptions.isMRU = true;
    }

    projectList = await ProjectApi.connectClient.getProjects(accessToken, queryOptions);

    for (const thisProject of projectList) {
      if (thisProject.name === projectName)
        return thisProject;
    }
    return undefined;
  }
}

class IModelApi {
  private static imodelClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  public static async init(env: DeploymentEnv): Promise<void> {
    IModelApi.imodelClient = new IModelHubClient(env);
  }

  /** Get all iModels in a project */
  public static async getIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<IModelRepository | undefined> {
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(100).skip(0);
    const iModels: IModelRepository[] = await IModelApi.imodelClient.IModels().get(accessToken, projectId, queryOptions);
    if (iModels.length < 1)
      return undefined;
    for (const thisIModel of iModels) {
      if (thisIModel.name === iModelName) {
        const versions: Version[] = await IModelApi.imodelClient.Versions().get(accessToken, thisIModel.wsgId, new VersionQuery().select("Name,ChangeSetId").top(1));
        if (versions.length > 0) {
          thisIModel.latestVersionName = versions[0].name;
          thisIModel.latestVersionChangeSetId = versions[0].changeSetId;
        }
        return thisIModel;
      }
    }
    return undefined;
  }

  /** Open the specified version of the IModel */
  public static async openIModel(accessToken: AccessToken, projectId: string, iModelId: string, changeSetId: string | undefined, openMode: OpenMode): Promise<IModelConnection> {
    return await IModelConnection.open(accessToken!, projectId, iModelId, openMode, changeSetId ? IModelVersion.asOfChangeSet(changeSetId) : IModelVersion.latest());
  }
}

// Logic to establish a connection to a Connect-hosted project and iModel
export class ConnectProject {
  private _cfg: ConnectProjectConfiguration = { userName: "", password: "", projectName: "", iModelName: "" };
  private _env: DeploymentEnv;

  constructor(env: DeploymentEnv) {
    this._env = env;
  }

  // Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
  public readConfiguration(): Promise<void> {
    return new Promise((resolve, _reject) => {
      const request: XMLHttpRequest = new XMLHttpRequest();
      request.open("GET", "connect-configuration.json", false);
      request.setRequestHeader("Cache-Control", "no-cache");
      request.onreadystatechange = ((_event: Event) => {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            const newConfigurationInfo: any = JSON.parse(request.responseText);
            Object.assign(this._cfg, newConfigurationInfo);
            resolve();
          }
          // Everything is good, the response was received.
        } else {
          // Not ready yet.
        }
      });
      request.send();
    });
  }

  public getIModelClient(): IModelClient {
    return new IModelHubClient(this._env);
  }

  // Set up to access the iModel on Connect
  public async loginAndOpenImodel(state: SimpleViewState): Promise<void> {
    await ProjectApi.init(this._env);
    await IModelApi.init(this._env);

    await this.readConfiguration();

    // log in.
    showStatus("logging in as", this._cfg.userName);
    await ConnectProject.loginToConnect(state, this._cfg.userName, this._cfg.password);

    // open the specified project
    showStatus("opening Project", this._cfg.projectName);
    await ConnectProject.openProject(state, this._cfg.projectName);

    // open the specified iModel
    showStatus("opening iModel", this._cfg.iModelName);
    await ConnectProject.openIModel(state, this._cfg.iModelName);
  }

  // log in to connect
  private static async loginToConnect(state: SimpleViewState, userName: string, password: string) {
    // tslint:disable-next-line:no-console
    console.log("Attempting login with userName", userName, "password", password);

    const authClient = new ImsActiveSecureTokenClient("QA");
    const accessClient = new ImsDelegationSecureTokenClient("QA");

    const authToken: AuthorizationToken = await authClient.getToken(userName, password);
    state.accessToken = await accessClient.getToken(authToken);
  }

  // opens the configured project
  private static async openProject(state: SimpleViewState, projectName: string) {
    state.project = await ProjectApi.getProjectByName(state.accessToken!, ProjectScope.Invited, projectName);
  }

  // opens the configured iModel
  private static async openIModel(state: SimpleViewState, iModelName: string) {
    state.iModel = await IModelApi.getIModelByName(state.accessToken!, state.project!.wsgId, iModelName);
    state.iModelConnection = await IModelApi.openIModel(state.accessToken!, state.project!.wsgId, state.iModel!.wsgId, undefined, OpenMode.Readonly);
  }
}

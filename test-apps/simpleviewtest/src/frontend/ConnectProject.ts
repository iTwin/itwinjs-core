/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ConnectClient, AccessToken, Project, ConnectRequestQueryOptions, IModelHubClient, IModelQuery, IModelRepository, VersionQuery, Version, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, DeploymentEnv } from "@bentley/imodeljs-clients/lib";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { IModelVersion } from "@bentley/imodeljs-common/lib/common";
import { OpenMode } from "@bentley/bentleyjs-core";
import { showStatus } from "./Utils";
import { SimpleViewState } from "./SimpleViewState";
import { ProjectAbstraction } from "./ProjectAbstraction";

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
  private static _connectClient: ConnectClient;

  // Initialize the project Api
  public static async init(env: DeploymentEnv): Promise<void> {
    ProjectApi._connectClient = new ConnectClient(env);
  }

  public static async getProjectByName(accessToken: AccessToken, projectScope: ProjectScope, projectName: string): Promise<Project | undefined> {

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: 100,
      $skip: 0,
    };

    let projectList: Project[] = [];
    if (projectScope === ProjectScope.Invited) {
      projectList = await ProjectApi._connectClient.getInvitedProjects(accessToken, queryOptions);
    }

    if (projectScope === ProjectScope.Favorites) {
      queryOptions.isFavorite = true;
    } else if (projectScope === ProjectScope.MostRecentlyUsed) {
      queryOptions.isMRU = true;
    }

    projectList = await ProjectApi._connectClient.getProjects(accessToken, queryOptions);

    for (const thisProject of projectList) {
      if (thisProject.name === projectName)
        return thisProject;
    }
    return undefined;
  }
}

class IModelApi {
  private static _imodelClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  public static async init(env: DeploymentEnv): Promise<void> {
    IModelApi._imodelClient = new IModelHubClient(env);
  }

  /** Get all iModels in a project */
  public static async getIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<IModelRepository | undefined> {
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(100).skip(0);
    const iModels: IModelRepository[] = await IModelApi._imodelClient.IModels().get(accessToken, projectId, queryOptions);
    if (iModels.length < 1)
      return undefined;
    for (const thisIModel of iModels) {
      if (thisIModel.name === iModelName) {
        const versions: Version[] = await IModelApi._imodelClient.Versions().get(accessToken, thisIModel.wsgId, new VersionQuery().select("Name,ChangeSetId").top(1));
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
export class ConnectProject extends ProjectAbstraction {
  private _cfg: ConnectProjectConfiguration = { userName: "", password: "", projectName: "", iModelName: "" };

  // Retrieves the configuration for Connect-related settings from connect-configuration.json file located in the built public folder
  private retrieveConfiguration(): Promise<void> {
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

  // Set up to access the iModel on Connect
  public async loginAndOpenImodel(state: SimpleViewState): Promise<void> {
    const env: DeploymentEnv = IModelApp.hubDeploymentEnv;

    IModelApp.iModelClient = new IModelHubClient(env);

    await ProjectApi.init(env);
    await IModelApi.init(env);

    await this.retrieveConfiguration();

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

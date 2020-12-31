/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { ChangeSet, ChangeSetQuery, HubIModel, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { IModelHost, IModelJsFs } from "@bentley/imodeljs-backend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import * as os from "os";
import * as path from "path";

/** Utility to work with iModelHub */
export class HubUtility {

  public static logCategory = "HubUtility";

  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    HubUtility.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  private static deleteDirectoryRecursive(dirPath: string) {
    if (!IModelJsFs.existsSync(dirPath))
      return;
    try {
      IModelJsFs.readdirSync(dirPath).forEach((file) => {
        const curPath = `${dirPath}/${file}`;
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          HubUtility.deleteDirectoryRecursive(curPath);
        } else {
          // delete file
          IModelJsFs.unlinkSync(curPath);
        }
      });
      IModelJsFs.rmdirSync(dirPath);
    } catch (err) {
      return; // todo: This seems to fail sometimes for no reason
    }
  }

  private static async queryProjectByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project | undefined> {
    const project: Project = await getIModelProjectAbstraction().queryProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    return project;
  }

  public static async queryIModelByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(requestContext, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      return undefined;
    if (iModels.length > 1)
      throw new Error(`Too many iModels with name ${iModelName} found`);
    return iModels[0];
  }

  /**
   * Queries the project id by its name
   * @param requestContext The client request context
   * @param projectName Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async queryProjectIdByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const project: Project | undefined = await HubUtility.queryProjectByName(requestContext, projectName);
    if (!project)
      throw new Error(`Project ${projectName} not found`);
    return project.wsgId;
  }

  /**
   * Queries the iModel id by its name
   * @param requestContext The client request context
   * @param projectId Id of the project
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<GuidString> {
    const iModel: HubIModel | undefined = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (!iModel || !iModel.id)
      throw new Error(`IModel ${iModelName} not found`);
    return iModel.id;
  }

  /** Query the latest change set (id) of the specified iModel */
  public static async queryLatestChangeSetId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<GuidString> {
    const changeSets: ChangeSet[] = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? "" : changeSets[changeSets.length - 1].wsgId;
  }

  /** Generate a name (for an iModel) that's unique for the user + host */
  public static generateUniqueName(baseName: string) {
    let username = "AnonymousUser";
    let hostname = "AnonymousHost";
    try {
      hostname = os.hostname();
      username = os.userInfo().username;
    } catch (err) {
    }
    return `${baseName}_${username}_${hostname}`;
  }

  /** Create  */
  public static async recreateIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString, iModelName: string): Promise<GuidString> {
    // Delete any existing iModel
    try {
      const deleteIModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
      await IModelHost.iModelClient.iModels.delete(requestContext, projectId, deleteIModelId);
    } catch (err) {
    }

    // Create a new iModel
    const iModel: HubIModel = await IModelHost.iModelClient.iModels.create(requestContext, projectId, iModelName, { description: `Description for ${iModelName}` });
    return iModel.wsgId;
  }
}

/** An implementation of IModelProjectAbstraction backed by an iTwin project */
class TestIModelHubProject {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  private static _contextRegistryClient?: ContextRegistryClient;

  private static get connectClient(): ContextRegistryClient {
    if (this._contextRegistryClient === undefined)
      this._contextRegistryClient = new ContextRegistryClient();
    return this._contextRegistryClient;
  }

  public get iModelHubClient(): IModelHubClient {
    return IModelHost.iModelClient as IModelHubClient;
  }

  public async queryProject(requestContext: AuthorizedClientRequestContext, query: any | undefined): Promise<Project> {
    const client = TestIModelHubProject.connectClient;
    return client.getProject(requestContext, query);
  }
  public async createIModel(requestContext: AuthorizedClientRequestContext, projectId: string, params: any): Promise<HubIModel> {
    const client = this.iModelHubClient;
    return client.iModels.create(requestContext, projectId, params.name, { path: params.seedFile, description: params.description, progressCallback: params.tracker });
  }
  public async deleteIModel(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString): Promise<void> {
    const client = this.iModelHubClient;
    return client.iModels.delete(requestContext, projectId, iModelId);
  }
  public async queryIModels(requestContext: AuthorizedClientRequestContext, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = this.iModelHubClient;
    return client.iModels.get(requestContext, projectId, query);
  }
}

let projectAbstraction: any;
let authorizationAbstraction: any;
const usingMocks = false;

export function getIModelPermissionAbstraction(): any {
  if (authorizationAbstraction !== undefined)
    return authorizationAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return authorizationAbstraction = {};
  }

  throw new Error("WIP");
}

export function getIModelProjectAbstraction(): any {
  if (projectAbstraction !== undefined)
    return projectAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return projectAbstraction = new TestIModelHubProject();
  }

  throw new Error("WIP");
}

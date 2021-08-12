/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Logger } from "@bentley/bentleyjs-core";
import { ITwin, ContextRegistryClient } from "@bentley/context-registry-client";
import { BriefcaseQuery, HubIModel, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { IModelHubBackend } from "@bentley/imodeljs-backend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export class HubUtility {
  public static logCategory = "HubUtility";

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
   * @param name Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async getContextContainerIdByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<string> {
    const container: ITwin | undefined = await HubUtility.getContextContainerByName(requestContext, name);
    if (!container)
      throw new Error(`Project ${name} not found`);
    return container.id;
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

  private static async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin | undefined> {
    const container: ITwin = await getIModelProjectAbstraction().queryProject(requestContext, name);
    return container;
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcasesById(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, onReachThreshold: () => void, acquireThreshold: number = 16): Promise<void> {
    const briefcases = await IModelHubBackend.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe());
    if (briefcases.length > acquireThreshold) {
      onReachThreshold();

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase) => {
        promises.push(IModelHubBackend.iModelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId: string = await HubUtility.getContextContainerIdByName(requestContext, projectName);
    const iModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);

    return this.purgeAcquiredBriefcasesById(requestContext, iModelId, () => {
      Logger.logInfo(HubUtility.logCategory, `Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`);
    }, acquireThreshold);
  }
  /** Create  */
  public static async recreateIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString, iModelName: string): Promise<GuidString> {
    // Delete any existing iModel
    try {
      const deleteIModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
      await IModelHubBackend.iModelClient.iModels.delete(requestContext, projectId, deleteIModelId);
    } catch (err) {
    }

    // Create a new iModel
    const iModel: HubIModel = await IModelHubBackend.iModelClient.iModels.create(requestContext, projectId, iModelName, { description: `Description for ${iModelName}` });
    return iModel.wsgId;
  }
}

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
    return IModelHubBackend.iModelClient as IModelHubClient;
  }

  public async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const client = TestIModelHubProject.connectClient;
    return client.getContextContainerByName(requestContext, name);
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
const usingMocks = false;

export function getIModelProjectAbstraction(): any {
  if (projectAbstraction !== undefined)
    return projectAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return projectAbstraction = new TestIModelHubProject();
  }

  throw new Error("WIP");
}

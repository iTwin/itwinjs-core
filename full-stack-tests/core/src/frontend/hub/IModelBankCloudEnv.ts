/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment, IModelAuthorizationClient } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { IModelBankFileSystemContextClient, IModelClient, IModelBankClient, AuthorizedClientRequestContext, Project, WsgError } from "@bentley/imodeljs-clients";
import { BasicAuthorizationClient } from "@bentley/imodeljs-clients/lib/imodelbank/BasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodeljs-clients/lib/imodelbank/IModelBankDummyAuthorizationClient";
import { WSStatus } from "@bentley/bentleyjs-core";

export class IModelBankCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return false; }
  public readonly contextMgr: IModelBankFileSystemContextClient;
  public readonly authorization: IModelAuthorizationClient;
  public readonly imodelClient: IModelClient;
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }

  public constructor(orchestratorUrl: string, basicAuthentication: boolean) {

    this.authorization = basicAuthentication ? new BasicAuthorizationClient() : new IModelBankDummyAuthorizationClient();
    this.imodelClient = new IModelBankClient(orchestratorUrl, undefined);
    this.contextMgr = new IModelBankFileSystemContextClient(orchestratorUrl);
  }

  public async bootstrapIModelBankProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<void> {
    let project: Project | undefined;
    try {
      project = await this.contextMgr.queryProjectByName(requestContext, projectName);
      if (project === undefined)
        throw new Error("what happened?");
      await this.contextMgr.deleteContext(requestContext, project.ecId);
    } catch (err) {
      if (!(err instanceof WsgError) || (err.errorNumber !== WSStatus.InstanceNotFound)) {
        throw err;
      }
    }

    await this.contextMgr.createContext(requestContext, projectName);
  }

}

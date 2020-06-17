/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { WSStatus } from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelBankClient, IModelBankFileSystemContextClient, IModelClient, IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { IModelBankBasicAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankBasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankDummyAuthorizationClient";
import { AuthorizedClientRequestContext, UserInfo, WsgError } from "@bentley/itwin-client";

export class IModelBankCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return false; }
  public readonly contextMgr: IModelBankFileSystemContextClient;
  public readonly imodelClient: IModelClient;
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public constructor(orchestratorUrl: string, private _basicAuthentication: boolean) {
    this.imodelClient = new IModelBankClient(orchestratorUrl, undefined);
    this.contextMgr = new IModelBankFileSystemContextClient(orchestratorUrl);
  }

  public getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any): FrontendAuthorizationClient {
    return this._basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userInfo, userCredentials)
      : new IModelBankDummyAuthorizationClient(userInfo, userCredentials);
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelBankClient, IModelBankFileSystemContextClient, IModelClient, IModelCloudEnvironment, WsgError, WSStatus } from "@bentley/imodelhub-client";
import { IModelBankBasicAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankBasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankDummyAuthorizationClient";
import { ITwin } from "@bentley/context-registry-client";
import { AccessToken } from "@itwin/core-bentley";

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

  public getAuthorizationClient(userCredentials: any): FrontendAuthorizationClient {
    return this._basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userCredentials)
      : new IModelBankDummyAuthorizationClient(userCredentials);
  }

  public async bootstrapIModelBankProject(requestContext: AccessToken, projectName: string): Promise<void> {
    let iTwin: ITwin | undefined;
    try {
      iTwin = await this.contextMgr.getITwinByName(requestContext, projectName);
      if (iTwin === undefined)
        throw new Error("what happened?");
      await this.contextMgr.deleteContext(requestContext, iTwin.id);
    } catch (err) {
      if (!(err instanceof WsgError) || (err.errorNumber !== WSStatus.InstanceNotFound)) {
        throw err;
      }
    }

    await this.contextMgr.createContext(requestContext, projectName);
  }

}

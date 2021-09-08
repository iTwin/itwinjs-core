/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { WSStatus } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelBankClient, IModelBankFileSystemITwinClient, IModelClient, IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { IModelBankBasicAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankBasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodelhub-client/lib/imodelbank/IModelBankDummyAuthorizationClient";
import { AuthorizedClientRequestContext, UserInfo, WsgError } from "@bentley/itwin-client";
import { ITwin } from "@bentley/itwin-registry-client";

export class IModelBankCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return false; }
  // SWB
  public readonly iTwinMgr: IModelBankFileSystemITwinClient;
  public readonly imodelClient: IModelClient;
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public constructor(orchestratorUrl: string, private _basicAuthentication: boolean) {
    this.imodelClient = new IModelBankClient(orchestratorUrl, undefined);
    this.iTwinMgr = new IModelBankFileSystemITwinClient(orchestratorUrl);
  }

  public getAuthorizationClient(userInfo: UserInfo | undefined, userCredentials: any): FrontendAuthorizationClient {
    return this._basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userInfo, userCredentials)
      : new IModelBankDummyAuthorizationClient(userInfo, userCredentials);
  }

  // SWB
  public async bootstrapIModelBankProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<void> {
    let iTwin: ITwin | undefined;
    try {
      iTwin = await this.iTwinMgr.getITwinByName(requestContext, projectName);
      if (iTwin === undefined)
        throw new Error("what happened?");
      await this.iTwinMgr.deleteContext(requestContext, iTwin.id);
    } catch (err) {
      if (!(err instanceof WsgError) || (err.errorNumber !== WSStatus.InstanceNotFound)) {
        throw err;
      }
    }

    // SWB What does context mean here
    await this.iTwinMgr.createContext(requestContext, projectName);
  }

}

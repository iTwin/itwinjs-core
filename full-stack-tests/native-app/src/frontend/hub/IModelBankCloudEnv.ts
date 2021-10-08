/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelBankClient, IModelBankFileSystemITwinClient, IModelClient, IModelCloudEnvironment, WsgError, WSStatus } from "@bentley/imodelhub-client";
import { IModelBankBasicAuthorizationClient } from "@bentley/imodelhub-client/lib/cjs/imodelbank/IModelBankBasicAuthorizationClient";
import { IModelBankDummyAuthorizationClient } from "@bentley/imodelhub-client/lib/cjs/imodelbank/IModelBankDummyAuthorizationClient";
import { ITwin } from "@bentley/itwin-registry-client";
import { AccessToken } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";

export class IModelBankCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return false; }
  public readonly iTwinMgr: IModelBankFileSystemITwinClient;
  public readonly imodelClient: IModelClient;
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public constructor(orchestratorUrl: string, private _basicAuthentication: boolean) {
    this.imodelClient = new IModelBankClient(orchestratorUrl, undefined);
    this.iTwinMgr = new IModelBankFileSystemITwinClient(orchestratorUrl);
  }

  public getAuthorizationClient(userCredentials: any): AuthorizationClient {
    return this._basicAuthentication
      ? new IModelBankBasicAuthorizationClient(userCredentials)
      : new IModelBankDummyAuthorizationClient(userCredentials);
  }

  public async bootstrapITwin(accessToken: AccessToken, iTwinName: string): Promise<void> {
    let iTwin: ITwin | undefined;
    try {
      iTwin = await this.iTwinMgr.getITwinByName(accessToken, iTwinName);
      if (iTwin === undefined)
        throw new Error("what happened?");
      await this.iTwinMgr.deleteITwin(accessToken, iTwin.id);
    } catch (err) {
      if (!(err instanceof WsgError) || (err.errorNumber !== WSStatus.InstanceNotFound)) {
        throw err;
      }
    }

    await this.iTwinMgr.createITwin(accessToken, iTwinName);
  }

}

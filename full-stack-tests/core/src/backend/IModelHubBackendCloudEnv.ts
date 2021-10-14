/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AzureFileHandler } from "@bentley/backend-itwin-client";
import { IModelCloudEnvironment, IModelHubClient } from "@bentley/imodelhub-client";
import { ITwinRegistryClientWrapper } from "../common/ITwinRegistryClientWrapper";
import { IModelHubUserMgr } from "../common/IModelHubUserMgr";

export class IModelHubBackendCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly iTwinMgr = new ITwinRegistryClientWrapper();
  public readonly imodelClient = new IModelHubClient(new AzureFileHandler());
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userCredentials: any) {
    return new IModelHubUserMgr(userCredentials);
  }
}

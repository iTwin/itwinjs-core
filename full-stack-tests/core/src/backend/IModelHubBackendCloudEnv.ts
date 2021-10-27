/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment, IModelHubClient } from "@bentley/imodelhub-client";
import { AzureFileHandler } from "@bentley/imodelhub-client/lib/cjs/itwin-client/file-handlers";
import { ITwinAccessClientWrapper } from "../common/ITwinAccessClientWrapper";
import { IModelHubUserMgr } from "../common/IModelHubUserMgr";

export class IModelHubBackendCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly iTwinMgr = new ITwinAccessClientWrapper();
  public readonly imodelClient = new IModelHubClient(new AzureFileHandler());
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userCredentials: any) {
    return new IModelHubUserMgr(userCredentials);
  }
}

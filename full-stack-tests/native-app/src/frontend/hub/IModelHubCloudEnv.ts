/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment, IModelHubClient } from "@bentley/imodelhub-client";
import { ITwinRegistryClientWrapper } from "../../common/ITwinRegistryClientWrapper";
import { IModelHubUserMgr } from "../../common/IModelHubUserMgr";

export class IModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly iTwinMgr = new ITwinRegistryClientWrapper();
  public readonly imodelClient = new IModelHubClient(undefined);
  public async startup(): Promise<void> { }
  public async shutdown(): Promise<number> { return 0; }

  public getAuthorizationClient(userCredentials: any) {
    return new IModelHubUserMgr(userCredentials);
  }
}

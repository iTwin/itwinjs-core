/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment, IModelHubClient } from "@bentley/imodelhub-client";
import { AzureFileHandler } from "@bentley/imodeljs-clients-backend";
import { ContextRegistryClientWrapper } from "../common/ContextRegistryClientWrapper";
import { IModelHubUserMgr } from "../common/IModelHubUserMgr";

export class IModelHubBackendCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new ContextRegistryClientWrapper();
  public readonly authorization = new IModelHubUserMgr();
  public readonly imodelClient = new IModelHubClient(new AzureFileHandler());
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }
}

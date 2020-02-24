/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelHubClient } from "@bentley/imodeljs-clients";
import { IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { AzureFileHandler } from "@bentley/imodeljs-clients-backend";
import { ConnectClientWrapper } from "../common/ConnectClientWrapper";
import { IModelHubUserMgr } from "../common/IModelHubUserMgr";

export class IModelHubBackendCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new ConnectClientWrapper();
  public readonly authorization = new IModelHubUserMgr();
  public readonly imodelClient = new IModelHubClient(new AzureFileHandler());
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }
}

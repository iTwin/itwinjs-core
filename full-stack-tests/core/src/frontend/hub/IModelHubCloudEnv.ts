/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import {
  IModelHubClient,
} from "@bentley/imodeljs-clients/lib/imodeljs-clients";
import { IModelHubUserMgr } from "../../common/IModelHubUserMgr";
import { ConnectClientWrapper } from "../../common/ConnectClientWrapper";

export class IModelHubCloudEnv implements IModelCloudEnvironment {
  public get isIModelHub(): boolean { return true; }
  public readonly contextMgr = new ConnectClientWrapper();
  public readonly authorization = new IModelHubUserMgr();
  public readonly imodelClient = new IModelHubClient(undefined);
  public async startup(): Promise<void> { return Promise.resolve(); }
  public async shutdown(): Promise<number> { return Promise.resolve(0); }
}

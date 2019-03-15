/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  IModelReadRpcInterface, IModelTileRpcInterface, IModelToken,
  IModelWriteRpcInterface, RpcInterface, RpcManager, StandaloneIModelRpcInterface, WipRpcInterface,
} from "@bentley/imodeljs-common";

export abstract class TestRpcInterface extends RpcInterface {
  public static version = "1.1.1";

  public static types = () => [
    IModelToken,
    AccessToken,
  ]

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async restartIModelHost(): Promise<void> {
    return this.forward(arguments);
  }

  public async extractChangeSummaries(_accessToken: AccessToken, _iModelToken: IModelToken, _options: any): Promise<void> {
    return this.forward(arguments);
  }

  public async deleteChangeCache(_iModelToken: IModelToken): Promise<void> {
    return this.forward(arguments);
  }

  public async executeTest(_iModelToken: IModelToken, _testName: string, _params: any): Promise<any> {
    return this.forward(arguments);
  }

  public async saveCSV(_testName: string, _testDescription: string, _testTime: number): Promise<any> {
    return this.forward(arguments);
  }
}

export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelWriteRpcInterface,
  StandaloneIModelRpcInterface,
  TestRpcInterface,
  WipRpcInterface,
];

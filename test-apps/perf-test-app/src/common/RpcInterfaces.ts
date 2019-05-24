/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  IModelReadRpcInterface, IModelTileRpcInterface, IModelTokenProps,
  IModelWriteRpcInterface, RpcInterface, RpcManager, WipRpcInterface,
} from "@bentley/imodeljs-common";

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly interfaceName = "TestRpcInterface";
  public static interfaceVersion = "1.1.1";

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async restartIModelHost(): Promise<void> {
    return this.forward(arguments);
  }

  public async extractChangeSummaries(_iModelToken: IModelTokenProps, _options: any): Promise<void> {
    return this.forward(arguments);
  }

  public async deleteChangeCache(_iModelToken: IModelTokenProps): Promise<void> {
    return this.forward(arguments);
  }

  public async executeTest(_iModelToken: IModelTokenProps, _testName: string, _params: any): Promise<any> {
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
  TestRpcInterface,
  WipRpcInterface,
];

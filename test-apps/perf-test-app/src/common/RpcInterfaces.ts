/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  IModelReadRpcInterface, RpcInterface, RpcManager,
} from "@bentley/imodeljs-common";

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly interfaceName = "TestRpcInterface";
  public static interfaceVersion = "1.1.1";

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async addNewEntry(_testSuit: string, _testName: string, _valueDescription: string, _value: number, _info: string): Promise<any> {
    return this.forward(arguments);
  }

  public async initializeReporter(): Promise<any> {
    return this.forward(arguments);
  }

  public async saveReport(): Promise<any> {
    return this.forward(arguments);
  }
}

export const rpcInterfaces = [
  IModelReadRpcInterface,
  TestRpcInterface,
];

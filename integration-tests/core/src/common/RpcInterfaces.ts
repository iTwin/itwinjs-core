/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContextProps } from "@bentley/imodeljs-clients";
import {
  IModelReadRpcInterface, IModelTileRpcInterface,
  IModelWriteRpcInterface, RpcInterface, RpcManager, SnapshotIModelRpcInterface, WipRpcInterface,
  DevToolsRpcInterface,
  IModelTokenProps,
} from "@bentley/imodeljs-common";
import { ClientRequestContextProps } from "@bentley/bentleyjs-core";

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

  public async reportRequestContext(): Promise<ClientRequestContextProps> {
    return this.forward(arguments);
  }

  public async reportAuthorizedRequestContext(): Promise<AuthorizedClientRequestContextProps> {
    return this.forward(arguments);
  }
}

export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelWriteRpcInterface,
  SnapshotIModelRpcInterface,
  TestRpcInterface,
  WipRpcInterface,
  DevToolsRpcInterface,
];

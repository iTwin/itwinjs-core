/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContextProps } from "@bentley/imodeljs-clients";
import {
  IModelReadRpcInterface, IModelTileRpcInterface,
  IModelWriteRpcInterface, RpcInterface, RpcManager, SnapshotIModelRpcInterface, WipRpcInterface,
  DevToolsRpcInterface,
  IModelTokenProps,
  NativeAppRpcInterface,
} from "@bentley/imodeljs-common";
import { ClientRequestContextProps, GuidString } from "@bentley/bentleyjs-core";
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
export abstract class EventsTestRpcInterface extends RpcInterface {
  public static readonly interfaceName = "EventsTestRpcInterface";
  public static interfaceVersion = "0.1.0";

  public static getClient(): EventsTestRpcInterface {
    return RpcManager.getClientForInterface(EventsTestRpcInterface);
  }

  // Set a event that would be fired from backend and recieved on frontend.
  public async echo(_iModelToken: IModelTokenProps, _id: GuidString, _message: string): Promise<void> { return this.forward(arguments); }
}

export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelWriteRpcInterface,
  SnapshotIModelRpcInterface,
  TestRpcInterface,
  WipRpcInterface,
  DevToolsRpcInterface,
  NativeAppRpcInterface,
  EventsTestRpcInterface,
];

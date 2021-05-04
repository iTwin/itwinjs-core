/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelReadRpcInterface, IModelWriteRpcInterface, RpcInterface, RpcManager } from "@bentley/imodeljs-common";

export interface CloudEnvProps {
  iModelBank?: {
    url: string;
  };
  iModelHub?: {
    region: string;
  };
}

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly interfaceName = "TestRpcInterface";
  public static interfaceVersion = "1.1.1";

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async purgeStorageCache(): Promise<void> {
    return this.forward(arguments);
  }

  public async getCloudEnv(): Promise<CloudEnvProps> {
    return this.forward(arguments);
  }

  public async beginOfflineScope(): Promise<void> {
    return this.forward(arguments);
  }
  public async endOfflineScope(): Promise<void> {
    return this.forward(arguments);
  }
}
export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelWriteRpcInterface,
  TestRpcInterface,
];

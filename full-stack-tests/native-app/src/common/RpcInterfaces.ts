/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContextProps } from "@bentley/imodeljs-clients";
import {
  IModelReadRpcInterface,
  IModelWriteRpcInterface, RpcInterface, RpcManager,
  IModelTokenProps,
  NativeAppRpcInterface,
} from "@bentley/imodeljs-common";
import { ClientRequestContextProps } from "@bentley/bentleyjs-core";

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

  public async getCloudEnv(): Promise<CloudEnvProps> {
    return this.forward(arguments);
  }

  public async createIModel(_name: string, _contextId: string, _deleteIfExists: boolean): Promise<string> {
    return this.forward(arguments);
  }

  public async purgeBriefcaseCache(): Promise<void> {
    return this.forward(arguments);
  }
}
export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelWriteRpcInterface,
  TestRpcInterface,
  NativeAppRpcInterface,
];

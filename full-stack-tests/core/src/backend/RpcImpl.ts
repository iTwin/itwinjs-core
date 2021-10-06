/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelDb, IModelHost, IModelJsFs } from "@itwin/core-backend";
import { V1CheckpointManager } from "@itwin/core-backend/lib/cjs/CheckpointManager";
import { IModelRpcProps, RpcInterface, RpcManager } from "@itwin/core-common";
import { CloudEnvProps, TestRpcInterface } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async restartIModelHost(): Promise<void> {
    await IModelHost.shutdown();
    await IModelHost.startup();
  }

  public async executeTest(tokenProps: IModelRpcProps, testName: string, params: any): Promise<any> {
    return JSON.parse(IModelDb.findByKey(tokenProps.key).nativeDb.executeTest(testName, JSON.stringify(params)));
  }

  public async getCloudEnv(): Promise<CloudEnvProps> {
    if (CloudEnv.cloudEnv.isIModelHub) {
      const region = "0";
      return { iModelHub: { region } };
    }
    const url = await (CloudEnv.cloudEnv.imodelClient as IModelBankClient).getUrl();
    return { iModelBank: { url } };
  }

  public async purgeCheckpoints(iModelId: string): Promise<void> {
    IModelJsFs.removeSync(V1CheckpointManager.getFolder(iModelId));
  }
}

TestRpcImpl.register();

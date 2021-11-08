/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as nock from "nock";
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelDb, IModelHost, IModelJsFs, NativeHost } from "@itwin/core-backend";
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

  public async purgeStorageCache(): Promise<void> {
    return IModelJsFs.purgeDirSync(NativeHost.appSettingsCacheDir);
  }

  public async beginOfflineScope(): Promise<void> {
    nock(/^ https: \/\/.*$/i)
      .log((message: any, optionalParams: any[]) => {
        // eslint-disable-next-line no-console
        console.log(message, optionalParams);
      }).get("/").reply(503);
  }

  public async endOfflineScope(): Promise<void> {
    nock.cleanAll();
  }
}

TestRpcImpl.register();

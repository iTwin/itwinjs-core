/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as nock from "nock";
import * as path from "path";
import { _nativeDb, CloudSqlite, IModelDb, IModelHost, IModelJsFs, NativeHost, SnapshotDb, StandaloneDb, ViewStore } from "@itwin/core-backend";
import { IModelConnectionProps, IModelNotFoundResponse, IModelRpcProps, RpcInterface, RpcManager } from "@itwin/core-common";
import { AzuriteUsers, TestRpcInterface } from "../common/RpcInterfaces";
import { AzuriteTest } from "./AzuriteTest";
import { OpenMode } from "@itwin/core-bentley";

const viewContainer = "views-itwin1";
const storageType = "azure";
let removeViewStore: VoidFunction;
let saveAuthClient: AzuriteTest.AuthorizationClient;

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const accessToken = await CloudSqlite.requestToken({ containerId });
  await ViewStore.CloudAccess.initializeDb({ baseUri: AzuriteTest.baseUri, storageType, containerId, accessToken });
}

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async openSnapshot(filePath: string): Promise<IModelConnectionProps> {
    let resolvedFileName: string | undefined = filePath;
    if (IModelHost.snapshotFileNameResolver) { // eslint-disable-line @typescript-eslint/no-deprecated
      resolvedFileName = IModelHost.snapshotFileNameResolver.tryResolveFileName(filePath); // eslint-disable-line @typescript-eslint/no-deprecated
      if (undefined === resolvedFileName)
        throw new IModelNotFoundResponse(); // eslint-disable-line @typescript-eslint/only-throw-error
    }
    return SnapshotDb.openFile(resolvedFileName).getConnectionProps();
  }

  public async closeIModel(iModelKey: string): Promise<void> {
    IModelDb.findByKey(iModelKey).close();
  }

  public async restartIModelHost(): Promise<void> {
    await IModelHost.shutdown();
    await IModelHost.startup({ cacheDir: path.join(__dirname, ".cache") });
  }

  public async executeTest(tokenProps: IModelRpcProps, testName: string, params: any): Promise<any> {
    return JSON.parse(IModelDb.findByKey(tokenProps.key)[_nativeDb].executeTest(testName, JSON.stringify(params)));
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

  public async startViewStore(): Promise<AzuriteUsers> {
    saveAuthClient = IModelHost.authorizationClient as AzuriteTest.AuthorizationClient;
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer(viewContainer);
    removeViewStore = SnapshotDb.onOpen.addListener((dbName) => {
      const db = StandaloneDb.openFile(dbName, OpenMode.ReadWrite);
      db.views.saveDefaultViewStore({ baseUri: AzuriteTest.baseUri, containerId: viewContainer, storageType });
      db.close();
    });
    AzuriteTest.userToken = "";
    return AzuriteTest.service.userToken;
  }
  public async stopViewStore(): Promise<void> {
    removeViewStore?.();
    IModelHost.authorizationClient = saveAuthClient;
  }

  public async writeTestOutputFile(filePath: string, content: string, appendToFile: boolean): Promise<void> {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (appendToFile) {
      fs.appendFileSync(filePath, content);
    } else {
      fs.writeFileSync(filePath, content);
    }
  }
}

TestRpcImpl.register();

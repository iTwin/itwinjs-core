/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import * as nock from "nock";
import * as path from "path";
import { BentleyLoggerCategory, ClientRequestContext, Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
import { IModelBankClient, IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import { BackendLoggerCategory, IModelHostConfiguration, IModelJsFs, IpcHandler, NativeHost, NativeLoggerCategory } from "@bentley/imodeljs-backend";
import { RpcConfiguration } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { CloudEnvProps, testIpcChannel, TestIpcInterface } from "../common/IpcInterfaces";
import { CloudEnv } from "./cloudEnv";

function initDebugLogLevels(reset?: boolean) {
  Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
  Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
  Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(BackendLoggerCategory.ConcurrencyControl, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.Licensing, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECObjectsNative, reset ? LogLevel.Error : LogLevel.Trace);
}

export function setupDebugLogLevels() {
  initDebugLogLevels(false);
}

class TestIpcHandler extends IpcHandler implements TestIpcInterface {
  public get channelName() { return testIpcChannel; }

  public async getCloudEnv(): Promise<CloudEnvProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    if (CloudEnv.cloudEnv.isIModelHub) {
      const region = Config.App.get("imjs_buddi_resolve_url_using_region") || "0";
      return { iModelHub: { region } };
    }
    const url = await (CloudEnv.cloudEnv.imodelClient as IModelBankClient).getUrl(requestContext);
    return { iModelBank: { url } };
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

async function init() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  RpcConfiguration.developmentMode = true;

  // Bootstrap the cloud environment
  await CloudEnv.initialize();

  // Start the backend
  const iModelHost = new IModelHostConfiguration();
  iModelHost.imodelClient = CloudEnv.cloudEnv.imodelClient;
  iModelHost.concurrentQuery.concurrent = 2;
  iModelHost.concurrentQuery.pollInterval = 5;
  iModelHost.cacheDir = path.join(__dirname, "out");
  await ElectronHost.startup({ electronHost: { ipcHandlers: [TestIpcHandler] }, iModelHost });
}
module.exports = init();

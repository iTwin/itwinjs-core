/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// required to get certa to read the .env file - should be reworked
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";
import * as fs from "fs";
import * as nock from "nock";
import * as path from "path";
import { BentleyLoggerCategory, Logger, LogLevel } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelBankClient, IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import {
  BackendLoggerCategory, BriefcaseDb, BriefcaseManager, ChangeSummaryManager, IModelHost, IModelHostConfiguration, IModelJsFs,
  IpcHandler, NativeHost, NativeLoggerCategory,
} from "@itwin/core-backend";
import { IModelRpcProps, RpcConfiguration } from "@itwin/core-common";
import { ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { testIpcChannel, TestIpcInterface, TestITwinProps } from "../common/IpcInterfaces";
import { CloudEnv } from "./cloudEnv";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

function initDebugLogLevels(reset?: boolean) {
  Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
  Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
  Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECObjectsNative, reset ? LogLevel.Error : LogLevel.Trace);
}

export function setupDebugLogLevels() {
  initDebugLogLevels(false);
}

class TestIpcHandler extends IpcHandler implements TestIpcInterface {
  public get channelName() { return testIpcChannel; }

  public async getTestITwinProps(_user: TestUserCredentials): Promise<TestITwinProps> {
    // TODO: Update config to match iTwin naming
    const iTwinName = process.env.IMJS_TEST_PROJECT_NAME ?? "";

    if (CloudEnv.cloudEnv.isIModelHub) {
      const region = "0";
      return { iTwinName, iModelHub: { region } };
    }
    const url = await (CloudEnv.cloudEnv.imodelClient as IModelBankClient).getUrl();
    return { iTwinName, iModelBank: { url } };
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

  public async createChangeSummary(iModelRpcProps: IModelRpcProps): Promise<string> {
    const accessToken = await IModelHost.getAccessToken();
    return ChangeSummaryManager.createChangeSummary(accessToken, BriefcaseDb.findByKey(iModelRpcProps.key));
  }

  public async deleteChangeCache(tokenProps: IModelRpcProps): Promise<void> {
    if (!tokenProps.iModelId)
      throw new Error("iModelToken is invalid");

    const changesPath = BriefcaseManager.getChangeCachePathName(tokenProps.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
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
  iModelHost.cacheDir = path.join(__dirname, "out");

  await ElectronHost.startup({
    electronHost: {
      ipcHandlers: [TestIpcHandler],
      authConfig: {
        clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
        redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
        scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
      },
    },
    iModelHost,
  });

  // TODO: Use this setup once the ElectronAuth is split out.
  // await ElectronHost.startup({ electronHost: { ipcHandlers: [TestIpcHandler] }, iModelHost });
  // IModelHost.authorizationClient = new ElectronAuthorizationBackend({
  //   clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
  //   redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
  //   scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
  // });
}

module.exports = init();

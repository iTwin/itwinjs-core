/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { ElectronHost, ElectronHostOptions } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelHubBackend, UrlFileHandler } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { IModelHost, IModelHostConfiguration, LocalhostIpcHost } from "@itwin/core-backend";
import {
  IModelReadRpcInterface, IModelTileRpcInterface, RpcInterfaceDefinition, RpcManager,
  SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { AndroidHost, IOSHost, MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { DtaConfiguration, getConfig } from "../common/DtaConfiguration";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { FakeTileCacheService } from "./FakeTileCacheService";
import { EditCommandAdmin } from "@itwin/editor-backend";
import * as editorBuiltInCommands from "@itwin/editor-backend";

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

class DisplayTestAppRpc extends DtaRpcInterface {

  public override async readExternalSavedViews(bimFileName: string): Promise<string> {
    if (ProcessDetector.isMobileAppBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    if (!fs.existsSync(esvFileName))
      return "";

    const jsonStr = fs.readFileSync(esvFileName).toString();
    return jsonStr ?? "";
  }

  public override async writeExternalSavedViews(bimFileName: string, namedViews: string): Promise<void> {
    if (ProcessDetector.isMobileAppBackend && process.env.DOCS) {
      // Used to set a writeable directory on an iOS or Android device.
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    return this.writeExternalFile(esvFileName, namedViews);
  }

  public override async writeExternalFile(fileName: string, content: string): Promise<void> {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath))
      this.createFilePath(filePath);

    if (fs.existsSync(fileName))
      fs.unlinkSync(fileName);

    fs.writeFileSync(fileName, content);
  }

  private createFilePath(filePath: string) {
    const files = filePath.split(/\/|\\/); // /\.[^/.]+$/ // /\/[^\/]+$/
    let curFile = "";
    for (const file of files) {
      if (file === "")
        break;

      curFile += `${file}\\`;
      if (!fs.existsSync(curFile))
        fs.mkdirSync(curFile);
    }
  }

  private getFilePath(fileName: string): string {
    const slashIndex = fileName.lastIndexOf("/");
    const backSlashIndex = fileName.lastIndexOf("\\");
    if (slashIndex > backSlashIndex)
      return fileName.substring(0, slashIndex);
    else
      return fileName.substring(0, backSlashIndex);
  }

  private createEsvFilename(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (-1 !== dotIndex)
      return `${fileName.substring(0, dotIndex)}_ESV.json`;
    return `${fileName}.sv`;
  }
}

export const getRpcInterfaces = (): RpcInterfaceDefinition[] => {
  const rpcs: RpcInterfaceDefinition[] = [
    DtaRpcInterface,
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    SnapshotIModelRpcInterface,
  ];

  return rpcs;
};

export const loadBackendConfig = (): DtaConfiguration => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  return getConfig();
};

export const initializeDtaBackend = async (hostOpts?: ElectronHostOptions & MobileHostOpts) => {
  const dtaConfig = loadBackendConfig();

  const iModelHost = new IModelHostConfiguration();
  iModelHost.logTileLoadTimeThreshold = 3;
  iModelHost.logTileSizeThreshold = 500000;

  let hubClient;
  if (dtaConfig.customOrchestratorUri)
    hubClient = new IModelBankClient(dtaConfig.customOrchestratorUri, new UrlFileHandler());

  iModelHost.hubAccess = new IModelHubBackend(hubClient);

  if (dtaConfig.useFakeCloudStorageTileCache)
    iModelHost.tileCacheCredentials = { service: "external", account: "", accessKey: "" };

  let logLevel = LogLevel.None;
  if (undefined !== dtaConfig.logLevel)
    logLevel = Logger.parseLogLevel(dtaConfig.logLevel);

  const opts = {
    iModelHost,
    electronHost: hostOpts,
    nativeHost: {
      applicationName: "display-test-app",
    },
    mobileHost: hostOpts?.mobileHost,
    localhostIpcHost: {
      noServer: true,
    },
  };

  /** register the implementation of our RPCs. */
  RpcManager.registerImpl(DtaRpcInterface, DisplayTestAppRpc);
  if (ProcessDetector.isElectronAppBackend) {
    await ElectronHost.startup(opts);
    EditCommandAdmin.registerModule(editorBuiltInCommands);
  } else if (ProcessDetector.isIOSAppBackend) {
    await IOSHost.startup(opts);
  } else if (ProcessDetector.isAndroidAppBackend) {
    await AndroidHost.startup(opts);
  } else {
    await LocalhostIpcHost.startup(opts);
    EditCommandAdmin.registerModule(editorBuiltInCommands);
  }

  // Set up logging (by default, no logging is enabled)
  Logger.initializeToConsole();
  Logger.setLevelDefault(logLevel);
  Logger.setLevel("SVT", LogLevel.Trace);

  if (dtaConfig.useFakeCloudStorageTileCache)
    IModelHost.tileCacheService = new FakeTileCacheService(path.normalize(path.join(__dirname, "tiles")), "http://localhost:3001"); // puts the cache in "./lib/backend/tiles" and serves them from "http://localhost:3001/tiles"
};

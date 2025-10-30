/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { Guid, Id64String, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { ElectronHost, ElectronHostOptions } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { appendTextAnnotationGeometry, BriefcaseDb, Drawing, IModelDb, IModelHost, IModelHostOptions, layoutTextBlock, LocalhostIpcHost, SnapshotDb, TextStyleResolver } from "@itwin/core-backend";
import {
  DynamicGraphicsRequest2dProps, ElementGeometry, IModelReadRpcInterface, IModelRpcProps, IModelTileRpcInterface, Placement2dProps, RpcInterfaceDefinition, RpcManager, TextAnnotation, TextAnnotationProps,
} from "@itwin/core-common";
import { MobileHost, MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { DtaConfiguration, getConfig } from "../common/DtaConfiguration";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { EditCommandAdmin } from "@itwin/editor-backend";
import { ECSchemaRpcInterface } from '@itwin/ecschema-rpcinterface-common';
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import * as editorBuiltInCommands from "@itwin/editor-backend";
import { FormatSet } from "@itwin/ecschema-metadata";
import { AzureClientStorage, BlockBlobClientWrapperFactory } from "@itwin/object-storage-azure";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
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

  public override async readExternalCameraPaths(bimFileName: string): Promise<string> {
    if (ProcessDetector.isMobileAppBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const cameraPathsFileName = this.createCameraPathsFilename(bimFileName);
    if (!fs.existsSync(cameraPathsFileName))
      return "";

    const jsonStr = fs.readFileSync(cameraPathsFileName).toString();
    return jsonStr ?? "";
  }

  public override async writeExternalCameraPaths(bimFileName: string, cameraPaths: string): Promise<void> {
    if (ProcessDetector.isMobileAppBackend && process.env.DOCS) {
      // Used to set a writeable directory on an iOS or Android device.
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const cameraPathsFileName = this.createCameraPathsFilename(bimFileName);
    return this.writeExternalFile(cameraPathsFileName, cameraPaths);
  }

  public override async readExternalFile(txtFileName: string): Promise<string> {
    if (ProcessDetector.isMobileAppBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      txtFileName = path.join(docPath, txtFileName);
    }

    const dataFileName = this.createTxtFilename(txtFileName);
    if (!fs.existsSync(dataFileName))
      return "";

    const contents = fs.readFileSync(dataFileName).toString();
    return contents ?? "";
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

  private createCameraPathsFilename(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (-1 !== dotIndex)
      return `${fileName.substring(0, dotIndex)}_cameraPaths.json`;
    return `${fileName}.cameraPaths.json`;
  }

  private createTxtFilename(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (-1 === dotIndex)
      return `${fileName}.txt`;
    return fileName;
  }

  public override async getEnvConfig(): Promise<DtaConfiguration> {
    return getConfig();
  }

  public override async terminate() {
    await IModelHost.shutdown();

    // Electron only
    try {
      const { app } = require("electron"); // eslint-disable-line @typescript-eslint/no-require-imports
      if (app !== undefined)
        app.exit();
    } catch {

    }

    // Browser only
    if (DtaRpcInterface.backendServer)
      DtaRpcInterface.backendServer.close();
  }

  public override async getAccessToken(): Promise<string> {
    return (await IModelHost.authorizationClient?.getAccessToken()) ?? "";
  }

  public override async generateTextAnnotationGeometry(iModelToken: IModelRpcProps, annotationProps: TextAnnotationProps, defaultTextStyleId: Id64String, categoryId: Id64String, modelId: Id64String, placementProps: Placement2dProps, wantDebugGeometry?: boolean): Promise<Uint8Array | undefined> {
    const iModel = IModelDb.findByKey(iModelToken.key);

    const textBlock = TextAnnotation.fromJSON(annotationProps).textBlock;
    let scaleFactor = 1;
    if (modelId) {
      const element = iModel.elements.getElement(modelId);
      if (element instanceof Drawing)
        scaleFactor = element.scaleFactor;
    }
    const textStyleResolver = new TextStyleResolver({textBlock, iModel, textStyleId: defaultTextStyleId});
    const layout = layoutTextBlock({ iModel, textBlock, textStyleResolver });
    const builder = new ElementGeometry.Builder();
    appendTextAnnotationGeometry({ layout, textStyleResolver, scaleFactor, annotationProps, builder, categoryId, wantDebugGeometry });

    const requestProps: DynamicGraphicsRequest2dProps = {
      id: Guid.createValue(),
      toleranceLog10: -5,
      type: "2d",
      placement: placementProps,
      categoryId,
      geometry: { format: "flatbuffer", data: builder.entries },
    }

    return iModel.generateElementGraphics(requestProps);
  }

  public override async getFormatSetFromFile(filename: string): Promise<FormatSet> {
    if (!fs.existsSync(filename)) {
      throw new Error(`File not found: ${filename}`);
    }

    const fileContent = fs.readFileSync(filename, "utf-8");
    const jsonData = JSON.parse(fileContent);

    if (!jsonData || typeof jsonData !== "object") {
      throw new Error(`Invalid JSON content in file: ${filename}`);
    }

    return jsonData as FormatSet;
  }
}

export const getRpcInterfaces = (): RpcInterfaceDefinition[] => {
  const rpcs: RpcInterfaceDefinition[] = [
    DtaRpcInterface,
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    ECSchemaRpcInterface
  ];

  return rpcs;
};

export const loadBackendConfig = (): DtaConfiguration => {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  loadEnv(path.join(__dirname, "..", "..", ".env.local"));

  return getConfig();
};

export const initializeDtaBackend = async (hostOpts?: ElectronHostOptions & MobileHostOpts) => {
  const dtaConfig = loadBackendConfig();

  let logLevel = LogLevel.None;
  if (undefined !== dtaConfig.logLevel)
    logLevel = Logger.parseLogLevel(dtaConfig.logLevel);

  // Set up logging (by default, no logging is enabled)
  Logger.initializeToConsole();
  Logger.setLevelDefault(logLevel);
  Logger.setLevel("SVT", LogLevel.Trace);

  const iModelClient = new IModelsClient({
    api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` },
    cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory())
  });
  const hubAccess = new BackendIModelsAccess(iModelClient);

  const iModelHost: IModelHostOptions = {
    logTileLoadTimeThreshold: 3,
    logTileSizeThreshold: 500000,
    cacheDir: process.env.IMJS_BRIEFCASE_CACHE_LOCATION,
    profileName: "display-test-app",
    hubAccess,
  };

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
  RpcManager.registerImpl(ECSchemaRpcInterface, ECSchemaRpcImpl)
  const authClient = await initializeAuthorizationClient();
  if (ProcessDetector.isElectronAppBackend) {
    opts.iModelHost.authorizationClient = authClient;
    await ElectronHost.startup(opts);
    await authClient?.signInSilent();
    EditCommandAdmin.registerModule(editorBuiltInCommands);
  } else if (ProcessDetector.isMobileAppBackend) {
    await MobileHost.startup(opts);
  } else {
    await LocalhostIpcHost.startup(opts);
    EditCommandAdmin.registerModule(editorBuiltInCommands);
  }

  const allowedChannels = dtaConfig.allowedChannels;
  if (dtaConfig.openReadWrite && allowedChannels) {
    const applyAllowedChannels = (db: IModelDb) => {
      for (const channel of allowedChannels) {
        db.channels.addAllowedChannel(channel);
      }
    }

    SnapshotDb.onOpened.addListener(applyAllowedChannels);
    BriefcaseDb.onOpened.addListener(applyAllowedChannels);
  }
};

async function initializeAuthorizationClient(): Promise<ElectronMainAuthorization | undefined> {
  if (
    ProcessDetector.isElectronAppBackend &&
    checkEnvVars(
      "IMJS_OIDC_ELECTRON_TEST_CLIENT_ID",
      "IMJS_OIDC_ELECTRON_TEST_SCOPES",
    )
  ) {
    return new ElectronMainAuthorization({
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID!,
      scopes: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES!,
      redirectUris:
        process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI !== undefined ?
          [process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI] : ["http://localhost:3000/signin-callback"],
      issuerUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}ims.bentley.com`,
    });
  }
  // Note: Mobile's default auth client works, and will be used if we get here on mobile.
  return undefined;
}

/**
 * Logs a warning if only some are provided
 * @returns true if all are provided, false if any missing.
 */
function checkEnvVars(...keys: Array<string>): boolean {
  const missing = keys.filter((name) => process.env[name] === undefined);
  if (missing.length === 0) {
    return true;
  }
  if (missing.length < keys.length) { // Some missing, warn
    // eslint-disable-next-line no-console
    console.log(`Skipping auth setup due to missing: ${missing.join(", ")}`);
  }
  return false;
}

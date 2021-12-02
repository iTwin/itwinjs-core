/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./RpcImpl";
// Sets up certa to allow a method on the frontend to get an access token
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";
import * as fs from "fs";
import * as path from "path";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { WebEditServer } from "@itwin/express-server";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import {
  FileNameResolver, IModelDb, IModelHost, IModelHostConfiguration, IpcHandler, LocalhostIpcHost, PhysicalModel, PhysicalPartition, SpatialCategory,
  SubjectOwnsPartitionElements,
} from "@itwin/core-backend";
import { Id64String, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, CodeProps, ElementProps, IModel, RelatedElement, RpcConfiguration, SubCategoryAppearance } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { BasicManipulationCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { fullstackIpcChannel, FullStackTestIpc } from "../common/FullStackTestIpc";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";
import * as testCommands from "./TestEditCommands";
import { exposeBackendCallbacks } from "../certa/certaBackend";

/* eslint-disable no-console */

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

class FullStackTestIpcHandler extends IpcHandler implements FullStackTestIpc {
  public get channelName() { return fullstackIpcChannel; }

  public static async createAndInsertPartition(iModelDb: IModelDb, newModelCode: CodeProps): Promise<Id64String> {
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement = iModelDb.elements.createElement(modeledElementProps);
    return iModelDb.elements.insertElement(modeledElement);
  }

  public async createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    const eid = await FullStackTestIpcHandler.createAndInsertPartition(iModelDb, newModelCode);
    const modeledElementRef = new RelatedElement({ id: eid });
    const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: false });
    return iModelDb.models.insertModel(newModel);
  }

  public async createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    const category = SpatialCategory.create(iModelDb, scopeModelId, categoryName);
    const categoryId = iModelDb.elements.insertElement(category);
    category.setDefaultAppearance(appearance);
    return categoryId;
  }
}

async function init() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  RpcConfiguration.developmentMode = true;

  // Bootstrap the cloud environment
  await CloudEnv.initialize();

  const iModelHost = new IModelHostConfiguration();
  iModelHost.hubAccess = new IModelHubBackend(CloudEnv.cloudEnv.imodelClient);
  iModelHost.cacheDir = path.join(__dirname, ".cache");  // Set local cache dir

  if (ProcessDetector.isElectronAppBackend) {
    exposeBackendCallbacks();
    const authClient = await ElectronMainAuthorization.create({
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
    });
    iModelHost.authorizationClient = authClient;
    await ElectronHost.startup({ electronHost: { rpcInterfaces }, iModelHost });

    EditCommandAdmin.registerModule(testCommands);
    EditCommandAdmin.register(BasicManipulationCommand);
    FullStackTestIpcHandler.register();
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const server = new WebEditServer(rpcConfig.protocol);
    await server.initialize(port);
    console.log(`Web backend for full-stack-tests listening on port ${port}`);

    await LocalhostIpcHost.startup({ iModelHost, localhostIpcHost: { noServer: true } });

    EditCommandAdmin.registerModule(testCommands);
    EditCommandAdmin.register(BasicManipulationCommand);
    FullStackTestIpcHandler.register();
  }

  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver();

  Logger.initializeToConsole();
  Logger.setLevel("core-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("core-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture
}

/** A FileNameResolver for resolving test iModel files from core/backend */
class BackendTestAssetResolver extends FileNameResolver {
  /** Resolve a base file name to a full path file name in the core/backend/lib/cjs/test/assets/ directory. */
  public override tryResolveFileName(inFileName: string): string {
    if (path.isAbsolute(inFileName)) {
      return inFileName;
    }
    return path.join(__dirname, "../../../../core/backend/lib/cjs/test/assets/", inFileName);
  }
  /** Resolve a key (for testing FileNameResolver) */
  public override tryResolveKey(fileKey: string): string | undefined {
    switch (fileKey) {
      case "test-key": return this.tryResolveFileName("test.bim");
      case "test2-key": return this.tryResolveFileName("test2.bim");
      default: return undefined;
    }
  }
}

module.exports = init();

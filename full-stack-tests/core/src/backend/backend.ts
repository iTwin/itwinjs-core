/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./RpcImpl";
// Sets up certa to allow a method on the frontend to get an access token
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";

import * as fs from "fs";
import * as path from "path";
import {
  BriefcaseDb, FileNameResolver, IModelDb, IModelHost, IModelHostOptions, IpcHandler, IpcHost, LocalhostIpcHost, PhysicalModel, PhysicalPartition,
  SpatialCategory, SubjectOwnsPartitionElements,
} from "@itwin/core-backend";
import { Id64String, Logger, ProcessDetector } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, CodeProps, ElementProps, IModel, RelatedElement, RpcConfiguration, SubCategoryAppearance } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { BasicManipulationCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { WebEditServer } from "@itwin/express-server";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { exposeBackendCallbacks } from "../certa/certaBackend";
import { fullstackIpcChannel, FullStackTestIpc } from "../common/FullStackTestIpc";
import { rpcInterfaces } from "../common/RpcInterfaces";
import * as testCommands from "./TestEditCommands";

/* eslint-disable no-console */

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error)
    throw envResult.error;

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
    return iModelDb.elements.insertElement(modeledElement.toJSON());
  }

  public async createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    const eid = await FullStackTestIpcHandler.createAndInsertPartition(iModelDb, newModelCode);
    const modeledElementRef = new RelatedElement({ id: eid });
    const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: false });
    return iModelDb.models.insertModel(newModel.toJSON());
  }

  public async createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    const category = SpatialCategory.create(iModelDb, scopeModelId, categoryName);
    const categoryId = category.insert();
    category.setDefaultAppearance(appearance);
    return categoryId;
  }

  public async closeAndReopenDb(key: string): Promise<void> {
    const iModel = BriefcaseDb.findByKey(key);
    return iModel.executeWritable(async () => undefined);
  }
}

async function init() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  RpcConfiguration.developmentMode = true;

  const iModelHost: IModelHostOptions = {};
  const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);
  iModelHost.cacheDir = path.join(__dirname, ".cache");  // Set local cache dir

  let shutdown: undefined | (() => Promise<void>);

  if (ProcessDetector.isElectronAppBackend) {
    exposeBackendCallbacks();
    const authClient = new ElectronMainAuthorization({
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
      redirectUris: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI !== undefined ? [process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI] : ["testRedirectUri"],
      scopes: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
    });
    await authClient.signInSilent();
    iModelHost.authorizationClient = authClient;
    await ElectronHost.startup({ electronHost: { rpcInterfaces }, iModelHost });
    await authClient.signInSilent();

    EditCommandAdmin.registerModule(testCommands);
    EditCommandAdmin.register(BasicManipulationCommand);
    FullStackTestIpcHandler.register();
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const webEditServer = new WebEditServer(rpcConfig.protocol);
    const httpServer = await webEditServer.initialize(port);
    console.log(`Web backend for full-stack-tests listening on port ${port}`);

    await LocalhostIpcHost.startup({ iModelHost, localhostIpcHost: { noServer: true } });

    EditCommandAdmin.registerModule(testCommands);
    EditCommandAdmin.register(BasicManipulationCommand);
    FullStackTestIpcHandler.register();
    shutdown = async () => {
      await new Promise((resolve) => httpServer.close(resolve));
      await IpcHost.shutdown();
    };
  }

  ECSchemaRpcImpl.register();

  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver();
  Logger.initializeToConsole();
  return shutdown;
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

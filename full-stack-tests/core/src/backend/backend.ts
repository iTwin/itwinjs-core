/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./RpcImpl";
// Sets up certa to allow a method on the frontend to get an access token
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";

import {
  BriefcaseDb, CategorySelector, DefinitionModel, DisplayStyle2d, DocumentListModel, DocumentPartition, DrawingCategory, DrawingViewDefinition, FileNameResolver, IModelDb, IModelHost, IModelHostOptions, IpcHandler, IpcHost, LocalhostIpcHost, PhysicalModel, PhysicalPartition,
  Sheet, SheetModel, SnapshotDb, SpatialCategory, StandaloneDb, Subject, SubjectOwnsPartitionElements,
} from "@itwin/core-backend";
import { Guid, Id64String, Logger, LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, Code, CodeProps, constructDetailedError, constructITwinError, ElementProps, GeometricModel2dProps, IModel, ITwinError, RelatedElement, RpcConfiguration, SheetProps, SubCategoryAppearance, ViewAttachmentProps, ViewStateProps } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { BasicManipulationCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { WebEditServer } from "@itwin/express-server";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import * as fs from "fs";
import * as path from "path";
import { exposeBackendCallbacks } from "../certa/certaBackend";
import { fullstackIpcChannel, FullStackTestIpc } from "../common/FullStackTestIpc";
import { rpcInterfaces } from "../common/RpcInterfaces";
import * as testCommands from "./TestEditCommands";
import { IModelConnection } from "@itwin/core-frontend";
import { Range2d } from "@itwin/core-geometry";

/* eslint-disable no-console */

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
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

  public async throwDetailedError<T extends ITwinError>(details: Omit<T, keyof ITwinError>, namespace: string, errorKey: string, message?: string, metaData?: LoggingMetaData): Promise<void> {
    const error = constructDetailedError<T>(namespace, errorKey, details, message, metaData);
    throw error;
  }

  public async throwITwinError(namespace: string, errorKey: string, message?: string, metadata?: LoggingMetaData): Promise<void> {
    const error = constructITwinError(namespace, errorKey, message, metadata);
    throw error;
  }

  public async insertViewAttachmentAndGetSheetViewProps(): Promise<ViewStateProps> {
    const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/sheetViewTest.bim");
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    //create a new StandaloneDb for the test
    const standaloneModel = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "SheetView tests", description: "SheetView tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    const getOrCreateDocumentList = async (db: IModelDb): Promise<Id64String> => {
      const documentListName = "SheetList";
      let documentListModelId: string | undefined;

      // Attempt to find an existing document partition and document list model
      const ids = db.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'`});
      if (ids.size === 1) {
        documentListModelId = ids.values().next().value;
      }

      // If they do not exist, create the document partition and document list model
      if (documentListModelId === undefined) {
        const subjectId = db.elements.getRootSubject().id;
        await db.locks.acquireLocks({
          shared: subjectId,
        });
        documentListModelId = DocumentListModel.insert(db, subjectId, documentListName);
      }

      return documentListModelId;
    };

    const insertSheet = async (db: IModelDb, sheetName: string): Promise<Id64String> => {
      const createSheetProps = {
        height: 42,
        width: 42,
        scale: 42,
      };
      // Get or make documentListModelId
      const id = await getOrCreateDocumentList(db);

      // Acquire locks and create sheet
      await db.locks.acquireLocks({ shared: id });
      const sheetElementProps: SheetProps = {
        ...createSheetProps,
        classFullName: Sheet.classFullName,
        code: Sheet.createCode(db, id, sheetName),
        model: id,
      };
      const sheetElementId = db.elements.insertElement(sheetElementProps);

      const sheetModelProps: GeometricModel2dProps = {
        classFullName: SheetModel.classFullName,
        modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
      };
      return db.models.insertModel(sheetModelProps);
    };

    function createJobSubjectElement(iModel: IModelDb, name: string): Subject {
      const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
      subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention
      return subj;
    }

    const jobSubjectId = createJobSubjectElement(standaloneModel, "Job").insert();
    const drawingDefinitionModelId = DefinitionModel.insert(standaloneModel, jobSubjectId, "DrawingDefinition");
    const drawingCategoryId = DrawingCategory.insert(standaloneModel, drawingDefinitionModelId, "DrawingCategory", new SubCategoryAppearance());
    const sheetModelId = await insertSheet(standaloneModel, "sheet-1");

    const newAttachmentProps: ViewAttachmentProps = {
      classFullName: 'BisCore:ViewAttachment',
      model: sheetModelId,
      code: Code.createEmpty(),
      jsonProperties: { displayPriority: 0},
      view: { id: '0x99', relClassName: 'BisCore.ViewIsAttached' },
      category: drawingCategoryId,
      placement: { origin: { x: 100, y: 0 }, angle: 0 },
    }

    //create new view attachment element
    const newElement = standaloneModel.elements.createElement(newAttachmentProps);
    const attachmentId =  standaloneModel.elements.insertElement(newElement.toJSON());

    const displayStyle2dId = DisplayStyle2d.insert(standaloneModel, drawingDefinitionModelId, "DisplayStyle2d");
    const drawingCategorySelectorId = CategorySelector.insert(standaloneModel, drawingDefinitionModelId, "DrawingCategories", [drawingCategoryId]);
    const drawingViewRange = new Range2d(0, 0, 100, 100);
    const drawingViewId = DrawingViewDefinition.insert(standaloneModel, drawingDefinitionModelId, "Drawing View", sheetModelId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);

    //create new sheet view
    const sheetViewProps = await standaloneModel.views.getViewStateProps(drawingViewId);
    const codeProps = { spec: "", scope: "", value: "" };
    sheetViewProps.sheetProps = {
      model: "",
      code: codeProps,
      classFullName: "",
      width: 100,
      height: 100,
      scale: 1,
    };
    sheetViewProps.sheetAttachments = [attachmentId];
    standaloneModel.close();

    return sheetViewProps;
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

  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver(); // eslint-disable-line @typescript-eslint/no-deprecated
  Logger.initializeToConsole();
  return shutdown;
}

/** A FileNameResolver for resolving test iModel files from core/backend */
class BackendTestAssetResolver extends FileNameResolver { // eslint-disable-line @typescript-eslint/no-deprecated
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

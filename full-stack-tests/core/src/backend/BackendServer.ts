/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Standalone backend server for Chrome/web test mode.
// Starts the RPC web server, IPC host, edit commands, and schema services.
// Run via `node lib/backend/BackendServer.js` before vitest.

import "./RpcImpl";

import {
  BriefcaseDb, CategorySelector, DefinitionModel, DefinitionPartition, DisplayStyle2d, DocumentListModel, DocumentPartition, Drawing, DrawingCategory, DrawingViewDefinition, EditTxn, FileNameResolver, IModelDb, IModelHost, IModelHostOptions, IpcHandler, IpcHost, LocalhostIpcHost, PhysicalModel, PhysicalPartition,
  Sheet, SheetModel, SheetViewDefinition, SpatialCategory, StandaloneDb, SubCategory, Subject, SubjectOwnsPartitionElements,
  withEditTxn,
} from "@itwin/core-backend";
import { Id64String, Logger, LoggingMetaData } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, ChannelControlError, Code, CodeProps, ConflictingLock, ConflictingLocksError, ElementProps, GeometricModel2dProps, IModel, RelatedElement, RpcConfiguration, SheetProps, SubCategoryAppearance, ViewAttachmentProps } from "@itwin/core-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { BasicManipulationCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { WebEditServer } from "@itwin/express-server";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { AzureClientStorage, BlockBlobClientWrapperFactory } from "@itwin/object-storage-azure";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fullstackIpcChannel, FullStackTestIpc } from "../common/FullStackTestIpc";
import { rpcInterfaces } from "../common/RpcInterfaces";
import * as testCommands from "./TestEditCommands";
import { Range2d } from "@itwin/core-geometry";
import { AzuriteTest } from "./AzuriteTest";
import { loadEnv } from "./loadEnv";

/* eslint-disable no-console */

export class FullStackTestIpcHandler extends IpcHandler implements FullStackTestIpc {
  public get channelName() { return fullstackIpcChannel; }

  public async closeAndReopenDb(key: string): Promise<void> {
    const iModel = BriefcaseDb.findByKey(key);
    return iModel.executeWritable(async () => undefined);
  }

  public async createTempBimCopy(sourcePath: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "itj-fullstack-"));
    const destPath = path.join(tempDir, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  }

  public async deleteTempBimCopy(tempFilePath: string): Promise<void> {
    // Remove the enclosing temp dir so SQLite sidecar files (-journal/-wal/-shm) are cleaned up too.
    const tempDir = path.dirname(tempFilePath);
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
  }

  public async throwChannelError(errorKey: ChannelControlError.Key, message: string, channelKey: string) {
    ChannelControlError.throwError(errorKey, message, channelKey);
  }

  public async throwLockError(conflictingLocks: ConflictingLock[], message: string, metaData: LoggingMetaData, logFn: boolean) {
    throw new ConflictingLocksError(message, logFn ? () => metaData : metaData, conflictingLocks);
  }

  public async restoreAuthClient() {
    IModelHost.authorizationClient = electronAuth;
  }

  public async useAzTestAuthClient() {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
  }

  public async setAzTestUser(user: "admin" | "readOnly" | "readWrite") {
    AzuriteTest.userToken = AzuriteTest.service.userToken[user];
  }

  public static createAndInsertPartition(txn: EditTxn, newModelCode: CodeProps): Id64String {
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement = txn.iModel.elements.createElement(modeledElementProps);
    return txn.insertElement(modeledElement.toJSON());
  }

  public async createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    return withEditTxn(iModelDb, "create physical model", (txn) => {
      const eid = FullStackTestIpcHandler.createAndInsertPartition(txn, newModelCode);
      const modeledElementRef = new RelatedElement({ id: eid });
      const newModel = iModelDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: false });
      return txn.insertModel(newModel.toJSON());
    });
  }

  public async createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(key);
    return withEditTxn(iModelDb, "create spatial category", (txn) => {
      const category = SpatialCategory.create(iModelDb, scopeModelId, categoryName);
      const categoryId = txn.insertElement(category.toJSON());
      const subCategory = iModelDb.elements.getElement<SubCategory>(IModelDb.getDefaultSubCategoryId(categoryId));
      subCategory.appearance = new SubCategoryAppearance(appearance);
      txn.updateElement(subCategory.toJSON());
      return categoryId;
    });
  }

  public async insertElement(iModelKey: string, props: ElementProps): Promise<Id64String> {
    const iModelDb = IModelDb.findByKey(iModelKey);
    return withEditTxn(iModelDb, "insert element", (txn) => txn.insertElement(props));
  }

  public async updateElement(iModelKey: string, props: ElementProps): Promise<void> {
    const iModelDb = IModelDb.findByKey(iModelKey);
    return withEditTxn(iModelDb, "update element", (txn) => {
      txn.updateElement(props);
    });
  }

  public async deleteDefinitionElements(iModelKey: string, ids: string[]): Promise<void> {
    const iModelDb = IModelDb.findByKey(iModelKey);
    return withEditTxn(iModelDb, "delete definition elements", (txn) => {
      txn.deleteDefinitionElements(ids);
    });
  }


  public async insertSheetViewWithAttachment(filePath: string): Promise<Id64String> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const standaloneModel = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "SheetView tests", description: "SheetView tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
    });

    const getOrCreateDocumentList = async (txn: EditTxn): Promise<Id64String> => {
      const db = txn.iModel;
      const documentListName = "SheetList";
      let documentListModelId: string | undefined;

      const ids = db.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'`});
      if (ids.size === 1) {
        documentListModelId = ids.values().next().value;
      }

      if (documentListModelId === undefined) {
        const subjectId = db.elements.getRootSubject().id;
        await db.locks.acquireLocks({
          shared: subjectId,
        });
        documentListModelId = DocumentListModel.insert(txn, subjectId, documentListName);
      }

      return documentListModelId;
    };

    const insertSheet = async (txn: EditTxn, sheetName: string): Promise<Id64String> => {
      const db = txn.iModel;
      const createSheetProps = {
        height: 42,
        width: 42,
        scale: 42,
      };
      const id = await getOrCreateDocumentList(txn);

      await db.locks.acquireLocks({ shared: id });
      const sheetElementProps: SheetProps = {
        ...createSheetProps,
        classFullName: Sheet.classFullName,
        code: Sheet.createCode(db, id, sheetName),
        model: id,
      };
      const sheetElementId = txn.insertElement(sheetElementProps);

      const sheetModelProps: GeometricModel2dProps = {
        classFullName: SheetModel.classFullName,
        modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
      };
      return txn.insertModel(sheetModelProps);
    };

    function createJobSubjectElement(iModel: IModelDb, name: string): Subject {
      const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
      subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention
      return subj;
    }

    const sheetViewId = await withEditTxn(standaloneModel, "create sheet view with attachment", async (txn) => {
      const jobSubjectId = createJobSubjectElement(standaloneModel, "Job").insert(txn);
      const drawingDefinitionPartitionId = txn.insertElement({
        classFullName: DefinitionPartition.classFullName,
        model: IModel.repositoryModelId,
        parent: new SubjectOwnsPartitionElements(jobSubjectId),
        code: DefinitionPartition.createCode(standaloneModel, jobSubjectId, "DrawingDefinition"),
      });
      const drawingDefinitionModelId = txn.insertModel({
        classFullName: DefinitionModel.classFullName,
        modeledElement: { id: drawingDefinitionPartitionId },
      });
      const drawingCategoryId = DrawingCategory.insert(txn, drawingDefinitionModelId, "DrawingCategory", new SubCategoryAppearance());
      const sheetModelId = await insertSheet(txn, "sheet-1");

      const displayStyle2dId = DisplayStyle2d.insert(txn, drawingDefinitionModelId, "DisplayStyle2d");
      const drawingCategorySelectorId = CategorySelector.insert(txn, drawingDefinitionModelId, "DrawingCategories", [drawingCategoryId]);
      const drawingViewRange = new Range2d(0, 0, 500, 500);
      const docListModelId = await getOrCreateDocumentList(txn);
      const drawingModelId = Drawing.insert(txn, docListModelId, "Drawing");
      const drawingViewId = DrawingViewDefinition.insert(txn, drawingDefinitionModelId, "Drawing View", drawingModelId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);

      const newAttachmentProps: ViewAttachmentProps = {
        classFullName: "BisCore:ViewAttachment",
        model: sheetModelId,
        code: Code.createEmpty(),
        jsonProperties: { displayPriority: 0 },
        view: { id: drawingViewId, relClassName: "BisCore.ViewIsAttached" },
        category: drawingCategoryId,
        placement: { origin: { x: 100, y: 100 }, angle: 0, bbox: { low: { x: 0, y: 0 }, high: { x: 1, y: 1 } } },
      };

      standaloneModel.elements.createElement(newAttachmentProps).insert(txn);

      return SheetViewDefinition.insert(txn, {
        definitionModelId: drawingDefinitionModelId,
        name: "Sheet View",
        baseModelId: sheetModelId,
        categorySelectorId: drawingCategorySelectorId,
        displayStyleId: displayStyle2dId,
        range: new Range2d(0, 0, 50, 50),
      });
    });

    const sheetViewProps = await standaloneModel.views.getViewStateProps(sheetViewId);
    if (sheetViewProps.sheetAttachments?.length !== 1) {
      throw new Error("missing view attachments in view props");
    }

    standaloneModel.close();

    // Adds the crucial entry to be_Local to enable editing with txns.
    StandaloneDb.convertToStandalone(filePath);

    return sheetViewId;
  }
}

// Used by restoreAuthClient IPC handler — set during Electron init in backend.ts
let electronAuth: any;

/** Set the ElectronMainAuthorization instance for IPC handlers to reference. */
export function setElectronAuth(auth: any) {
  electronAuth = auth;
}

export const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

async function startServer() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  RpcConfiguration.developmentMode = true;

  const iModelHost: IModelHostOptions = { implicitWriteEnforcement: "throw" };
  const iModelClient = new IModelsClient({ cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory()), api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);
  iModelHost.cacheDir = path.join(__dirname, ".cache");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

  const webEditServer = new WebEditServer(rpcConfig.protocol);
  const httpServer = await webEditServer.initialize(backendPort);
  console.log(`Web backend for full-stack-tests listening on port ${backendPort}`);

  await LocalhostIpcHost.startup({ iModelHost, localhostIpcHost: { noServer: true } });

  EditCommandAdmin.registerModule(testCommands);
  EditCommandAdmin.register(BasicManipulationCommand);
  FullStackTestIpcHandler.register();
  ECSchemaRpcImpl.register();

  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver(); // eslint-disable-line @typescript-eslint/no-deprecated
  Logger.initializeToConsole();

  console.log("Backend server ready.");

  // Keep the process alive; shutdown on SIGTERM/SIGINT
  const shutdown = async () => {
    await new Promise((resolve) => httpServer.close(resolve));
    await IpcHost.shutdown();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

/** A FileNameResolver for resolving test iModel files from core/backend */
export class BackendTestAssetResolver extends FileNameResolver { // eslint-disable-line @typescript-eslint/no-deprecated
  public override tryResolveFileName(inFileName: string): string {
    if (path.isAbsolute(inFileName)) {
      return inFileName;
    }
    return path.join(__dirname, "../../../../core/backend/lib/cjs/test/assets/", inFileName);
  }
  public override tryResolveKey(fileKey: string): string | undefined {
    switch (fileKey) {
      case "test-key": return this.tryResolveFileName("test.bim");
      case "test2-key": return this.tryResolveFileName("test2.bim");
      default: return undefined;
    }
  }
}

// Auto-start when run directly (not when imported by backend.ts for Electron mode)
if (require.main === module) {
  startServer().catch((err) => {
    console.error("Backend server failed to start:", err);
    process.exit(1);
  });
}

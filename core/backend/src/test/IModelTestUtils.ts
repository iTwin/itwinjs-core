/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackendITwinClientLoggerCategory } from "@bentley/backend-itwin-client";
import {
  BeEvent, BentleyLoggerCategory, ChangeSetStatus, DbResult, GuidString, Id64, Id64String, IDisposable, IModelStatus, Logger, LogLevel, OpenMode,
} from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { ChangeSet, IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import {
  Code, CodeProps, ElementProps, IModel, IModelError, IModelReadRpcInterface, IModelVersion, IModelVersionProps, PhysicalElementProps, RelatedElement,
  RequestNewBriefcaseProps, RpcConfiguration, RpcManager, RpcPendingResponse, SyncMode,
} from "@bentley/imodeljs-common";
import { IModelJsNative, NativeLoggerCategory } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext, ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { assert } from "chai";
import * as path from "path";
import { BackendLoggerCategory as BackendLoggerCategory } from "../BackendLoggerCategory";
import { CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { ClassRegistry } from "../ClassRegistry";
import { Drawing, PhysicalElement, Subject } from "../Element";
import {
  BriefcaseDb, BriefcaseManager, Element, IModelDb, IModelHost, IModelHostConfiguration, IModelJsFs, InformationPartitionElement, Model,
  PhysicalModel, PhysicalPartition, SnapshotDb, SpatialCategory, SubjectOwnsPartitionElements,
} from "../imodeljs-backend";
import { DrawingModel } from "../Model";
import { ElementDrivesElement, RelationshipProps } from "../Relationship";
import { DownloadAndOpenArgs, RpcBriefcaseUtility } from "../rpc-impl/RpcBriefcaseUtility";
import { Schema, Schemas } from "../Schema";
import { HubUtility } from "./integration/HubUtility";
import { KnownTestLocations } from "./KnownTestLocations";

/* eslint-disable @typescript-eslint/explicit-member-accessibility */

/** Class for simple test timing */
export class Timer {
  private _label: string;
  private _start: Date;
  constructor(label: string) {
    this._label = `\t${label}`;
    this._start = new Date();
  }

  public end() {

    const stop = new Date();
    const elapsed = stop.getTime() - this._start.getTime();
    // eslint-disable-next-line no-console
    console.log(`${this._label}: ${elapsed}ms`);
  }
}

export class TestIModelInfo {
  private _name: string;
  private _id: string;
  private _localReadonlyPath: string;
  private _localReadWritePath: string;
  private _changeSets: ChangeSet[];

  constructor(name: string) {
    this._name = name;
    this._id = "";
    this._localReadonlyPath = "";
    this._localReadWritePath = "";
    this._changeSets = [];
  }

  get name(): string { return this._name; }
  set name(name: string) { this._name = name; }
  get id(): string { return this._id; }
  set id(id: string) { this._id = id; }
  get localReadonlyPath(): string { return this._localReadonlyPath; }
  set localReadonlyPath(localReadonlyPath: string) { this._localReadonlyPath = localReadonlyPath; }
  get localReadWritePath(): string { return this._localReadWritePath; }
  set localReadWritePath(localReadWritePath: string) { this._localReadWritePath = localReadWritePath; }
  get changeSets(): ChangeSet[] { return this._changeSets; }
  set changeSets(changeSets: ChangeSet[]) { this._changeSets = changeSets; }
}

RpcConfiguration.developmentMode = true;

// Initialize the RPC interface classes used by tests
RpcManager.initializeInterface(IModelReadRpcInterface);

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
}

/**
 * Disables native code assertions from firing. This can be used by tests that intentionally
 * test failing operations. If those failing operations raise assertions in native code, the test
 * would fail unexpectedly in a debug build. In that case the native code assertions can be disabled with
 * this class.
 */
export class DisableNativeAssertions implements IDisposable {
  private _native: IModelJsNative.DisableNativeAssertions | undefined;

  constructor() {
    this._native = new IModelHost.platform.DisableNativeAssertions();
  }

  public dispose(): void {
    if (!this._native)
      return;

    this._native.dispose();
    this._native = undefined;
  }
}

export class TestBim extends Schema {
  public static get schemaName(): string { return "TestBim"; }

}
export interface TestRelationshipProps extends RelationshipProps {
  property1: string;
}
export class TestElementDrivesElement extends ElementDrivesElement implements TestRelationshipProps {
  public static get className(): string { return "TestElementDrivesElement"; }
  public property1!: string;
  public static rootChanged = new BeEvent<(props: RelationshipProps, imodel: IModelDb) => void>();
  public static validateOutput = new BeEvent<(props: RelationshipProps, imodel: IModelDb) => void>();
  public static deletedDependency = new BeEvent<(props: RelationshipProps, imodel: IModelDb) => void>();
  public static onRootChanged(props: RelationshipProps, imodel: IModelDb): void { this.rootChanged.raiseEvent(props, imodel); }
  public static onValidateOutput(props: RelationshipProps, imodel: IModelDb): void { this.validateOutput.raiseEvent(props, imodel); }
  public static onDeletedDependency(props: RelationshipProps, imodel: IModelDb): void { this.deletedDependency.raiseEvent(props, imodel); }
}
export interface TestPhysicalObjectProps extends PhysicalElementProps {
  intProperty: number;
}
export class TestPhysicalObject extends PhysicalElement implements TestPhysicalObjectProps {
  public static get className(): string { return "TestPhysicalObject"; }
  public intProperty!: number;
  public static beforeOutputsHandled = new BeEvent<(id: Id64String, imodel: IModelDb) => void>();
  public static allInputsHandled = new BeEvent<(id: Id64String, imodel: IModelDb) => void>();
  public static onBeforeOutputsHandled(id: Id64String, imodel: IModelDb): void { this.beforeOutputsHandled.raiseEvent(id, imodel); }
  public static onAllInputsHandled(id: Id64String, imodel: IModelDb): void { this.allInputsHandled.raiseEvent(id, imodel); }
}

export class IModelTestUtils {
  /** Helper to open a briefcase db */
  public static async downloadAndOpenBriefcase(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext }): Promise<BriefcaseDb> {
    const props = await BriefcaseManager.downloadBriefcase(args.requestContext, args);
    return BriefcaseDb.open(args.requestContext, { fileName: props.fileName });
  }

  public static async openBriefcaseUsingRpc(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext, deleteFirst?: boolean }): Promise<BriefcaseDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        contextId: args.contextId,
        iModelId: args.iModelId,
        changeSetId: (await BriefcaseManager.evaluateVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId)).changeSetId,
      },
      requestContext: args.requestContext,
      syncMode: args.briefcaseId === 0 ? SyncMode.PullOnly : SyncMode.PullAndPush,
      forceDownload: args.deleteFirst,
    };

    while (true) {
      try {
        return (await RpcBriefcaseUtility.open(openArgs)) as BriefcaseDb;
      } catch (error) {
        if (!(error instanceof RpcPendingResponse))
          throw error;
      }
    }
  }

  public static async downloadAndOpenCheckpoint(args: { requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, asOf?: IModelVersionProps }): Promise<SnapshotDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const checkpoint: CheckpointProps = {
      contextId: args.contextId,
      iModelId: args.iModelId,
      requestContext: args.requestContext,
      changeSetId: (await BriefcaseManager.evaluateVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId)).changeSetId,
    };

    return V1CheckpointManager.getCheckpointDb({ checkpoint, localFile: V1CheckpointManager.getFileName(checkpoint) });
  }

  public static async openCheckpointUsingRpc(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext, deleteFirst?: boolean }): Promise<SnapshotDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        contextId: args.contextId,
        iModelId: args.iModelId,
        changeSetId: (await BriefcaseManager.evaluateVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId)).changeSetId,
      },
      requestContext: args.requestContext,
      syncMode: SyncMode.FixedVersion,
      forceDownload: args.deleteFirst,
    };

    while (true) {
      try {
        return (await RpcBriefcaseUtility.open(openArgs)) as SnapshotDb;
      } catch (error) {
        if (!(error instanceof RpcPendingResponse))
          throw error;
      }
    }
  }

  public static async closeAndDeleteBriefcaseDb(requestContext: AuthorizedClientRequestContext, briefcaseDb: IModelDb) {
    const fileName = briefcaseDb.pathName;
    const iModelId = briefcaseDb.iModelId;
    briefcaseDb.close();

    await BriefcaseManager.deleteBriefcaseFiles(fileName, requestContext);

    // try to clean up empty briefcase directories, and empty iModel directories.
    if (0 === BriefcaseManager.getCachedBriefcases(iModelId).length) {
      IModelJsFs.removeSync(BriefcaseManager.getBriefcaseBasePath(iModelId));
      const imodelPath = BriefcaseManager.getIModelPath(iModelId);
      if (0 === IModelJsFs.readdirSync(imodelPath).length) {
        IModelJsFs.removeSync(imodelPath);
      }
    }
  }

  public static async getTestModelInfo(requestContext: AuthorizedClientRequestContext, testProjectId: string, iModelName: string): Promise<TestIModelInfo> {
    const iModelInfo = new TestIModelInfo(iModelName);
    iModelInfo.id = await HubUtility.queryIModelIdByName(requestContext, testProjectId, iModelInfo.name);

    iModelInfo.changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelInfo.id);
    return iModelInfo;
  }

  /** Prepare for an output file by:
   * - Resolving the output file name under the known test output directory
   * - Making directories as necessary
   * - Removing a previous copy of the output file
   * @param subDirName Sub-directory under known test output directory. Should match the name of the test file minus the .test.ts file extension.
   * @param fileName Name of output fille
   */
  public static prepareOutputFile(subDirName: string, fileName: string): string {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);

    const outputDir = path.join(KnownTestLocations.outputDir, subDirName);
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);

    const outputFile = path.join(outputDir, fileName);
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.unlinkSync(outputFile);

    return outputFile;
  }

  /** Resolve an asset file path from the asset name by looking in the known assets directory */
  public static resolveAssetFile(assetName: string): string {
    const assetFile = path.join(KnownTestLocations.assetsDir, assetName);
    assert.isTrue(IModelJsFs.existsSync(assetFile));
    return assetFile;
  }

  /** Orchestrates the steps necessary to create a new snapshot iModel from a seed file. */
  public static createSnapshotFromSeed(testFileName: string, seedFileName: string): SnapshotDb {
    const seedDb: SnapshotDb = SnapshotDb.openFile(seedFileName);
    const testDb: SnapshotDb = SnapshotDb.createFrom(seedDb, testFileName);
    seedDb.close();
    return testDb;
  }

  public static getUniqueModelCode(testDb: IModelDb, newModelCodeBase: string): Code {
    let newModelCode: string = newModelCodeBase;
    let iter: number = 0;
    while (true) {
      const modelCode = InformationPartitionElement.createCode(testDb, IModel.rootSubjectId, newModelCode);
      if (testDb.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static createAndInsertPhysicalPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    return testDb.elements.insertElement(modeledElement);
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static async createAndInsertPhysicalPartitionAsync(reqContext: AuthorizedClientRequestContext, testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Promise<Id64String> {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    if (testDb.isBriefcaseDb()) {
      await testDb.concurrencyControl.requestResourcesForInsert(reqContext, [modeledElement]);
      reqContext.enter();
    }
    return testDb.elements.insertElement(modeledElement);
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static createAndInsertPhysicalModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static async createAndInsertPhysicalModelAsync(reqContext: AuthorizedClientRequestContext, testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Promise<Id64String> {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    if (testDb.isBriefcaseDb()) {
      await testDb.concurrencyControl.requestResourcesForInsert(reqContext, [], [newModel]);
      reqContext.enter();
    }
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  // @return [modeledElementId, modelId]
  //
  public static createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  // @return [modeledElementId, modelId]
  //
  public static async createAndInsertPhysicalPartitionAndModelAsync(reqContext: AuthorizedClientRequestContext, testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parentId?: Id64String): Promise<Id64String[]> {
    const eid = await IModelTestUtils.createAndInsertPhysicalPartitionAsync(reqContext, testImodel, newModelCode, parentId);
    reqContext.enter();
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = await IModelTestUtils.createAndInsertPhysicalModelAsync(reqContext, testImodel, modeledElementRef, privateModel);
    reqContext.enter();
    return [eid, mid];
  }

  // Create and insert a Drawing Partition element (in the repositoryModel).
  public static createAndInsertDrawingPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: Drawing.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    return testDb.elements.insertElement(modeledElement);
  }

  // Create and insert a DrawingModel associated with Drawing Partition.
  public static createAndInsertDrawingModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: DrawingModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  //
  // Create and insert a Drawing Partition element (in the repositoryModel) and an associated DrawingModel.
  // @return [modeledElementId, modelId]
  //
  public static createAndInsertDrawingPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelTestUtils.createAndInsertDrawingPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertDrawingModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  public static getUniqueSpatialCategoryCode(scopeModel: Model, newCodeBaseValue: string): Code {
    let newCodeValue: string = newCodeBaseValue;
    let iter: number = 0;
    while (true) {
      if (SpatialCategory.queryCategoryIdByName(scopeModel.iModel, scopeModel.id, newCodeValue) === undefined)
        return SpatialCategory.createCode(scopeModel.iModel, scopeModel.id, newCodeValue);

      newCodeValue = newCodeBaseValue + iter;
      ++iter;
    }
  }

  // Create a PhysicalObject. (Does not insert it.)
  public static createPhysicalObject(testImodel: IModelDb, modelId: Id64String, categoryId: Id64String, elemCode?: Code): Element {
    const elementProps: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };
    return testImodel.elements.createElement(elementProps);
  }

  public static async startBackend(): Promise<void> {
    loadEnv(path.join(__dirname, "..", "..", ".env"));
    const config = new IModelHostConfiguration();
    config.concurrentQuery.concurrent = 4; // for test restrict this to two threads. Making closing connection faster
    await IModelHost.startup(config);
  }

  public static registerTestBimSchema() {
    if (undefined === Schemas.getRegisteredSchema(TestBim.schemaName)) {
      Schemas.registerSchema(TestBim);
      ClassRegistry.register(TestPhysicalObject, TestBim);
      ClassRegistry.register(TestElementDrivesElement, TestBim);
    }
  }

  public static async shutdownBackend(): Promise<void> {
    await IModelHost.shutdown();
  }

  public static setupLogging() {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);

    if (process.env.imjs_test_logging_config === undefined) {
      // eslint-disable-next-line no-console
      console.log(`You can set the environment variable imjs_test_logging_config to point to a logging configuration json file.`);
    }
    const loggingConfigFile: string = process.env.imjs_test_logging_config || path.join(__dirname, "logging.config.json");

    if (IModelJsFs.existsSync(loggingConfigFile)) {
      // eslint-disable-next-line no-console
      console.log(`Setting up logging levels from ${loggingConfigFile}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Logger.configureLevels(require(loggingConfigFile));
    }
  }

  public static init() {
    // dummy method to get this script included
  }

  private static initDebugLogLevels(reset?: boolean) {
    Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
    Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.Licensing, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(BackendITwinClientLoggerCategory.FileHandlers, reset ? LogLevel.Error : LogLevel.Trace);
  }

  // Setup typical programmatic log level overrides here
  // Convenience method used to debug specific tests/fixtures
  public static setupDebugLogLevels() {
    IModelTestUtils.initDebugLogLevels(false);
  }

  public static resetDebugLogLevels() {
    IModelTestUtils.initDebugLogLevels(true);
  }

  public static executeQuery(db: IModelDb, ecsql: string, bindings?: any[] | object): any[] {
    return db.withPreparedStatement(ecsql, (stmt) => {
      if (bindings)
        stmt.bindValues(bindings);

      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
        if (rows.length > IModelDb.maxLimit)
          throw new IModelError(IModelStatus.BadRequest, "Max LIMIT exceeded in SELECT statement");
      }

      return rows;
    });
  }

  public static createJobSubjectElement(iModel: IModelDb, name: string): Subject {
    const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
    subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention
    return subj;
  }

  /** Flushes the Txns in the TxnTable - this allows importing of schemas */
  public static flushTxns(iModelDb: IModelDb): boolean {
    const res: IModelJsNative.ErrorStatusOrResult<ChangeSetStatus, string> = iModelDb.nativeDb.startCreateChangeSet();
    if (res.error)
      return false;
    const status = iModelDb.nativeDb.finishCreateChangeSet();
    if (ChangeSetStatus.Success !== status)
      return false;
    return true;
  }
}

before(async () => {
  IModelTestUtils.setupLogging();
  await IModelTestUtils.startBackend();
});

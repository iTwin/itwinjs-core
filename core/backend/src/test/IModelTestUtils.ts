/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as path from "path";
import * as fs from "fs";
import { Base64 } from "js-base64";
import { BackendITwinClientLoggerCategory } from "@bentley/backend-itwin-client";
import {
  BeEvent, BentleyLoggerCategory, DbResult, Guid, GuidString, Id64, Id64String, IDisposable, IModelStatus, Logger, LogLevel, OpenMode,
} from "@bentley/bentleyjs-core";
import { IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import { Box, Cone, LineString3d, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  AuxCoordSystem2dProps,
  Base64EncodedString,
  BisCodeSpec,
  CategorySelectorProps,
  ChangesetIdWithIndex,
  Code, CodeProps, CodeScopeSpec, CodeSpec, ColorDef, ElementAspectProps, ElementProps, ExternalSourceProps, FontType, GeometricElement2dProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamIterator, GeometryStreamProps, ImageSourceFormat, IModel, IModelError, IModelReadRpcInterface, IModelVersion, IModelVersionProps, ModelSelectorProps, PhysicalElementProps, PlanProjectionSettings, RelatedElement,
  RepositoryLinkProps,
  RequestNewBriefcaseProps, RpcConfiguration, RpcManager, RpcPendingResponse, SkyBoxImageType, SpatialViewDefinitionProps, SubCategoryAppearance, SubCategoryOverride, SubjectProps, SyncMode,
} from "@bentley/imodeljs-common";
import { IModelJsNative, NativeLoggerCategory } from "@bentley/imodeljs-native";
import { AccessToken, AccessTokenProps, AuthorizedClientRequestContext, ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { TestUserCredentials, TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { BackendLoggerCategory as BackendLoggerCategory } from "../BackendLoggerCategory";
import { CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { ClassRegistry } from "../ClassRegistry";
import { DefinitionPartition, Drawing, DrawingGraphic, GeometryPart, LinkElement, PhysicalElement, RepositoryLink, Subject } from "../Element";
import {
  AuxCoordSystem2d,
  BackendRequestContext,
  BriefcaseDb, BriefcaseManager, CategorySelector, DisplayStyle2d, DisplayStyle3d, DrawingCategory, DrawingViewDefinition, ECSqlStatement, Element, ElementAspect, ElementOwnsChildElements, ElementOwnsMultiAspects, ElementOwnsUniqueAspect, ElementUniqueAspect, ExternalSource, ExternalSourceAspect, ExternalSourceIsInRepository, FunctionalModel, FunctionalSchema, GroupModel, IModelDb, IModelHost, IModelHostConfiguration, IModelJsFs, InformationPartitionElement, Model,
  ModelSelector,
  OrthographicViewDefinition,
  PhysicalModel, PhysicalObject, PhysicalPartition, Platform, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, SubjectOwnsPartitionElements, Texture, ViewDefinition,
} from "../imodeljs-backend";
export * as IModelJsBackend from "../imodeljs-backend";
import { DefinitionModel, DocumentListModel, DrawingModel, InformationRecordModel, SpatialLocationModel } from "../Model";
import { DrawingGraphicRepresentsElement, ElementDrivesElement, ElementRefersToElements, Relationship, RelationshipProps } from "../Relationship";
import { DownloadAndOpenArgs, RpcBriefcaseUtility } from "../rpc-impl/RpcBriefcaseUtility";
import { Schema, Schemas } from "../Schema";
import { HubMock } from "./HubMock";
import { HubUtility } from "./integration/HubUtility";
import { KnownTestLocations } from "./KnownTestLocations";

const assert = chai.assert;
chai.use(chaiAsPromised);

/* eslint-disable @typescript-eslint/explicit-member-accessibility */

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
  public static override get schemaName(): string { return "TestBim"; }

}
export interface TestRelationshipProps extends RelationshipProps {
  property1: string;
}
export class TestElementDrivesElement extends ElementDrivesElement implements TestRelationshipProps {
  public static override get className(): string { return "TestElementDrivesElement"; }
  public property1!: string;
  public static rootChanged = new BeEvent<(props: RelationshipProps, imodel: IModelDb) => void>();
  public static deletedDependency = new BeEvent<(props: RelationshipProps, imodel: IModelDb) => void>();
  public static override onRootChanged(props: RelationshipProps, imodel: IModelDb): void { this.rootChanged.raiseEvent(props, imodel); }
  public static override onDeletedDependency(props: RelationshipProps, imodel: IModelDb): void { this.deletedDependency.raiseEvent(props, imodel); }
}
export interface TestPhysicalObjectProps extends PhysicalElementProps {
  intProperty: number;
}
export class TestPhysicalObject extends PhysicalElement implements TestPhysicalObjectProps {
  public static override get className(): string { return "TestPhysicalObject"; }
  public intProperty!: number;
  public static beforeOutputsHandled = new BeEvent<(id: Id64String, imodel: IModelDb) => void>();
  public static allInputsHandled = new BeEvent<(id: Id64String, imodel: IModelDb) => void>();
  public static override onBeforeOutputsHandled(id: Id64String, imodel: IModelDb): void { this.beforeOutputsHandled.raiseEvent(id, imodel); }
  public static override onAllInputsHandled(id: Id64String, imodel: IModelDb): void { this.allInputsHandled.raiseEvent(id, imodel); }
}

/** the types of users available for tests */
export enum TestUserType {
  Regular,
  Manager,
  Super,
  SuperManager
}

export namespace IModelTestUtils {
  const testOrg = {
    name: "Test Organization",
    id: Guid.createValue(),
  };

  /** get an AuthorizedClientRequestContext for a [[TestUserType]].
     * @note if the current test is using [[HubMock]], calling this method multiple times with the same type will return users from the same organization,
     * but with different credentials. This can be useful for simulating more than one user of the same type on the same project.
     * However, if a real IModelHub is used, the credentials are supplied externally and will always return the same value (because otherwise they would not be valid.)
     */
  export async function getUserContext(user: TestUserType): Promise<AuthorizedClientRequestContext> {
    if (HubMock.isValid) {
      const firstName = TestUserType[user];
      const lastName = "User";
      const props: AccessTokenProps = {
        tokenString: "bogus",
        userInfo: {
          id: Guid.createValue(),
          email: {
            id: `${firstName}.user@test.org`,
          },
          profile: {
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
          },
          organization: testOrg,
        },
        startsAt: new Date(Date.now()).toJSON(),
        expiresAt: new Date(Date.now() + 60 * 60 * 100).toJSON(), /* 1 hour from now */
      };
      return new AuthorizedClientRequestContext(AccessToken.fromJson(props));
    }

    let credentials: TestUserCredentials;
    switch (user) {
      case TestUserType.Regular:
        credentials = TestUsers.regular;
        break;
      case TestUserType.Manager:
        credentials = TestUsers.manager;
        break;
      case TestUserType.Super:
        credentials = TestUsers.super;
        break;
      case TestUserType.SuperManager:
        credentials = TestUsers.superManager;
        break;
    }
    return TestUtility.getAuthorizedClientRequestContext(credentials);
  }

  /** Helper to open a briefcase db directly with the BriefcaseManager API */
  export async function downloadAndOpenBriefcase(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext }): Promise<BriefcaseDb> {
    assert.isTrue(HubUtility.allowHubBriefcases || HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const props = await BriefcaseManager.downloadBriefcase(args.requestContext, args);
    return BriefcaseDb.open(args.requestContext, { fileName: props.fileName });
  }

  /** Opens the specific iModel as a Briefcase through the same workflow the IModelReadRpc.openForRead method will use. Replicates the way a frontend would open the iModel. */
  export async function openBriefcaseUsingRpc(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext, deleteFirst?: boolean }): Promise<BriefcaseDb> {
    args.requestContext.enter();
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        contextId: args.contextId,
        iModelId: args.iModelId,
        changeset: (await BriefcaseManager.changesetFromVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId)),
      },
      requestContext: args.requestContext,
      syncMode: args.briefcaseId === 0 ? SyncMode.PullOnly : SyncMode.PullAndPush,
      forceDownload: args.deleteFirst,
    };

    assert.isTrue(HubMock.isValid || openArgs.syncMode === SyncMode.PullOnly, "use HubMock to acquire briefcases");
    while (true) {
      try {
        return (await RpcBriefcaseUtility.open(openArgs)) as BriefcaseDb;
      } catch (error) {
        if (!(error instanceof RpcPendingResponse))
          throw error;
      }
    }
  }

  /** Downloads and opens a v1 checkpoint */
  export async function downloadAndOpenCheckpoint(args: { requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, asOf?: IModelVersionProps }): Promise<SnapshotDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const checkpoint: CheckpointProps = {
      contextId: args.contextId,
      iModelId: args.iModelId,
      requestContext: args.requestContext,
      changeset: (await BriefcaseManager.changesetFromVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId)),
    };

    return V1CheckpointManager.getCheckpointDb({ checkpoint, localFile: V1CheckpointManager.getFileName(checkpoint) });
  }

  /** Opens the specific Checkpoint iModel, `SyncMode.FixedVersion`, through the same workflow the IModelReadRpc.openForRead method will use. Replicates the way a frontend would open the iModel. */
  export async function openCheckpointUsingRpc(args: RequestNewBriefcaseProps & { requestContext: AuthorizedClientRequestContext, deleteFirst?: boolean }): Promise<SnapshotDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const changeset = await BriefcaseManager.changesetFromVersion(args.requestContext, IModelVersion.fromJSON(args.asOf), args.iModelId);
    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        contextId: args.contextId,
        iModelId: args.iModelId,
        changeset,
      },
      requestContext: args.requestContext,
      syncMode: SyncMode.FixedVersion,
      forceDownload: args.deleteFirst,
    };
    args.requestContext.enter();

    while (true) {
      try {
        return (await RpcBriefcaseUtility.open(openArgs)) as SnapshotDb;
      } catch (error) {
        if (!(error instanceof RpcPendingResponse))
          throw error;
      }
    }
  }

  export async function closeAndDeleteBriefcaseDb(requestContext: AuthorizedClientRequestContext, briefcaseDb: IModelDb) {
    const fileName = briefcaseDb.pathName;
    const iModelId = briefcaseDb.iModelId;
    briefcaseDb.close();

    await BriefcaseManager.deleteBriefcaseFiles(fileName, requestContext);
    requestContext.enter();

    // try to clean up empty briefcase directories, and empty iModel directories.
    if (0 === BriefcaseManager.getCachedBriefcases(iModelId).length) {
      IModelJsFs.removeSync(BriefcaseManager.getBriefcaseBasePath(iModelId));
      const imodelPath = BriefcaseManager.getIModelPath(iModelId);
      if (0 === IModelJsFs.readdirSync(imodelPath).length) {
        IModelJsFs.removeSync(imodelPath);
      }
    }
  }

  /** Prepare for an output file by:
   * - Resolving the output file name under the known test output directory
   * - Making directories as necessary
   * - Removing a previous copy of the output file
   * @param subDirName Sub-directory under known test output directory. Should match the name of the test file minus the .test.ts file extension.
   * @param fileName Name of output fille
   */
  export function prepareOutputFile(subDirName: string, fileName: string): string {
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
  export function resolveAssetFile(assetName: string): string {
    const assetFile = path.join(KnownTestLocations.assetsDir, assetName);
    assert.isTrue(IModelJsFs.existsSync(assetFile));
    return assetFile;
  }

  /** Orchestrates the steps necessary to create a new snapshot iModel from a seed file. */
  export function createSnapshotFromSeed(testFileName: string, seedFileName: string): SnapshotDb {
    const seedDb: SnapshotDb = SnapshotDb.openFile(seedFileName);
    const testDb: SnapshotDb = SnapshotDb.createFrom(seedDb, testFileName);
    seedDb.close();
    return testDb;
  }

  export function getUniqueModelCode(testDb: IModelDb, newModelCodeBase: string): Code {
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

  export function generateChangeSetId(): ChangesetIdWithIndex {
    let result = "";
    for (let i = 0; i < 20; ++i) {
      result += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    }
    return { id: result };
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  export function createAndInsertPhysicalPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
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

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  export async function createAndInsertPhysicalPartitionAsync(reqContext: AuthorizedClientRequestContext, testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Promise<Id64String> {
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

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  export function createAndInsertPhysicalModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  export async function createAndInsertPhysicalModelAsync(reqContext: AuthorizedClientRequestContext, testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Promise<Id64String> {
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

  /**
   * Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
   * @return [modeledElementId, modelId]
   */
  export function createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  /**
   * Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
   * @return [modeledElementId, modelId]
   */
  export async function createAndInsertPhysicalPartitionAndModelAsync(reqContext: AuthorizedClientRequestContext, testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parentId?: Id64String): Promise<Id64String[]> {
    const eid = await IModelTestUtils.createAndInsertPhysicalPartitionAsync(reqContext, testImodel, newModelCode, parentId);
    reqContext.enter();
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = await IModelTestUtils.createAndInsertPhysicalModelAsync(reqContext, testImodel, modeledElementRef, privateModel);
    reqContext.enter();
    return [eid, mid];
  }

  /** Create and insert a Drawing Partition element (in the repositoryModel). */
  export function createAndInsertDrawingPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
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

  /** Create and insert a DrawingModel associated with Drawing Partition. */
  export function createAndInsertDrawingModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: DrawingModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  /**
   * Create and insert a Drawing Partition element (in the repositoryModel) and an associated DrawingModel.
   * @return [modeledElementId, modelId]
   */
  export function createAndInsertDrawingPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelTestUtils.createAndInsertDrawingPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertDrawingModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  export function getUniqueSpatialCategoryCode(scopeModel: Model, newCodeBaseValue: string): Code {
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
  export function createPhysicalObject(testImodel: IModelDb, modelId: Id64String, categoryId: Id64String, elemCode?: Code): Element {
    const elementProps: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };
    return testImodel.elements.createElement(elementProps);
  }

  /** Handles the startup of IModelHost.
   * The provided config is used and will override any of the default values used in this method.
   *
   * The default includes:
   * - concurrentQuery.current === 4
   * - cacheDir === path.join(__dirname, ".cache")
   */
  export async function startBackend(config?: IModelHostConfiguration): Promise<void> {
    loadEnv(path.join(__dirname, "..", "..", ".env"));
    const cfg = config ? config : new IModelHostConfiguration();
    cfg.concurrentQuery.concurrent = 4; // for test restrict this to two threads. Making closing connection faster
    cfg.cacheDir = path.join(__dirname, ".cache");  // Set the cache dir to be under the lib directory.
    return IModelHost.startup(cfg);
  }

  export function registerTestBimSchema() {
    if (undefined === Schemas.getRegisteredSchema(TestBim.schemaName)) {
      Schemas.registerSchema(TestBim);
      ClassRegistry.register(TestPhysicalObject, TestBim);
      ClassRegistry.register(TestElementDrivesElement, TestBim);
    }
  }

  export async function shutdownBackend(): Promise<void> {
    return IModelHost.shutdown();
  }

  export function setupLogging() {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);

    if (process.env.IMJS_TEST_LOGGING_CONFIG === undefined) {
      // eslint-disable-next-line no-console
      console.log(`You can set the environment variable IMJS_TEST_LOGGING_CONFIG to point to a logging configuration json file.`);
    }
    const loggingConfigFile: string = process.env.IMJS_TEST_LOGGING_CONFIG || path.join(__dirname, "logging.config.json");

    if (IModelJsFs.existsSync(loggingConfigFile)) {
      // eslint-disable-next-line no-console
      console.log(`Setting up logging levels from ${loggingConfigFile}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Logger.configureLevels(require(loggingConfigFile));
    }
  }

  export function init() {
    // dummy method to get this script included
  }

  export function initDebugLogLevels(reset?: boolean) {
    Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
    Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(BackendITwinClientLoggerCategory.FileHandlers, reset ? LogLevel.Error : LogLevel.Trace);
  }

  // Setup typical programmatic log level overrides here
  // Convenience method used to debug specific tests/fixtures
  export function setupDebugLogLevels() {
    IModelTestUtils.initDebugLogLevels(false);
  }

  export function resetDebugLogLevels() {
    IModelTestUtils.initDebugLogLevels(true);
  }

  export function executeQuery(db: IModelDb, ecsql: string, bindings?: any[] | object): any[] {
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

  export function createJobSubjectElement(iModel: IModelDb, name: string): Subject {
    const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
    subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention
    return subj;
  }

  /** Flushes the Txns in the TxnTable - this allows importing of schemas */
  export function flushTxns(iModelDb: IModelDb): boolean {
    iModelDb.nativeDb.deleteAllTxns();
    return true;
  }

  const uniqueAspectGuid: GuidString = Guid.createValue();
  const federationGuid3: GuidString = Guid.createValue();

  export async function prepareSourceDb(sourceDb: IModelDb): Promise<void> {
    // Import desired schemas
    const requestContext = new BackendRequestContext();
    const sourceSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerSource.ecschema.xml");
    await sourceDb.importSchemas(requestContext, [FunctionalSchema.schemaFilePath, sourceSchemaFileName]);
    FunctionalSchema.registerSchema();
  }

  export function populateSourceDb(sourceDb: IModelDb): void {
    // Embed font
    if (Platform.platformName.startsWith("win")) {
      sourceDb.embedFont({ id: 1, type: FontType.TrueType, name: "Arial" });
      assert.exists(sourceDb.fontMap.getFont("Arial"));
      assert.exists(sourceDb.fontMap.getFont(1));
    }
    // Initialize project extents
    const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
    sourceDb.updateProjectExtents(projectExtents);
    // Insert CodeSpecs
    const codeSpecId1: Id64String = sourceDb.codeSpecs.insert("SourceCodeSpec", CodeScopeSpec.Type.Model);
    const codeSpecId2: Id64String = sourceDb.codeSpecs.insert("ExtraCodeSpec", CodeScopeSpec.Type.ParentElement);
    const codeSpecId3: Id64String = sourceDb.codeSpecs.insert("InformationRecords", CodeScopeSpec.Type.Model);
    assert.isTrue(Id64.isValidId64(codeSpecId1));
    assert.isTrue(Id64.isValidId64(codeSpecId2));
    assert.isTrue(Id64.isValidId64(codeSpecId3));
    // Insert RepositoryModel structure
    const subjectId = Subject.insert(sourceDb, IModel.rootSubjectId, "Subject", "Subject Description");
    assert.isTrue(Id64.isValidId64(subjectId));
    const sourceOnlySubjectId = Subject.insert(sourceDb, IModel.rootSubjectId, "Only in Source");
    assert.isTrue(Id64.isValidId64(sourceOnlySubjectId));
    const definitionModelId = DefinitionModel.insert(sourceDb, subjectId, "Definition");
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const informationModelId = InformationRecordModel.insert(sourceDb, subjectId, "Information");
    assert.isTrue(Id64.isValidId64(informationModelId));
    const groupModelId = GroupModel.insert(sourceDb, subjectId, "Group");
    assert.isTrue(Id64.isValidId64(groupModelId));
    const physicalModelId = PhysicalModel.insert(sourceDb, subjectId, "Physical");
    assert.isTrue(Id64.isValidId64(physicalModelId));
    const spatialLocationModelId = SpatialLocationModel.insert(sourceDb, subjectId, "SpatialLocation", true);
    assert.isTrue(Id64.isValidId64(spatialLocationModelId));
    const functionalModelId = FunctionalModel.insert(sourceDb, subjectId, "Functional");
    assert.isTrue(Id64.isValidId64(functionalModelId));
    const documentListModelId = DocumentListModel.insert(sourceDb, subjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingId = Drawing.insert(sourceDb, documentListModelId, "Drawing");
    assert.isTrue(Id64.isValidId64(drawingId));
    // Insert DefinitionElements
    const modelSelectorId = ModelSelector.insert(sourceDb, definitionModelId, "SpatialModels", [physicalModelId, spatialLocationModelId]);
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    const spatialCategoryId = insertSpatialCategory(sourceDb, definitionModelId, "SpatialCategory", ColorDef.green);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const sourcePhysicalCategoryId = insertSpatialCategory(sourceDb, definitionModelId, "SourcePhysicalCategory", ColorDef.blue);
    assert.isTrue(Id64.isValidId64(sourcePhysicalCategoryId));
    const subCategoryId = SubCategory.insert(sourceDb, spatialCategoryId, "SubCategory", { color: ColorDef.blue.toJSON() });
    assert.isTrue(Id64.isValidId64(subCategoryId));
    const filteredSubCategoryId = SubCategory.insert(sourceDb, spatialCategoryId, "FilteredSubCategory", { color: ColorDef.green.toJSON() });
    assert.isTrue(Id64.isValidId64(filteredSubCategoryId));
    const drawingCategoryId = DrawingCategory.insert(sourceDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    const spatialCategorySelectorId = CategorySelector.insert(sourceDb, definitionModelId, "SpatialCategories", [spatialCategoryId, sourcePhysicalCategoryId]);
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId = CategorySelector.insert(sourceDb, definitionModelId, "DrawingCategories", [drawingCategoryId]);
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const auxCoordSystemProps: AuxCoordSystem2dProps = {
      classFullName: AuxCoordSystem2d.classFullName,
      model: definitionModelId,
      code: AuxCoordSystem2d.createCode(sourceDb, definitionModelId, "AuxCoordSystem2d"),
    };
    const auxCoordSystemId = sourceDb.elements.insertElement(auxCoordSystemProps);
    assert.isTrue(Id64.isValidId64(auxCoordSystemId));
    const textureId = insertTextureElement(sourceDb, definitionModelId, "Texture");
    assert.isTrue(Id64.isValidId64(textureId));
    const renderMaterialId = RenderMaterialElement.insert(sourceDb, definitionModelId, "RenderMaterial", new RenderMaterialElement.Params("PaletteName"));
    assert.isTrue(Id64.isValidId64(renderMaterialId));
    const geometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(sourceDb, definitionModelId, "GeometryPart"),
      geom: createBox(Point3d.create(3, 3, 3)),
    };
    const geometryPartId = sourceDb.elements.insertElement(geometryPartProps);
    assert.isTrue(Id64.isValidId64(geometryPartId));
    // Insert InformationRecords
    const informationRecordProps1: any = {
      classFullName: "TestTransformerSource:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord1" },
      commonString: "Common1",
      sourceString: "One",
    };
    const informationRecordId1: Id64String = sourceDb.elements.insertElement(informationRecordProps1);
    assert.isTrue(Id64.isValidId64(informationRecordId1));
    const informationRecordProps2: any = {
      classFullName: "TestTransformerSource:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord2" },
      commonString: "Common2",
      sourceString: "Two",
    };
    const informationRecordId2: Id64String = sourceDb.elements.insertElement(informationRecordProps2);
    assert.isTrue(Id64.isValidId64(informationRecordId2));
    const informationRecordProps3: any = {
      classFullName: "TestTransformerSource:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord3" },
      commonString: "Common3",
      sourceString: "Three",
    };
    const informationRecordId3: Id64String = sourceDb.elements.insertElement(informationRecordProps3);
    assert.isTrue(Id64.isValidId64(informationRecordId3));
    // Insert PhysicalObject1
    const physicalObjectProps1: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject1",
      geom: createBox(Point3d.create(1, 1, 1), spatialCategoryId, subCategoryId, renderMaterialId, geometryPartId),
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1: Id64String = sourceDb.elements.insertElement(physicalObjectProps1);
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    // Insert PhysicalObject1 children
    const childObjectProps1A: PhysicalElementProps = physicalObjectProps1;
    childObjectProps1A.userLabel = "ChildObject1A";
    childObjectProps1A.parent = new ElementOwnsChildElements(physicalObjectId1);
    childObjectProps1A.placement!.origin = Point3d.create(0, 1, 1);
    const childObjectId1A: Id64String = sourceDb.elements.insertElement(childObjectProps1A);
    assert.isTrue(Id64.isValidId64(childObjectId1A));
    const childObjectProps1B: PhysicalElementProps = childObjectProps1A;
    childObjectProps1B.userLabel = "ChildObject1B";
    childObjectProps1B.placement!.origin = Point3d.create(1, 0, 1);
    const childObjectId1B: Id64String = sourceDb.elements.insertElement(childObjectProps1B);
    assert.isTrue(Id64.isValidId64(childObjectId1B));
    // Insert PhysicalObject2
    const physicalObjectProps2: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject2",
      geom: createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(2, 2, 2),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId2: Id64String = sourceDb.elements.insertElement(physicalObjectProps2);
    assert.isTrue(Id64.isValidId64(physicalObjectId2));
    // Insert PhysicalObject3
    const physicalObjectProps3: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      federationGuid: federationGuid3,
      userLabel: "PhysicalObject3",
    };
    const physicalObjectId3: Id64String = sourceDb.elements.insertElement(physicalObjectProps3);
    assert.isTrue(Id64.isValidId64(physicalObjectId3));
    // Insert PhysicalObject4
    const physicalObjectProps4: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject4",
      geom: createBoxes([subCategoryId, filteredSubCategoryId]),
      placement: {
        origin: Point3d.create(4, 4, 4),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId4: Id64String = sourceDb.elements.insertElement(physicalObjectProps4);
    assert.isTrue(Id64.isValidId64(physicalObjectId4));
    // Insert PhysicalElement1
    const sourcePhysicalElementProps: PhysicalElementProps = {
      classFullName: "TestTransformerSource:SourcePhysicalElement",
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalElement1",
      geom: createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(4, 4, 4),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
      sourceString: "S1",
      sourceDouble: 1.1,
      sourceNavigation: { id: sourcePhysicalCategoryId, relClassName: "TestTransformerSource:SourcePhysicalElementUsesSourceDefinition" },
      commonNavigation: { id: sourcePhysicalCategoryId },
      commonString: "Common",
      commonDouble: 7.3,
      sourceBinary: new Uint8Array([1, 3, 5, 7]),
      commonBinary: Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])),
      extraString: "Extra",
    } as PhysicalElementProps;
    const sourcePhysicalElementId: Id64String = sourceDb.elements.insertElement(sourcePhysicalElementProps);
    assert.isTrue(Id64.isValidId64(sourcePhysicalElementId));
    assert.doesNotThrow(() => sourceDb.elements.getElement(sourcePhysicalElementId));
    // Insert ElementAspects
    sourceDb.elements.insertAspect({
      classFullName: "TestTransformerSource:SourceUniqueAspect",
      element: new ElementOwnsUniqueAspect(physicalObjectId1),
      commonDouble: 1.1,
      commonString: "Unique",
      commonLong: physicalObjectId1,
      commonBinary: Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])),
      sourceDouble: 11.1,
      sourceString: "UniqueAspect",
      sourceLong: physicalObjectId1,
      sourceGuid: uniqueAspectGuid,
      extraString: "Extra",
    } as ElementAspectProps);
    const sourceUniqueAspect: ElementUniqueAspect = sourceDb.elements.getAspects(physicalObjectId1, "TestTransformerSource:SourceUniqueAspect")[0];
    assert.equal(sourceUniqueAspect.asAny.commonDouble, 1.1);
    assert.equal(sourceUniqueAspect.asAny.commonString, "Unique");
    assert.equal(sourceUniqueAspect.asAny.commonLong, physicalObjectId1);
    assert.equal(sourceUniqueAspect.asAny.sourceDouble, 11.1);
    assert.equal(sourceUniqueAspect.asAny.sourceString, "UniqueAspect");
    assert.equal(sourceUniqueAspect.asAny.sourceLong, physicalObjectId1);
    assert.equal(sourceUniqueAspect.asAny.sourceGuid, uniqueAspectGuid);
    assert.equal(sourceUniqueAspect.asAny.extraString, "Extra");
    sourceDb.elements.insertAspect({
      classFullName: "TestTransformerSource:SourceMultiAspect",
      element: new ElementOwnsMultiAspects(physicalObjectId1),
      commonDouble: 2.2,
      commonString: "Multi",
      commonLong: physicalObjectId1,
      sourceDouble: 22.2,
      sourceString: "MultiAspect",
      sourceLong: physicalObjectId1,
      sourceGuid: Guid.createValue(),
      extraString: "Extra",
    } as ElementAspectProps);
    sourceDb.elements.insertAspect({
      classFullName: "TestTransformerSource:SourceMultiAspect",
      element: new ElementOwnsMultiAspects(physicalObjectId1),
      commonDouble: 3.3,
      commonString: "Multi",
      commonLong: physicalObjectId1,
      sourceDouble: 33.3,
      sourceString: "MultiAspect",
      sourceLong: physicalObjectId1,
      sourceGuid: Guid.createValue(),
      extraString: "Extra",
    } as ElementAspectProps);
    sourceDb.elements.insertAspect({
      classFullName: "TestTransformerSource:SourceUniqueAspectToExclude",
      element: new ElementOwnsUniqueAspect(physicalObjectId1),
      description: "SourceUniqueAspect1",
    } as ElementAspectProps);
    sourceDb.elements.insertAspect({
      classFullName: "TestTransformerSource:SourceMultiAspectToExclude",
      element: new ElementOwnsMultiAspects(physicalObjectId1),
      description: "SourceMultiAspect1",
    } as ElementAspectProps);
    // Insert DrawingGraphics
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1: Id64String = sourceDb.elements.insertElement(drawingGraphicProps1);
    assert.isTrue(Id64.isValidId64(drawingGraphicId1));
    const drawingGraphicRepresentsId1: Id64String = DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId1, physicalObjectId1);
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId1));
    const drawingGraphicProps2: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic2",
      geom: createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(3, 3), angle: 0 },
    };
    const drawingGraphicId2: Id64String = sourceDb.elements.insertElement(drawingGraphicProps2);
    assert.isTrue(Id64.isValidId64(drawingGraphicId2));
    const drawingGraphicRepresentsId2: Id64String = DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId2, physicalObjectId1);
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId2));
    // Insert DisplayStyles
    const displayStyle2dId: Id64String = DisplayStyle2d.insert(sourceDb, definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValidId64(displayStyle2dId));
    const displayStyle3d: DisplayStyle3d = DisplayStyle3d.create(sourceDb, definitionModelId, "DisplayStyle3d");
    const subCategoryOverride: SubCategoryOverride = SubCategoryOverride.fromJSON({ color: ColorDef.from(1, 2, 3).toJSON() });
    displayStyle3d.settings.overrideSubCategory(subCategoryId, subCategoryOverride);
    displayStyle3d.settings.addExcludedElements(physicalObjectId1);
    displayStyle3d.settings.setPlanProjectionSettings(spatialLocationModelId, new PlanProjectionSettings({ elevation: 10.0 }));
    displayStyle3d.settings.environment = {
      sky: {
        image: {
          type: SkyBoxImageType.Spherical,
          texture: textureId,
        },
      },
    };
    const displayStyle3dId: Id64String = displayStyle3d.insert();
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    // Insert ViewDefinitions
    const viewId = OrthographicViewDefinition.insert(sourceDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, projectExtents, StandardViewIndex.Iso);
    assert.isTrue(Id64.isValidId64(viewId));
    sourceDb.views.setDefaultViewId(viewId);
    const drawingViewRange = new Range2d(0, 0, 100, 100);
    const drawingViewId = DrawingViewDefinition.insert(sourceDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
    assert.isTrue(Id64.isValidId64(drawingViewId));
    // Insert instance of SourceRelToExclude to test relationship exclusion by class
    const relationship1: Relationship = sourceDb.relationships.createInstance({
      classFullName: "TestTransformerSource:SourceRelToExclude",
      sourceId: spatialCategorySelectorId,
      targetId: drawingCategorySelectorId,
    });
    const relationshipId1: Id64String = sourceDb.relationships.insertInstance(relationship1);
    assert.isTrue(Id64.isValidId64(relationshipId1));
    // Insert instance of RelWithProps to test relationship property remapping
    const relationship2: Relationship = sourceDb.relationships.createInstance({
      classFullName: "TestTransformerSource:SourceRelWithProps",
      sourceId: spatialCategorySelectorId,
      targetId: drawingCategorySelectorId,
      sourceString: "One",
      sourceDouble: 1.1,
      sourceLong: spatialCategoryId,
      sourceGuid: Guid.createValue(),
    } as any);
    const relationshipId2: Id64String = sourceDb.relationships.insertInstance(relationship2);
    assert.isTrue(Id64.isValidId64(relationshipId2));
  }

  export function updateSourceDb(sourceDb: IModelDb): void {
    // Update Subject element
    const subjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subject: Subject = sourceDb.elements.getElement<Subject>(subjectId);
    subject.description = "Subject description (Updated)";
    sourceDb.elements.updateElement(subject);
    // Update spatialCategory element
    const definitionModelId = sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(sourceDb, subjectId, "Definition"))!;
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const spatialCategoryId = sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, definitionModelId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const spatialCategory: SpatialCategory = sourceDb.elements.getElement<SpatialCategory>(spatialCategoryId);
    spatialCategory.federationGuid = Guid.createValue();
    sourceDb.elements.updateElement(spatialCategory);
    // Update relationship properties
    const spatialCategorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, definitionModelId, "SpatialCategories"))!;
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, definitionModelId, "DrawingCategories"))!;
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const relWithProps: any = sourceDb.relationships.getInstanceProps(
      "TestTransformerSource:SourceRelWithProps",
      { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
    );
    assert.equal(relWithProps.sourceString, "One");
    assert.equal(relWithProps.sourceDouble, 1.1);
    relWithProps.sourceString += "-Updated";
    relWithProps.sourceDouble = 1.2;
    sourceDb.relationships.updateInstance(relWithProps);
    // Update ElementAspect properties
    const physicalObjectId1: Id64String = queryByUserLabel(sourceDb, "PhysicalObject1");
    const sourceUniqueAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "TestTransformerSource:SourceUniqueAspect");
    assert.equal(sourceUniqueAspects.length, 1);
    sourceUniqueAspects[0].asAny.commonString += "-Updated";
    sourceUniqueAspects[0].asAny.sourceString += "-Updated";
    sourceDb.elements.updateAspect(sourceUniqueAspects[0]);
    const sourceMultiAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "TestTransformerSource:SourceMultiAspect");
    assert.equal(sourceMultiAspects.length, 2);
    sourceMultiAspects[1].asAny.commonString += "-Updated";
    sourceMultiAspects[1].asAny.sourceString += "-Updated";
    sourceDb.elements.updateAspect(sourceMultiAspects[1]);
    // clear NavigationProperty of PhysicalElement1
    const physicalElementId1: Id64String = queryByUserLabel(sourceDb, "PhysicalElement1");
    let physicalElement1: PhysicalElement = sourceDb.elements.getElement(physicalElementId1);
    physicalElement1.asAny.commonNavigation = RelatedElement.none;
    physicalElement1.update();
    physicalElement1 = sourceDb.elements.getElement(physicalElementId1);
    assert.isUndefined(physicalElement1.asAny.commonNavigation);
    // delete PhysicalObject3
    const physicalObjectId3: Id64String = queryByUserLabel(sourceDb, "PhysicalObject3");
    assert.isTrue(Id64.isValidId64(physicalObjectId3));
    sourceDb.elements.deleteElement(physicalObjectId3);
    assert.equal(Id64.invalid, queryByUserLabel(sourceDb, "PhysicalObject3"));
    // Insert PhysicalObject5
    const physicalObjectProps5: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalElement1.model,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject5",
      geom: createBox(Point3d.create(1, 1, 1)),
      placement: {
        origin: Point3d.create(5, 5, 5),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId5: Id64String = sourceDb.elements.insertElement(physicalObjectProps5);
    assert.isTrue(Id64.isValidId64(physicalObjectId5));
    // delete relationship
    const drawingGraphicId1: Id64String = queryByUserLabel(sourceDb, "DrawingGraphic1");
    const drawingGraphicId2: Id64String = queryByUserLabel(sourceDb, "DrawingGraphic2");
    const relationship: Relationship = sourceDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId1 });
    relationship.delete();
    // insert relationships
    DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId1, physicalObjectId5);
    DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId2, physicalObjectId5);
    // update InformationRecord2
    const informationRecordCodeSpec: CodeSpec = sourceDb.codeSpecs.getByName("InformationRecords");
    const informationModelId = sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(sourceDb, subjectId, "Information"))!;
    const informationRecodeCode2: Code = new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord2" });
    const informationRecordId2: Id64String = sourceDb.elements.queryElementIdByCode(informationRecodeCode2)!;
    assert.isTrue(Id64.isValidId64(informationRecordId2));
    const informationRecord2: any = sourceDb.elements.getElement(informationRecordId2);
    informationRecord2.commonString = `${informationRecord2.commonString}-Updated`;
    informationRecord2.sourceString = `${informationRecord2.sourceString}-Updated`;
    informationRecord2.update();
    // delete InformationRecord3
    const informationRecodeCode3: Code = new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord3" });
    const informationRecordId3: Id64String = sourceDb.elements.queryElementIdByCode(informationRecodeCode3)!;
    assert.isTrue(Id64.isValidId64(informationRecordId3));
    sourceDb.elements.deleteElement(informationRecordId3);
  }

  export async function prepareTargetDb(targetDb: IModelDb): Promise<void> {
    // Import desired target schemas
    const requestContext = new BackendRequestContext();
    const targetSchemaFileName: string = path.join(KnownTestLocations.assetsDir, "TestTransformerTarget.ecschema.xml");
    await targetDb.importSchemas(requestContext, [targetSchemaFileName]);
    // Insert a target-only CodeSpec to test remapping
    const targetCodeSpecId: Id64String = targetDb.codeSpecs.insert("TargetCodeSpec", CodeScopeSpec.Type.Model);
    assert.isTrue(Id64.isValidId64(targetCodeSpecId));
    // Insert some elements to avoid getting same IDs for sourceDb and targetDb
    const subjectId = Subject.insert(targetDb, IModel.rootSubjectId, "Only in Target");
    Subject.insert(targetDb, subjectId, "S1");
    Subject.insert(targetDb, subjectId, "S2");
    Subject.insert(targetDb, subjectId, "S3");
    Subject.insert(targetDb, subjectId, "S4");
    const targetPhysicalCategoryId = insertSpatialCategory(targetDb, IModel.dictionaryId, "TargetPhysicalCategory", ColorDef.red);
    assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
  }

  export function assertTargetDbContents(sourceDb: IModelDb, targetDb: IModelDb, targetSubjectName: string = "Subject"): void {
    // CodeSpec
    assert.isTrue(targetDb.codeSpecs.hasName("TargetCodeSpec"));
    assert.isTrue(targetDb.codeSpecs.hasName("InformationRecords"));
    assert.isFalse(targetDb.codeSpecs.hasName("SourceCodeSpec"));
    assert.isFalse(targetDb.codeSpecs.hasName("ExtraCodeSpec"));
    // Font
    if (Platform.platformName.startsWith("win")) {
      assert.exists(targetDb.fontMap.getFont("Arial"));
    }
    // Subject
    const subjectId: Id64String = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, targetSubjectName))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subjectProps: SubjectProps = targetDb.elements.getElementProps(subjectId);
    assert.equal(subjectProps.description, `${targetSubjectName} Description`);
    const sourceOnlySubjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Only in Source"));
    assert.equal(undefined, sourceOnlySubjectId);
    const targetOnlySubjectId = targetDb.elements.queryElementIdByCode(Subject.createCode(targetDb, IModel.rootSubjectId, "Only in Target"))!;
    assert.isTrue(Id64.isValidId64(targetOnlySubjectId));
    // Partitions / Models
    const definitionModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Definition"))!;
    const informationModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Information"))!;
    const groupModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Group"))!;
    const physicalModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Physical"))!;
    const spatialLocationModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "SpatialLocation"))!;
    const documentListModelId = targetDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetDb, subjectId, "Document"))!;
    assertTargetElement(sourceDb, targetDb, definitionModelId);
    assertTargetElement(sourceDb, targetDb, informationModelId);
    assertTargetElement(sourceDb, targetDb, groupModelId);
    assertTargetElement(sourceDb, targetDb, physicalModelId);
    assertTargetElement(sourceDb, targetDb, spatialLocationModelId);
    assertTargetElement(sourceDb, targetDb, documentListModelId);
    const physicalModel: PhysicalModel = targetDb.models.getModel<PhysicalModel>(physicalModelId);
    const spatialLocationModel: SpatialLocationModel = targetDb.models.getModel<SpatialLocationModel>(spatialLocationModelId);
    assert.isFalse(physicalModel.isPlanProjection);
    assert.isTrue(spatialLocationModel.isPlanProjection);
    // SpatialCategory
    const spatialCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, definitionModelId, "SpatialCategory"))!;
    assertTargetElement(sourceDb, targetDb, spatialCategoryId);
    const spatialCategoryProps = targetDb.elements.getElementProps(spatialCategoryId);
    assert.equal(definitionModelId, spatialCategoryProps.model);
    assert.equal(definitionModelId, spatialCategoryProps.code.scope);
    assert.equal(undefined, targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, definitionModelId, "SourcePhysicalCategory")), "Should have been remapped");
    const targetPhysicalCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, IModel.dictionaryId, "TargetPhysicalCategory"))!;
    assert.isTrue(Id64.isValidId64(targetPhysicalCategoryId));
    // SubCategory
    const subCategoryId = targetDb.elements.queryElementIdByCode(SubCategory.createCode(targetDb, spatialCategoryId, "SubCategory"))!;
    assertTargetElement(sourceDb, targetDb, subCategoryId);
    const filteredSubCategoryId = targetDb.elements.queryElementIdByCode(SubCategory.createCode(targetDb, spatialCategoryId, "FilteredSubCategory"));
    assert.isUndefined(filteredSubCategoryId);
    // DrawingCategory
    const drawingCategoryId = targetDb.elements.queryElementIdByCode(DrawingCategory.createCode(targetDb, definitionModelId, "DrawingCategory"))!;
    assertTargetElement(sourceDb, targetDb, drawingCategoryId);
    const drawingCategoryProps = targetDb.elements.getElementProps(drawingCategoryId);
    assert.equal(definitionModelId, drawingCategoryProps.model);
    assert.equal(definitionModelId, drawingCategoryProps.code.scope);
    // Spatial CategorySelector
    const spatialCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "SpatialCategories"))!;
    assertTargetElement(sourceDb, targetDb, spatialCategorySelectorId);
    const spatialCategorySelectorProps = targetDb.elements.getElementProps<CategorySelectorProps>(spatialCategorySelectorId);
    assert.isTrue(spatialCategorySelectorProps.categories.includes(spatialCategoryId));
    assert.isTrue(spatialCategorySelectorProps.categories.includes(targetPhysicalCategoryId), "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    // Drawing CategorySelector
    const drawingCategorySelectorId = targetDb.elements.queryElementIdByCode(CategorySelector.createCode(targetDb, definitionModelId, "DrawingCategories"))!;
    assertTargetElement(sourceDb, targetDb, drawingCategorySelectorId);
    const drawingCategorySelectorProps = targetDb.elements.getElementProps<CategorySelectorProps>(drawingCategorySelectorId);
    assert.isTrue(drawingCategorySelectorProps.categories.includes(drawingCategoryId));
    // ModelSelector
    const modelSelectorId = targetDb.elements.queryElementIdByCode(ModelSelector.createCode(targetDb, definitionModelId, "SpatialModels"))!;
    assertTargetElement(sourceDb, targetDb, modelSelectorId);
    const modelSelectorProps = targetDb.elements.getElementProps<ModelSelectorProps>(modelSelectorId);
    assert.isTrue(modelSelectorProps.models.includes(physicalModelId));
    assert.isTrue(modelSelectorProps.models.includes(spatialLocationModelId));
    // Texture
    const textureId = targetDb.elements.queryElementIdByCode(Texture.createCode(targetDb, definitionModelId, "Texture"))!;
    assert.isTrue(Id64.isValidId64(textureId));
    // RenderMaterial
    const renderMaterialId = targetDb.elements.queryElementIdByCode(RenderMaterialElement.createCode(targetDb, definitionModelId, "RenderMaterial"))!;
    assert.isTrue(Id64.isValidId64(renderMaterialId));
    // GeometryPart
    const geometryPartId = targetDb.elements.queryElementIdByCode(GeometryPart.createCode(targetDb, definitionModelId, "GeometryPart"))!;
    assert.isTrue(Id64.isValidId64(geometryPartId));
    // PhysicalElement
    const physicalObjectId1: Id64String = queryByUserLabel(targetDb, "PhysicalObject1");
    const physicalObjectId2: Id64String = queryByUserLabel(targetDb, "PhysicalObject2");
    const physicalObjectId3: Id64String = queryByUserLabel(targetDb, "PhysicalObject3");
    const physicalObjectId4: Id64String = queryByUserLabel(targetDb, "PhysicalObject4");
    const physicalElementId1: Id64String = queryByUserLabel(targetDb, "PhysicalElement1");
    const childObjectId1A: Id64String = queryByUserLabel(targetDb, "ChildObject1A");
    const childObjectId1B: Id64String = queryByUserLabel(targetDb, "ChildObject1B");
    assertTargetElement(sourceDb, targetDb, physicalObjectId1);
    assertTargetElement(sourceDb, targetDb, physicalObjectId2);
    assertTargetElement(sourceDb, targetDb, physicalObjectId3);
    assertTargetElement(sourceDb, targetDb, physicalObjectId4);
    assertTargetElement(sourceDb, targetDb, physicalElementId1);
    assertTargetElement(sourceDb, targetDb, childObjectId1A);
    assertTargetElement(sourceDb, targetDb, childObjectId1B);
    const physicalObject1: PhysicalObject = targetDb.elements.getElement<PhysicalObject>({ id: physicalObjectId1, wantGeometry: true });
    const physicalObject2: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(physicalObjectId2);
    const physicalObject3: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(physicalObjectId3);
    const physicalObject4: PhysicalObject = targetDb.elements.getElement<PhysicalObject>({ id: physicalObjectId4, wantGeometry: true });
    const physicalElement1: PhysicalElement = targetDb.elements.getElement<PhysicalElement>(physicalElementId1);
    const childObject1A: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(childObjectId1A);
    const childObject1B: PhysicalObject = targetDb.elements.getElement<PhysicalObject>(childObjectId1B);
    assert.equal(physicalObject1.category, spatialCategoryId, "SpatialCategory should have been imported");
    assert.isDefined(physicalObject1.geom);
    let index1 = 0;
    for (const entry of new GeometryStreamIterator(physicalObject1.geom!)) {
      if (0 === index1) {
        assert.equal(entry.primitive.type, "geometryQuery");
        assert.equal(entry.geomParams.subCategoryId, subCategoryId);
        assert.equal(entry.geomParams.materialId, renderMaterialId);
      } else if (1 === index1) {
        assert.equal(entry.primitive.type, "partReference");
        assert.equal(entry.geomParams.subCategoryId, subCategoryId);
        assert.equal(entry.geomParams.materialId, renderMaterialId);
        if (entry.primitive.type === "partReference")
          assert.equal(entry.primitive.part.id, geometryPartId);
      } else {
        assert.fail(undefined, undefined, "Only expected 2 entries");
      }
      index1++;
    }
    assert.equal(physicalObject2.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    assert.equal(physicalObject3.federationGuid, federationGuid3, "Source FederationGuid should have been transferred to target element");
    assert.equal(physicalObject4.category, spatialCategoryId);
    let index4 = 0;
    for (const entry of new GeometryStreamIterator(physicalObject4.geom!)) {
      assert.equal(entry.primitive.type, "geometryQuery");
      if (0 === index4) {
        assert.notEqual(entry.geomParams.subCategoryId, subCategoryId, "Expect the default SubCategory");
      } else if (1 === index4) {
        assert.equal(entry.geomParams.subCategoryId, subCategoryId);
      }
      index4++;
    }
    assert.equal(index4, 2, "Expect 2 remaining boxes since 1 was filtered out");
    assert.equal(physicalElement1.category, targetPhysicalCategoryId, "SourcePhysicalCategory should have been remapped to TargetPhysicalCategory");
    assert.equal(physicalElement1.classFullName, "TestTransformerTarget:TargetPhysicalElement", "Class should have been remapped");
    assert.equal(physicalElement1.asAny.targetString, "S1", "Property should have been remapped by onTransformElement override");
    assert.equal(physicalElement1.asAny.targetDouble, 1.1, "Property should have been remapped by onTransformElement override");
    assert.equal(physicalElement1.asAny.targetNavigation.id, targetPhysicalCategoryId, "Property should have been remapped by onTransformElement override");
    assert.equal(physicalElement1.asAny.commonNavigation.id, targetPhysicalCategoryId, "Property should have been automatically remapped (same name)");
    assert.equal(physicalElement1.asAny.commonString, "Common", "Property should have been automatically remapped (same name)");
    assert.equal(physicalElement1.asAny.commonDouble, 7.3, "Property should have been automatically remapped (same name)");
    assert.equal(Base64EncodedString.fromUint8Array(physicalElement1.asAny.targetBinary), Base64EncodedString.fromUint8Array(new Uint8Array([1, 3, 5, 7])), "Property should have been remapped by onTransformElement override");
    assert.equal(Base64EncodedString.fromUint8Array(physicalElement1.asAny.commonBinary), Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])), "Property should have been automatically remapped (same name)");
    assert.notExists(physicalElement1.asAny.extraString, "Property should have been dropped during transformation");
    assert.equal(childObject1A.parent!.id, physicalObjectId1);
    assert.equal(childObject1B.parent!.id, physicalObjectId1);
    // ElementUniqueAspects
    const targetUniqueAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetUniqueAspect");
    assert.equal(targetUniqueAspects.length, 1);
    assert.equal(targetUniqueAspects[0].asAny.commonDouble, 1.1);
    assert.equal(targetUniqueAspects[0].asAny.commonString, "Unique");
    assert.equal(targetUniqueAspects[0].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
    assert.equal(Base64EncodedString.fromUint8Array(targetUniqueAspects[0].asAny.commonBinary), Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])));
    assert.equal(targetUniqueAspects[0].asAny.targetDouble, 11.1);
    assert.equal(targetUniqueAspects[0].asAny.targetString, "UniqueAspect");
    assert.equal(targetUniqueAspects[0].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
    assert.isTrue(Guid.isV4Guid(targetUniqueAspects[0].asAny.targetGuid));
    assert.equal(uniqueAspectGuid, targetUniqueAspects[0].asAny.targetGuid);
    // ElementMultiAspects
    const targetMultiAspects: ElementAspect[] = targetDb.elements.getAspects(physicalObjectId1, "TestTransformerTarget:TargetMultiAspect");
    assert.equal(targetMultiAspects.length, 2);
    assert.equal(targetMultiAspects[0].asAny.commonDouble, 2.2);
    assert.equal(targetMultiAspects[0].asAny.commonString, "Multi");
    assert.equal(targetMultiAspects[0].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
    assert.equal(targetMultiAspects[0].asAny.targetDouble, 22.2);
    assert.equal(targetMultiAspects[0].asAny.targetString, "MultiAspect");
    assert.equal(targetMultiAspects[0].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
    assert.isTrue(Guid.isV4Guid(targetMultiAspects[0].asAny.targetGuid));
    assert.equal(targetMultiAspects[1].asAny.commonDouble, 3.3);
    assert.equal(targetMultiAspects[1].asAny.commonString, "Multi");
    assert.equal(targetMultiAspects[1].asAny.commonLong, physicalObjectId1, "Id should have been remapped");
    assert.equal(targetMultiAspects[1].asAny.targetDouble, 33.3);
    assert.equal(targetMultiAspects[1].asAny.targetString, "MultiAspect");
    assert.equal(targetMultiAspects[1].asAny.targetLong, physicalObjectId1, "Id should have been remapped");
    assert.isTrue(Guid.isV4Guid(targetMultiAspects[1].asAny.targetGuid));
    // InformationRecords
    const informationRecordCodeSpec: CodeSpec = targetDb.codeSpecs.getByName("InformationRecords");
    assert.isTrue(Id64.isValidId64(informationRecordCodeSpec.id));
    const informationRecordId1 = targetDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord1" }));
    const informationRecordId2 = targetDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord2" }));
    const informationRecordId3 = targetDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord3" }));
    assert.isTrue(Id64.isValidId64(informationRecordId1!));
    assert.isTrue(Id64.isValidId64(informationRecordId2!));
    assert.isTrue(Id64.isValidId64(informationRecordId3!));
    const informationRecord2: any = targetDb.elements.getElement(informationRecordId2!);
    assert.equal(informationRecord2.commonString, "Common2");
    assert.equal(informationRecord2.targetString, "Two");
    // DisplayStyle
    const displayStyle3dId = targetDb.elements.queryElementIdByCode(DisplayStyle3d.createCode(targetDb, definitionModelId, "DisplayStyle3d"))!;
    assertTargetElement(sourceDb, targetDb, displayStyle3dId);
    const displayStyle3d = targetDb.elements.getElement<DisplayStyle3d>(displayStyle3dId);
    assert.isTrue(displayStyle3d.settings.hasSubCategoryOverride);
    assert.equal(displayStyle3d.settings.subCategoryOverrides.size, 1);
    assert.exists(displayStyle3d.settings.getSubCategoryOverride(subCategoryId), "Expect subCategoryOverrides to have been remapped");
    assert.isTrue(displayStyle3d.settings.excludedElements.has(physicalObjectId1), "Expect excludedElements to be remapped"); // eslint-disable-line deprecation/deprecation
    assert.equal(displayStyle3d.settings.environment.sky?.image?.type, SkyBoxImageType.Spherical);
    assert.equal(displayStyle3d.settings.environment.sky?.image?.texture, textureId);
    assert.equal(displayStyle3d.settings.getPlanProjectionSettings(spatialLocationModelId)?.elevation, 10.0);
    // ViewDefinition
    const viewId = targetDb.elements.queryElementIdByCode(OrthographicViewDefinition.createCode(targetDb, definitionModelId, "Orthographic View"))!;
    assertTargetElement(sourceDb, targetDb, viewId);
    const viewProps = targetDb.elements.getElementProps<SpatialViewDefinitionProps>(viewId);
    assert.equal(viewProps.displayStyleId, displayStyle3dId);
    assert.equal(viewProps.categorySelectorId, spatialCategorySelectorId);
    assert.equal(viewProps.modelSelectorId, modelSelectorId);
    // AuxCoordSystem2d
    assert.equal(undefined, targetDb.elements.queryElementIdByCode(AuxCoordSystem2d.createCode(targetDb, definitionModelId, "AuxCoordSystem2d")), "Should have been excluded by class");
    // DrawingGraphic
    const drawingGraphicId1: Id64String = queryByUserLabel(targetDb, "DrawingGraphic1");
    const drawingGraphicId2: Id64String = queryByUserLabel(targetDb, "DrawingGraphic2");
    assertTargetElement(sourceDb, targetDb, drawingGraphicId1);
    assertTargetElement(sourceDb, targetDb, drawingGraphicId2);
    // DrawingGraphicRepresentsElement
    assertTargetRelationship(sourceDb, targetDb, DrawingGraphicRepresentsElement.classFullName, drawingGraphicId1, physicalObjectId1);
    assertTargetRelationship(sourceDb, targetDb, DrawingGraphicRepresentsElement.classFullName, drawingGraphicId2, physicalObjectId1);
    // TargetRelWithProps
    const relWithProps: any = targetDb.relationships.getInstanceProps(
      "TestTransformerTarget:TargetRelWithProps",
      { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
    );
    assert.equal(relWithProps.targetString, "One");
    assert.equal(relWithProps.targetDouble, 1.1);
    assert.equal(relWithProps.targetLong, spatialCategoryId);
    assert.isTrue(Guid.isV4Guid(relWithProps.targetGuid));
  }

  export function assertUpdatesInDb(iModelDb: IModelDb, assertDeletes: boolean = true): void {
    // determine which schema was imported
    const testSourceSchema = iModelDb.querySchemaVersion("TestTransformerSource") ? true : false;
    const testTargetSchema = iModelDb.querySchemaVersion("TestTransformerTarget") ? true : false;
    assert.notEqual(testSourceSchema, testTargetSchema);
    // assert Subject was updated
    const subjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subject: Subject = iModelDb.elements.getElement<Subject>(subjectId);
    assert.equal(subject.description, "Subject description (Updated)");
    // assert SpatialCategory was updated
    const definitionModelId = iModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(iModelDb, subjectId, "Definition"))!;
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const spatialCategoryId = iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(iModelDb, definitionModelId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const spatialCategory: SpatialCategory = iModelDb.elements.getElement<SpatialCategory>(spatialCategoryId);
    assert.exists(spatialCategory.federationGuid);
    // assert TargetRelWithProps was updated
    const spatialCategorySelectorId = iModelDb.elements.queryElementIdByCode(CategorySelector.createCode(iModelDb, definitionModelId, "SpatialCategories"))!;
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId = iModelDb.elements.queryElementIdByCode(CategorySelector.createCode(iModelDb, definitionModelId, "DrawingCategories"))!;
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const relClassFullName = testTargetSchema ? "TestTransformerTarget:TargetRelWithProps" : "TestTransformerSource:SourceRelWithProps";
    const relWithProps: any = iModelDb.relationships.getInstanceProps(
      relClassFullName,
      { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
    );
    assert.equal(testTargetSchema ? relWithProps.targetString : relWithProps.sourceString, "One-Updated");
    assert.equal(testTargetSchema ? relWithProps.targetDouble : relWithProps.sourceDouble, 1.2);
    // assert ElementAspect properties
    const physicalObjectId1: Id64String = queryByUserLabel(iModelDb, "PhysicalObject1");
    const uniqueAspectClassFullName = testTargetSchema ? "TestTransformerTarget:TargetUniqueAspect" : "TestTransformerSource:SourceUniqueAspect";
    const uniqueAspects: ElementAspect[] = iModelDb.elements.getAspects(physicalObjectId1, uniqueAspectClassFullName);
    assert.equal(uniqueAspects.length, 1);
    const uniqueAspect = uniqueAspects[0].asAny;
    assert.equal(uniqueAspect.commonDouble, 1.1);
    assert.equal(uniqueAspect.commonString, "Unique-Updated");
    assert.equal(uniqueAspect.commonLong, physicalObjectId1);
    assert.equal(testTargetSchema ? uniqueAspect.targetDouble : uniqueAspect.sourceDouble, 11.1);
    assert.equal(testTargetSchema ? uniqueAspect.targetString : uniqueAspect.sourceString, "UniqueAspect-Updated");
    assert.equal(testTargetSchema ? uniqueAspect.targetLong : uniqueAspect.sourceLong, physicalObjectId1);
    const multiAspectClassFullName = testTargetSchema ? "TestTransformerTarget:TargetMultiAspect" : "TestTransformerSource:SourceMultiAspect";
    const multiAspects: ElementAspect[] = iModelDb.elements.getAspects(physicalObjectId1, multiAspectClassFullName);
    assert.equal(multiAspects.length, 2);
    const multiAspect0 = multiAspects[0].asAny;
    const multiAspect1 = multiAspects[1].asAny;
    assert.equal(multiAspect0.commonDouble, 2.2);
    assert.equal(multiAspect0.commonString, "Multi");
    assert.equal(multiAspect0.commonLong, physicalObjectId1);
    assert.equal(testTargetSchema ? multiAspect0.targetDouble : multiAspect0.sourceDouble, 22.2);
    assert.equal(testTargetSchema ? multiAspect0.targetString : multiAspect0.sourceString, "MultiAspect");
    assert.equal(testTargetSchema ? multiAspect0.targetLong : multiAspect0.sourceLong, physicalObjectId1);
    assert.equal(multiAspect1.commonDouble, 3.3);
    assert.equal(multiAspect1.commonString, "Multi-Updated");
    assert.equal(multiAspect1.commonLong, physicalObjectId1);
    assert.equal(testTargetSchema ? multiAspect1.targetDouble : multiAspect1.sourceDouble, 33.3);
    assert.equal(testTargetSchema ? multiAspect1.targetString : multiAspect1.sourceString, "MultiAspect-Updated");
    assert.equal(testTargetSchema ? multiAspect1.targetLong : multiAspect1.sourceLong, physicalObjectId1);
    // assert NavigationProperty of PhysicalElement1 was cleared
    const physicalElementId: Id64String = queryByUserLabel(iModelDb, "PhysicalElement1");
    const physicalElement: PhysicalElement = iModelDb.elements.getElement(physicalElementId);
    assert.isUndefined(physicalElement.asAny.commonNavigation);
    // assert PhysicalObject5 was inserted
    const physicalObjectId5: Id64String = queryByUserLabel(iModelDb, "PhysicalObject5");
    assert.isTrue(Id64.isValidId64(physicalObjectId5));
    // assert relationships were inserted
    const drawingGraphicId1: Id64String = queryByUserLabel(iModelDb, "DrawingGraphic1");
    const drawingGraphicId2: Id64String = queryByUserLabel(iModelDb, "DrawingGraphic2");
    iModelDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId1, targetId: physicalObjectId5 });
    iModelDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId5 });
    // assert InformationRecord2 was updated
    const informationRecordCodeSpec: CodeSpec = iModelDb.codeSpecs.getByName("InformationRecords");
    const informationModelId: Id64String = iModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(iModelDb, subjectId, "Information"))!;
    const informationRecordId2 = iModelDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord2" }));
    assert.isTrue(Id64.isValidId64(informationRecordId2!));
    const informationRecord2: any = iModelDb.elements.getElement(informationRecordId2!);
    assert.equal(informationRecord2.commonString, "Common2-Updated");
    assert.equal(testTargetSchema ? informationRecord2.targetString : informationRecord2.sourceString, "Two-Updated");
    // assert InformationRecord3 was deleted
    assert.isDefined(iModelDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord1" })));
    assert.isDefined(iModelDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord2" })));
    // detect deletes if possible - cannot detect during processAll when isReverseSynchronization is true
    if (assertDeletes) {
      assert.equal(Id64.invalid, queryByUserLabel(iModelDb, "PhysicalObject3"));
      assert.throws(() => iModelDb.relationships.getInstanceProps(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId1 }));
      assert.isUndefined(iModelDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord3" })));
    }
  }

  function assertTargetElement(sourceDb: IModelDb, targetDb: IModelDb, targetElementId: Id64String): void {
    assert.isTrue(Id64.isValidId64(targetElementId));
    const element: Element = targetDb.elements.getElement(targetElementId);
    assert.isTrue(element.federationGuid && Guid.isV4Guid(element.federationGuid));
    const aspects: ElementAspect[] = targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    const aspect: ExternalSourceAspect = aspects.filter((esa: any) => esa.kind === ExternalSourceAspect.Kind.Element)[0] as ExternalSourceAspect;
    assert.exists(aspect);
    assert.equal(aspect.kind, ExternalSourceAspect.Kind.Element);
    assert.equal(aspect.scope.id, IModel.rootSubjectId);
    assert.isUndefined(aspect.checksum);
    assert.isTrue(Id64.isValidId64(aspect.identifier));
    const sourceLastMod: string = sourceDb.elements.queryLastModifiedTime(aspect.identifier);
    assert.equal(aspect.version, sourceLastMod);
    const sourceElement: Element = sourceDb.elements.getElement(aspect.identifier);
    assert.exists(sourceElement);
  }

  function assertTargetRelationship(sourceDb: IModelDb, targetDb: IModelDb, targetRelClassFullName: string, targetRelSourceId: Id64String, targetRelTargetId: Id64String): void {
    const targetRelationship: Relationship = targetDb.relationships.getInstance(targetRelClassFullName, { sourceId: targetRelSourceId, targetId: targetRelTargetId });
    assert.exists(targetRelationship);
    const aspects: ElementAspect[] = targetDb.elements.getAspects(targetRelSourceId, ExternalSourceAspect.classFullName);
    const aspect: ExternalSourceAspect = aspects.filter((esa: any) => esa.kind === ExternalSourceAspect.Kind.Relationship)[0] as ExternalSourceAspect;
    assert.exists(aspect);
    const sourceRelationship: Relationship = sourceDb.relationships.getInstance(ElementRefersToElements.classFullName, aspect.identifier);
    assert.exists(sourceRelationship);
    assert.isDefined(aspect.jsonProperties);
    const json: any = JSON.parse(aspect.jsonProperties!);
    assert.equal(targetRelationship.id, json.targetRelInstanceId);
  }

  export function createTeamIModel(outputDir: string, teamName: string, teamOrigin: Point3d, teamColor: ColorDef): SnapshotDb {
    const teamFile: string = path.join(outputDir, `Team${teamName}.bim`);
    if (IModelJsFs.existsSync(teamFile)) {
      IModelJsFs.removeSync(teamFile);
    }
    const iModelDb: SnapshotDb = SnapshotDb.createEmpty(teamFile, { rootSubject: { name: teamName }, createClassViews: true });
    assert.exists(iModelDb);
    populateTeamIModel(iModelDb, teamName, teamOrigin, teamColor);
    iModelDb.saveChanges();
    return iModelDb;
  }

  export function populateTeamIModel(teamDb: IModelDb, teamName: string, teamOrigin: Point3d, teamColor: ColorDef): void {
    const contextSubjectId: Id64String = Subject.insert(teamDb, IModel.rootSubjectId, "Context");
    assert.isTrue(Id64.isValidId64(contextSubjectId));
    const definitionModelId = DefinitionModel.insert(teamDb, IModel.rootSubjectId, `Definition${teamName}`);
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const teamSpatialCategoryId = insertSpatialCategory(teamDb, definitionModelId, `SpatialCategory${teamName}`, teamColor);
    assert.isTrue(Id64.isValidId64(teamSpatialCategoryId));
    const sharedSpatialCategoryId = insertSpatialCategory(teamDb, IModel.dictionaryId, "SpatialCategoryShared", ColorDef.white);
    assert.isTrue(Id64.isValidId64(sharedSpatialCategoryId));
    const sharedDrawingCategoryId = DrawingCategory.insert(teamDb, IModel.dictionaryId, "DrawingCategoryShared", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(sharedDrawingCategoryId));
    const physicalModelId = PhysicalModel.insert(teamDb, IModel.rootSubjectId, `Physical${teamName}`);
    assert.isTrue(Id64.isValidId64(physicalModelId));
    // insert PhysicalObject-team1 using team SpatialCategory
    const physicalObjectProps1: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: teamSpatialCategoryId,
      code: Code.createEmpty(),
      userLabel: `PhysicalObject${teamName}1`,
      geom: createBox(Point3d.create(1, 1, 1)),
      placement: {
        origin: teamOrigin,
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1: Id64String = teamDb.elements.insertElement(physicalObjectProps1);
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    // insert PhysicalObject2 using "shared" SpatialCategory
    const physicalObjectProps2: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sharedSpatialCategoryId,
      code: Code.createEmpty(),
      userLabel: `PhysicalObject${teamName}2`,
      geom: createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: teamOrigin,
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId2: Id64String = teamDb.elements.insertElement(physicalObjectProps2);
    assert.isTrue(Id64.isValidId64(physicalObjectId2));
  }

  export function createSharedIModel(outputDir: string, teamNames: string[]): SnapshotDb {
    const iModelName: string = `Shared${teamNames.join("")}`;
    const iModelFile: string = path.join(outputDir, `${iModelName}.bim`);
    if (IModelJsFs.existsSync(iModelFile)) {
      IModelJsFs.removeSync(iModelFile);
    }
    const iModelDb: SnapshotDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: iModelName } });
    assert.exists(iModelDb);
    teamNames.forEach((teamName: string) => {
      const subjectId: Id64String = Subject.insert(iModelDb, IModel.rootSubjectId, teamName);
      assert.isTrue(Id64.isValidId64(subjectId));
    });
    return iModelDb;
  }

  export function assertTeamIModelContents(iModelDb: IModelDb, teamName: string): void {
    const definitionPartitionId: Id64String = queryDefinitionPartitionId(iModelDb, IModel.rootSubjectId, teamName);
    const teamSpatialCategoryId = querySpatialCategoryId(iModelDb, definitionPartitionId, teamName);
    const sharedSpatialCategoryId = querySpatialCategoryId(iModelDb, IModel.dictionaryId, "Shared");
    const physicalPartitionId: Id64String = queryPhysicalPartitionId(iModelDb, IModel.rootSubjectId, teamName);
    const physicalObjectId1: Id64String = queryPhysicalElementId(iModelDb, physicalPartitionId, teamSpatialCategoryId, `${teamName}1`);
    const physicalObject1: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(physicalObjectId1);
    assert.equal(physicalObject1.code.spec, iModelDb.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).id);
    assert.equal(physicalObject1.code.scope, IModel.rootSubjectId);
    assert.isTrue(physicalObject1.code.value === "");
    assert.equal(physicalObject1.category, teamSpatialCategoryId);
    const physicalObjectId2: Id64String = queryPhysicalElementId(iModelDb, physicalPartitionId, sharedSpatialCategoryId, `${teamName}2`);
    const physicalObject2: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(physicalObjectId2);
    assert.equal(physicalObject2.category, sharedSpatialCategoryId);
  }

  export function assertSharedIModelContents(iModelDb: IModelDb, teamNames: string[]): void {
    const sharedSpatialCategoryId = querySpatialCategoryId(iModelDb, IModel.dictionaryId, "Shared");
    assert.isTrue(Id64.isValidId64(sharedSpatialCategoryId));
    const aspects: ExternalSourceAspect[] = iModelDb.elements.getAspects(sharedSpatialCategoryId, ExternalSourceAspect.classFullName) as ExternalSourceAspect[];
    assert.isAtLeast(teamNames.length, aspects.length, "Should have an ExternalSourceAspect from each source");
    teamNames.forEach((teamName: string) => {
      const subjectId: Id64String = querySubjectId(iModelDb, teamName);
      const definitionPartitionId: Id64String = queryDefinitionPartitionId(iModelDb, subjectId, teamName);
      const teamSpatialCategoryId = querySpatialCategoryId(iModelDb, definitionPartitionId, teamName);
      const physicalPartitionId: Id64String = queryPhysicalPartitionId(iModelDb, subjectId, teamName);
      const physicalObjectId1: Id64String = queryPhysicalElementId(iModelDb, physicalPartitionId, teamSpatialCategoryId, `${teamName}1`);
      const physicalObject1: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(physicalObjectId1);
      assert.equal(physicalObject1.code.spec, iModelDb.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).id);
      assert.equal(physicalObject1.code.scope, IModel.rootSubjectId);
      assert.isTrue(physicalObject1.code.value === "");
      assert.equal(physicalObject1.category, teamSpatialCategoryId);
      assert.equal(1, iModelDb.elements.getAspects(physicalObjectId1, ExternalSourceAspect.classFullName).length);
      assert.equal(1, iModelDb.elements.getAspects(teamSpatialCategoryId, ExternalSourceAspect.classFullName).length);
      const physicalObjectId2: Id64String = queryPhysicalElementId(iModelDb, physicalPartitionId, sharedSpatialCategoryId, `${teamName}2`);
      const physicalObject2: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(physicalObjectId2);
      assert.equal(physicalObject2.category, sharedSpatialCategoryId);
      assert.equal(1, iModelDb.elements.getAspects(physicalObjectId2, ExternalSourceAspect.classFullName).length);
    });
  }

  export function querySubjectId(iModelDb: IModelDb, subjectCodeValue: string): Id64String {
    const subjectId: Id64String = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, subjectCodeValue))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    return subjectId;
  }

  export function queryDefinitionPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, suffix: string): Id64String {
    const partitionCode: Code = DefinitionPartition.createCode(iModelDb, parentSubjectId, `Definition${suffix}`);
    const partitionId: Id64String = iModelDb.elements.queryElementIdByCode(partitionCode)!;
    assert.isTrue(Id64.isValidId64(partitionId));
    return partitionId;
  }

  function querySpatialCategoryId(iModelDb: IModelDb, modelId: Id64String, suffix: string): Id64String {
    const categoryCode: Code = SpatialCategory.createCode(iModelDb, modelId, `SpatialCategory${suffix}`);
    const categoryId: Id64String = iModelDb.elements.queryElementIdByCode(categoryCode)!;
    assert.isTrue(Id64.isValidId64(categoryId));
    return categoryId;
  }

  export function queryPhysicalPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, suffix: string): Id64String {
    const partitionCode: Code = PhysicalPartition.createCode(iModelDb, parentSubjectId, `Physical${suffix}`);
    const partitionId: Id64String = iModelDb.elements.queryElementIdByCode(partitionCode)!;
    assert.isTrue(Id64.isValidId64(partitionId));
    return partitionId;
  }

  function queryPhysicalElementId(iModelDb: IModelDb, modelId: Id64String, categoryId: Id64String, suffix: string): Id64String {
    const elementId: Id64String = queryByUserLabel(iModelDb, `PhysicalObject${suffix}`);
    assert.isTrue(Id64.isValidId64(elementId));
    const element: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(elementId);
    assert.equal(element.model, modelId);
    assert.equal(element.category, categoryId);
    return elementId;
  }

  export function createConsolidatedIModel(outputDir: string, consolidatedName: string): SnapshotDb {
    const consolidatedFile: string = path.join(outputDir, `${consolidatedName}.bim`);
    if (IModelJsFs.existsSync(consolidatedFile)) {
      IModelJsFs.removeSync(consolidatedFile);
    }
    const consolidatedDb: SnapshotDb = SnapshotDb.createEmpty(consolidatedFile, { rootSubject: { name: `${consolidatedName}` } });
    assert.exists(consolidatedDb);
    const definitionModelId = DefinitionModel.insert(consolidatedDb, IModel.rootSubjectId, `Definition${consolidatedName}`);
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const physicalModelId = PhysicalModel.insert(consolidatedDb, IModel.rootSubjectId, `Physical${consolidatedName}`);
    assert.isTrue(Id64.isValidId64(physicalModelId));
    consolidatedDb.saveChanges();
    return consolidatedDb;
  }

  export function assertConsolidatedIModelContents(iModelDb: IModelDb, consolidatedName: string): void {
    // assert what should exist
    const definitionModelId: Id64String = queryDefinitionPartitionId(iModelDb, IModel.rootSubjectId, consolidatedName);
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const categoryA: Id64String = querySpatialCategoryId(iModelDb, definitionModelId, "A");
    const categoryB: Id64String = querySpatialCategoryId(iModelDb, definitionModelId, "B");
    assert.isTrue(Id64.isValidId64(categoryA));
    assert.isTrue(Id64.isValidId64(categoryB));
    const physicalModelId: Id64String = queryPhysicalPartitionId(iModelDb, IModel.rootSubjectId, consolidatedName);
    assert.isTrue(Id64.isValidId64(physicalModelId));
    queryPhysicalElementId(iModelDb, physicalModelId, categoryA, "A1");
    queryPhysicalElementId(iModelDb, physicalModelId, categoryB, "B1");
    // assert what should not exist
    assert.throws(() => querySubjectId(iModelDb, "A"), Error);
    assert.throws(() => querySubjectId(iModelDb, "B"), Error);
  }

  function insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
    const appearance: SubCategoryAppearance.Props = {
      color: color.toJSON(),
      transp: 0,
      invisible: false,
    };
    return SpatialCategory.insert(iModelDb, modelId, categoryName, appearance);
  }

  export function createBoxes(subCategoryIds: Id64String[]): GeometryStreamProps {
    const length = 1.0;
    const entryOrigin = Point3d.createZero();
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(Box.createDgnBox(
      entryOrigin, Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, length),
      length, length, length, length, true,
    )!);
    for (const subCategoryId of subCategoryIds) {
      entryOrigin.addInPlace({ x: 1, y: 1, z: 1 });
      geometryStreamBuilder.appendSubCategoryChange(subCategoryId);
      geometryStreamBuilder.appendGeometry(Box.createDgnBox(
        entryOrigin, Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, length),
        length, length, length, length, true,
      )!);
    }
    return geometryStreamBuilder.geometryStream;
  }

  export function createBox(size: Point3d, categoryId?: Id64String, subCategoryId?: Id64String, renderMaterialId?: Id64String, geometryPartId?: Id64String): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    if ((undefined !== categoryId) && (undefined !== subCategoryId)) {
      geometryStreamBuilder.appendSubCategoryChange(subCategoryId);
      if (undefined !== renderMaterialId) {
        const geometryParams = new GeometryParams(categoryId, subCategoryId);
        geometryParams.materialId = renderMaterialId;
        geometryStreamBuilder.appendGeometryParamsChange(geometryParams);
      }
    }
    geometryStreamBuilder.appendGeometry(Box.createDgnBox(
      Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
      size.x, size.y, size.x, size.y, true,
    )!);
    if (undefined !== geometryPartId) {
      geometryStreamBuilder.appendGeometryPart3d(geometryPartId);
    }
    return geometryStreamBuilder.geometryStream;
  }

  export function createCylinder(radius: number): GeometryStreamProps {
    const pointA = Point3d.create(0, 0, 0);
    const pointB = Point3d.create(0, 0, 2 * radius);
    const cylinder = Cone.createBaseAndTarget(pointA, pointB, Vector3d.unitX(), Vector3d.unitY(), radius, radius, true);
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(cylinder);
    return geometryStreamBuilder.geometryStream;
  }

  export function createRectangle(size: Point2d): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(LineString3d.createPoints([
      new Point3d(0, 0),
      new Point3d(size.x, 0),
      new Point3d(size.x, size.y),
      new Point3d(0, size.y),
      new Point3d(0, 0),
    ]));
    return geometryStreamBuilder.geometryStream;
  }

  export function insertTextureElement(iModelDb: IModelDb, modelId: Id64String, textureName: string): Id64String {
    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in bottom right pixel. The rest of the square is red.
    const pngData = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
    const textureData = Base64.btoa(String.fromCharCode(...pngData));
    return Texture.insertTexture(iModelDb, modelId, textureName, ImageSourceFormat.Png, textureData, `Description for ${textureName}`);
  }

  export function queryByUserLabel(iModelDb: IModelDb, userLabel: string): Id64String {
    return iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE UserLabel=:userLabel`, (statement: ECSqlStatement): Id64String => {
      statement.bindString("userLabel", userLabel);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }

  export function insertRepositoryLink(iModelDb: IModelDb, codeValue: string, url: string, format: string): Id64String {
    const repositoryLinkProps: RepositoryLinkProps = {
      classFullName: RepositoryLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(iModelDb, IModel.repositoryModelId, codeValue),
      url,
      format,
    };
    return iModelDb.elements.insertElement(repositoryLinkProps);
  }

  export function insertExternalSource(iModelDb: IModelDb, repositoryId: Id64String, userLabel: string): Id64String {
    const externalSourceProps: ExternalSourceProps = {
      classFullName: ExternalSource.classFullName,
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
      userLabel,
      repository: new ExternalSourceIsInRepository(repositoryId),
      connectorName: "Connector",
      connectorVersion: "0.0.1",
    };
    return iModelDb.elements.insertElement(externalSourceProps);
  }

  export function dumpIModelInfo(iModelDb: IModelDb): void {
    const outputFileName: string = `${iModelDb.pathName}.info.txt`;
    if (IModelJsFs.existsSync(outputFileName)) {
      IModelJsFs.removeSync(outputFileName);
    }
    IModelJsFs.appendFileSync(outputFileName, `${iModelDb.pathName}\n`);
    IModelJsFs.appendFileSync(outputFileName, "\n=== CodeSpecs ===\n");
    iModelDb.withPreparedStatement(`SELECT ECInstanceId,Name FROM BisCore:CodeSpec ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const codeSpecId: Id64String = statement.getValue(0).getId();
        const codeSpecName: string = statement.getValue(1).getString();
        IModelJsFs.appendFileSync(outputFileName, `${codeSpecId}, ${codeSpecName}\n`);
      }
    });
    IModelJsFs.appendFileSync(outputFileName, "\n=== Schemas ===\n");
    iModelDb.withPreparedStatement(`SELECT Name FROM ECDbMeta.ECSchemaDef ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const schemaName: string = statement.getValue(0).getString();
        IModelJsFs.appendFileSync(outputFileName, `${schemaName}\n`);
      }
    });
    IModelJsFs.appendFileSync(outputFileName, "\n=== Models ===\n");
    iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${Model.classFullName} ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modelId: Id64String = statement.getValue(0).getId();
        const model: Model = iModelDb.models.getModel(modelId);
        IModelJsFs.appendFileSync(outputFileName, `${modelId}, ${model.name}, ${model.parentModel}, ${model.classFullName}\n`);
      }
    });
    IModelJsFs.appendFileSync(outputFileName, "\n=== ViewDefinitions ===\n");
    iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${ViewDefinition.classFullName} ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const viewDefinitionId: Id64String = statement.getValue(0).getId();
        const viewDefinition: ViewDefinition = iModelDb.elements.getElement<ViewDefinition>(viewDefinitionId);
        IModelJsFs.appendFileSync(outputFileName, `${viewDefinitionId}, ${viewDefinition.code.value}, ${viewDefinition.classFullName}\n`);
      }
    });
    IModelJsFs.appendFileSync(outputFileName, "\n=== Elements ===\n");
    iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${Element.classFullName}`, (statement: ECSqlStatement): void => {
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const count: number = statement.getValue(0).getInteger();
        IModelJsFs.appendFileSync(outputFileName, `Count of ${Element.classFullName}=${count}\n`);
      }
    });
    iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${PhysicalObject.classFullName}`, (statement: ECSqlStatement): void => {
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const count: number = statement.getValue(0).getInteger();
        IModelJsFs.appendFileSync(outputFileName, `Count of ${PhysicalObject.classFullName}=${count}\n`);
      }
    });
    iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${GeometryPart.classFullName}`, (statement: ECSqlStatement): void => {
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const count: number = statement.getValue(0).getInteger();
        IModelJsFs.appendFileSync(outputFileName, `Count of ${GeometryPart.classFullName}=${count}\n`);
      }
    });
  }
}

before(async () => {
  IModelTestUtils.setupLogging();
  await IModelTestUtils.startBackend();
});

after(async () => {
  await IModelTestUtils.shutdownBackend();
});

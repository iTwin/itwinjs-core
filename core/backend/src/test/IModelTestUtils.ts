/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { Base64 } from "js-base64";
import * as path from "path";
import { AccessToken, BeEvent, DbResult, Guid, GuidString, Id64, Id64String, IModelStatus, OpenMode } from "@itwin/core-bentley";
import {
  AuxCoordSystem2dProps, Base64EncodedString, ChangesetIdWithIndex, Code, CodeProps, CodeScopeSpec, CodeSpec, ColorDef, ElementAspectProps,
  ElementProps, ExternalSourceProps, FontType, GeometricElement2dProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamProps,
  ImageSourceFormat, IModel, IModelError, IModelReadRpcInterface, IModelVersion, IModelVersionProps, LocalFileName, PhysicalElementProps,
  PlanProjectionSettings, RelatedElement, RepositoryLinkProps, RequestNewBriefcaseProps, RpcConfiguration, RpcManager, RpcPendingResponse,
  SkyBoxImageType, SubCategoryAppearance, SubCategoryOverride, SyncMode,
} from "@itwin/core-common";
import { Box, Cone, LineString3d, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { RequestNewBriefcaseArg } from "../BriefcaseManager";
import { CheckpointProps, V1CheckpointManager } from "../CheckpointManager";
import { ClassRegistry } from "../ClassRegistry";
import {
  AuxCoordSystem2d, BriefcaseDb, BriefcaseManager, CategorySelector, DisplayStyle2d, DisplayStyle3d, DrawingCategory, DrawingViewDefinition,
  ECSqlStatement, Element, ElementAspect, ElementOwnsChildElements, ElementOwnsMultiAspects, ElementOwnsUniqueAspect, ElementUniqueAspect,
  ExternalSource, ExternalSourceIsInRepository, FunctionalModel, FunctionalSchema, GroupModel, IModelDb, IModelHost, IModelJsFs,
  InformationPartitionElement, Model, ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalObject, PhysicalPartition, Platform,
  RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, SubjectOwnsPartitionElements, Texture, ViewDefinition,
} from "../core-backend";
import { DefinitionPartition, Drawing, DrawingGraphic, GeometryPart, LinkElement, PhysicalElement, RepositoryLink, Subject } from "../Element";
import { DefinitionModel, DocumentListModel, DrawingModel, InformationRecordModel, SpatialLocationModel } from "../Model";
import { DrawingGraphicRepresentsElement, ElementDrivesElement, Relationship, RelationshipProps } from "../Relationship";
import { DownloadAndOpenArgs, RpcBriefcaseUtility } from "../rpc-impl/RpcBriefcaseUtility";
import { Schema, Schemas } from "../Schema";
import { HubMock } from "./HubMock";
import { KnownTestLocations } from "./KnownTestLocations";

const assert = chai.assert;
chai.use(chaiAsPromised);

/* eslint-disable @typescript-eslint/explicit-member-accessibility */

RpcConfiguration.developmentMode = true;

// Initialize the RPC interface classes used by tests
RpcManager.initializeInterface(IModelReadRpcInterface);

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
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

/** A wrapper around the BackendHubAccess API through IModelHost.hubAccess.
 *
 * All methods in this class should be usable with any BackendHubAccess implementation (i.e. HubMock and IModelHubBackend).
 */
export class HubWrappers {

  public static async getAccessToken(user: TestUserType) {
    return TestUserType[user];
  }

  /** Create an iModel with the name provided if it does not already exist. If it does exist, the iModelId is returned. */
  public static async createIModel(accessToken: AccessToken, iTwinId: GuidString, iModelName: string): Promise<GuidString> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that modify iModels");
    let iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
    if (!iModelId)
      iModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName, description: `Description for iModel` });
    return iModelId;
  }

  /** Deletes and re-creates an iModel with the provided name in the iTwin.
   * @returns the iModelId of the newly created iModel.
  */
  public static async recreateIModel(arg: { accessToken: AccessToken, iTwinId: GuidString, iModelName: string, noLocks?: true }): Promise<GuidString> {
    assert.isTrue(HubMock.isValid, "Must use HubMock for tests that modify iModels");
    const deleteIModel = await IModelHost.hubAccess.queryIModelByName(arg);
    if (undefined !== deleteIModel)
      await IModelHost.hubAccess.deleteIModel({ accessToken: arg.accessToken, iTwinId: arg.iTwinId, iModelId: deleteIModel });

    // Create a new iModel
    return IModelHost.hubAccess.createNewIModel({ ...arg, description: `Description for ${arg.iModelName}` });
  }

  /** Delete an IModel from the hub */
  public static async deleteIModel(accessToken: AccessToken, iTwinId: string, iModelName: string): Promise<void> {
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
    if (undefined === iModelId)
      return;

    await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
  }

  /** Push an iModel to the Hub */
  public static async pushIModel(accessToken: AccessToken, iTwinId: string, pathname: string, iModelName?: string, overwrite?: boolean): Promise<GuidString> {
    // Delete any existing iModels with the same name as the required iModel
    const locIModelName = iModelName || path.basename(pathname, ".bim");
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName: locIModelName });
    if (iModelId) {
      if (!overwrite)
        return iModelId;
      await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
    }

    // Upload a new iModel
    return IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId, iModelName: locIModelName, revision0: pathname });
  }

  /** Helper to open a briefcase db directly with the BriefcaseManager API */
  public static async downloadAndOpenBriefcase(args: RequestNewBriefcaseArg): Promise<BriefcaseDb> {
    const props = await BriefcaseManager.downloadBriefcase(args);
    return BriefcaseDb.open({ fileName: props.fileName });
  }

  /** Opens the specific iModel as a Briefcase through the same workflow the IModelReadRpc.getConnectionProps method will use. Replicates the way a frontend would open the iModel. */
  public static async openBriefcaseUsingRpc(args: RequestNewBriefcaseProps & { accessToken: AccessToken, deleteFirst?: boolean }): Promise<BriefcaseDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        iTwinId: args.iTwinId,
        iModelId: args.iModelId,
        changeset: (await IModelHost.hubAccess.getChangesetFromVersion({ accessToken: args.accessToken, version: IModelVersion.fromJSON(args.asOf), iModelId: args.iModelId })),
      },
      activity: { accessToken: args.accessToken, activityId: "", applicationId: "", applicationVersion: "", sessionId: "" },
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
  public static async downloadAndOpenCheckpoint(args: { accessToken: AccessToken, iTwinId: GuidString, iModelId: GuidString, asOf?: IModelVersionProps }): Promise<SnapshotDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const checkpoint: CheckpointProps = {
      iTwinId: args.iTwinId,
      iModelId: args.iModelId,
      accessToken: args.accessToken,
      changeset: (await IModelHost.hubAccess.getChangesetFromVersion({ accessToken: args.accessToken, version: IModelVersion.fromJSON(args.asOf), iModelId: args.iModelId })),
    };

    return V1CheckpointManager.getCheckpointDb({ checkpoint, localFile: V1CheckpointManager.getFileName(checkpoint) });
  }

  /** Opens the specific Checkpoint iModel, `SyncMode.FixedVersion`, through the same workflow the IModelReadRpc.getConnectionProps method will use. Replicates the way a frontend would open the iModel. */
  public static async openCheckpointUsingRpc(args: RequestNewBriefcaseProps & { accessToken: AccessToken, deleteFirst?: boolean }): Promise<IModelDb> {
    if (undefined === args.asOf)
      args.asOf = IModelVersion.latest().toJSON();

    const changeset = await IModelHost.hubAccess.getChangesetFromVersion({ accessToken: args.accessToken, version: IModelVersion.fromJSON(args.asOf), iModelId: args.iModelId });
    const openArgs: DownloadAndOpenArgs = {
      tokenProps: {
        iTwinId: args.iTwinId,
        iModelId: args.iModelId,
        changeset,
      },
      activity: { accessToken: args.accessToken, activityId: "", applicationId: "", applicationVersion: "", sessionId: "" },
      syncMode: SyncMode.FixedVersion,
      forceDownload: args.deleteFirst,
    };

    while (true) {
      try {
        return (await RpcBriefcaseUtility.open(openArgs));
      } catch (error) {
        if (!(error instanceof RpcPendingResponse))
          throw error;
      }
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcasesById(accessToken: AccessToken, iModelId: GuidString, onReachThreshold: () => void = () => { }, acquireThreshold: number = 16): Promise<void> {
    const briefcases = await IModelHost.hubAccess.getMyBriefcaseIds({ accessToken, iModelId });
    if (briefcases.length > acquireThreshold) {
      if (undefined !== onReachThreshold)
        onReachThreshold();

      const promises: Promise<void>[] = [];
      briefcases.forEach((briefcaseId) => {
        promises.push(IModelHost.hubAccess.releaseBriefcase({ accessToken, iModelId, briefcaseId }));
      });
      await Promise.all(promises);
    }
  }

  public static async closeAndDeleteBriefcaseDb(accessToken: AccessToken, briefcaseDb: IModelDb) {
    const fileName = briefcaseDb.pathName;
    const iModelId = briefcaseDb.iModelId;
    briefcaseDb.close();

    await BriefcaseManager.deleteBriefcaseFiles(fileName, accessToken);

    // try to clean up empty briefcase directories, and empty iModel directories.
    if (0 === BriefcaseManager.getCachedBriefcases(iModelId).length) {
      IModelJsFs.removeSync(BriefcaseManager.getBriefcaseBasePath(iModelId));
      const imodelPath = BriefcaseManager.getIModelPath(iModelId);
      if (0 === IModelJsFs.readdirSync(imodelPath).length) {
        IModelJsFs.removeSync(imodelPath);
      }
    }
  }
}

export class IModelTestUtils {

  /** Generate a name for an iModel that's unique using the baseName provided and appending a new GUID.  */
  public static generateUniqueName(baseName: string) {
    return `${baseName} - ${Guid.createValue()}`;
  }

  /** Prepare for an output file by:
   * - Resolving the output file name under the known test output directory
   * - Making directories as necessary
   * - Removing a previous copy of the output file
   * @param subDirName Sub-directory under known test output directory. Should match the name of the test file minus the .test.ts file extension.
   * @param fileName Name of output fille
   */
  public static prepareOutputFile(subDirName: string, fileName: string): LocalFileName {
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
  public static resolveAssetFile(assetName: string): LocalFileName {
    const assetFile = path.join(KnownTestLocations.assetsDir, assetName);
    assert.isTrue(IModelJsFs.existsSync(assetFile));
    return assetFile;
  }

  /** Orchestrates the steps necessary to create a new snapshot iModel from a seed file. */
  public static createSnapshotFromSeed(testFileName: string, seedFileName: LocalFileName): SnapshotDb {
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

  public static generateChangeSetId(): ChangesetIdWithIndex {
    let result = "";
    for (let i = 0; i < 20; ++i) {
      result += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    }
    return { id: result };
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
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

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  public static async createAndInsertPhysicalPartitionAsync(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Promise<Id64String> {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    await testDb.locks.acquireSharedLock(model);
    return testDb.elements.insertElement(modeledElement);
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  public static createAndInsertPhysicalModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  public static async createAndInsertPhysicalModelAsync(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Promise<Id64String> {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
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
  public static createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  /**
   * Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
   * @return [modeledElementId, modelId]
   */
  public static async createAndInsertPhysicalPartitionAndModelAsync(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parentId?: Id64String): Promise<Id64String[]> {
    const eid = await IModelTestUtils.createAndInsertPhysicalPartitionAsync(testImodel, newModelCode, parentId);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = await IModelTestUtils.createAndInsertPhysicalModelAsync(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  /** Create and insert a Drawing Partition element (in the repositoryModel). */
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

  /** Create and insert a DrawingModel associated with Drawing Partition. */
  public static createAndInsertDrawingModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
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

  public static registerTestBimSchema() {
    if (undefined === Schemas.getRegisteredSchema(TestBim.schemaName)) {
      Schemas.registerSchema(TestBim);
      ClassRegistry.register(TestPhysicalObject, TestBim);
      ClassRegistry.register(TestElementDrivesElement, TestBim);
    }
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
    iModelDb.nativeDb.deleteAllTxns();
    return true;
  }

  public static querySubjectId(iModelDb: IModelDb, subjectCodeValue: string): Id64String {
    const subjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, subjectCodeValue))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    return subjectId;
  }

  public static queryDefinitionPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, suffix: string): Id64String {
    const partitionCode: Code = DefinitionPartition.createCode(iModelDb, parentSubjectId, `Definition${suffix}`);
    const partitionId = iModelDb.elements.queryElementIdByCode(partitionCode)!;
    assert.isTrue(Id64.isValidId64(partitionId));
    return partitionId;
  }

  public static querySpatialCategoryId(iModelDb: IModelDb, modelId: Id64String, suffix: string): Id64String {
    const categoryCode: Code = SpatialCategory.createCode(iModelDb, modelId, `SpatialCategory${suffix}`);
    const categoryId = iModelDb.elements.queryElementIdByCode(categoryCode)!;
    assert.isTrue(Id64.isValidId64(categoryId));
    return categoryId;
  }

  public static queryPhysicalPartitionId(iModelDb: IModelDb, parentSubjectId: Id64String, suffix: string): Id64String {
    const partitionCode: Code = PhysicalPartition.createCode(iModelDb, parentSubjectId, `Physical${suffix}`);
    const partitionId = iModelDb.elements.queryElementIdByCode(partitionCode)!;
    assert.isTrue(Id64.isValidId64(partitionId));
    return partitionId;
  }

  public static queryPhysicalElementId(iModelDb: IModelDb, modelId: Id64String, categoryId: Id64String, suffix: string): Id64String {
    const elementId = IModelTestUtils.queryByUserLabel(iModelDb, `PhysicalObject${suffix}`);
    assert.isTrue(Id64.isValidId64(elementId));
    const element: PhysicalElement = iModelDb.elements.getElement<PhysicalElement>(elementId);
    assert.equal(element.model, modelId);
    assert.equal(element.category, categoryId);
    return elementId;
  }

  public static insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
    const appearance: SubCategoryAppearance.Props = {
      color: color.toJSON(),
      transp: 0,
      invisible: false,
    };
    return SpatialCategory.insert(iModelDb, modelId, categoryName, appearance);
  }

  public static createBoxes(subCategoryIds: Id64String[]): GeometryStreamProps {
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

  public static createBox(size: Point3d, categoryId?: Id64String, subCategoryId?: Id64String, renderMaterialId?: Id64String, geometryPartId?: Id64String): GeometryStreamProps {
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

  public static createCylinder(radius: number): GeometryStreamProps {
    const pointA = Point3d.create(0, 0, 0);
    const pointB = Point3d.create(0, 0, 2 * radius);
    const cylinder = Cone.createBaseAndTarget(pointA, pointB, Vector3d.unitX(), Vector3d.unitY(), radius, radius, true);
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(cylinder);
    return geometryStreamBuilder.geometryStream;
  }

  public static createRectangle(size: Point2d): GeometryStreamProps {
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

  public static insertTextureElement(iModelDb: IModelDb, modelId: Id64String, textureName: string): Id64String {
    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in bottom right pixel. The rest of the square is red.
    const pngData = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
    const textureData = Base64.btoa(String.fromCharCode(...pngData));
    return Texture.insertTexture(iModelDb, modelId, textureName, ImageSourceFormat.Png, textureData, `Description for ${textureName}`);
  }

  public static queryByUserLabel(iModelDb: IModelDb, userLabel: string): Id64String {
    return iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE UserLabel=:userLabel`, (statement: ECSqlStatement): Id64String => {
      statement.bindString("userLabel", userLabel);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : Id64.invalid;
    });
  }

  public static insertRepositoryLink(iModelDb: IModelDb, codeValue: string, url: string, format: string): Id64String {
    const repositoryLinkProps: RepositoryLinkProps = {
      classFullName: RepositoryLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(iModelDb, IModel.repositoryModelId, codeValue),
      url,
      format,
    };
    return iModelDb.elements.insertElement(repositoryLinkProps);
  }

  public static insertExternalSource(iModelDb: IModelDb, repositoryId: Id64String, userLabel: string): Id64String {
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

  public static dumpIModelInfo(iModelDb: IModelDb): void {
    const outputFileName: string = `${iModelDb.pathName}.info.txt`;
    if (IModelJsFs.existsSync(outputFileName)) {
      IModelJsFs.removeSync(outputFileName);
    }
    IModelJsFs.appendFileSync(outputFileName, `${iModelDb.pathName}\n`);
    IModelJsFs.appendFileSync(outputFileName, "\n=== CodeSpecs ===\n");
    iModelDb.withPreparedStatement(`SELECT ECInstanceId,Name FROM BisCore:CodeSpec ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const codeSpecId = statement.getValue(0).getId();
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
        const modelId = statement.getValue(0).getId();
        const model: Model = iModelDb.models.getModel(modelId);
        IModelJsFs.appendFileSync(outputFileName, `${modelId}, ${model.name}, ${model.parentModel}, ${model.classFullName}\n`);
      }
    });
    IModelJsFs.appendFileSync(outputFileName, "\n=== ViewDefinitions ===\n");
    iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${ViewDefinition.classFullName} ORDER BY ECInstanceId`, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const viewDefinitionId = statement.getValue(0).getId();
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

export class ExtensiveTestScenario {
  static uniqueAspectGuid = Guid.createValue();
  static federationGuid3 = Guid.createValue();

  public static async prepareDb(sourceDb: IModelDb): Promise<void> {
    // Import desired schemas
    const sourceSchemaFileName = path.join(KnownTestLocations.assetsDir, "ExtensiveTestScenario.ecschema.xml");
    await sourceDb.importSchemas([FunctionalSchema.schemaFilePath, sourceSchemaFileName]);
    FunctionalSchema.registerSchema();
  }

  public static populateDb(sourceDb: IModelDb): void {
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
    const codeSpecId1 = sourceDb.codeSpecs.insert("SourceCodeSpec", CodeScopeSpec.Type.Model);
    const codeSpecId2 = sourceDb.codeSpecs.insert("ExtraCodeSpec", CodeScopeSpec.Type.ParentElement);
    const codeSpecId3 = sourceDb.codeSpecs.insert("InformationRecords", CodeScopeSpec.Type.Model);
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
    const spatialCategoryId = IModelTestUtils.insertSpatialCategory(sourceDb, definitionModelId, "SpatialCategory", ColorDef.green);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const sourcePhysicalCategoryId = IModelTestUtils.insertSpatialCategory(sourceDb, definitionModelId, "SourcePhysicalCategory", ColorDef.blue);
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
    const textureId = IModelTestUtils.insertTextureElement(sourceDb, definitionModelId, "Texture");
    assert.isTrue(Id64.isValidId64(textureId));
    const renderMaterialId = RenderMaterialElement.insert(sourceDb, definitionModelId, "RenderMaterial", new RenderMaterialElement.Params("PaletteName"));
    assert.isTrue(Id64.isValidId64(renderMaterialId));
    const geometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(sourceDb, definitionModelId, "GeometryPart"),
      geom: IModelTestUtils.createBox(Point3d.create(3, 3, 3)),
    };
    const geometryPartId = sourceDb.elements.insertElement(geometryPartProps);
    assert.isTrue(Id64.isValidId64(geometryPartId));
    // Insert InformationRecords
    const informationRecordProps1 = {
      classFullName: "ExtensiveTestScenario:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord1" },
      commonString: "Common1",
      sourceString: "One",
    };
    const informationRecordId1 = sourceDb.elements.insertElement(informationRecordProps1);
    assert.isTrue(Id64.isValidId64(informationRecordId1));
    const informationRecordProps2: any = {
      classFullName: "ExtensiveTestScenario:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord2" },
      commonString: "Common2",
      sourceString: "Two",
    };
    const informationRecordId2 = sourceDb.elements.insertElement(informationRecordProps2);
    assert.isTrue(Id64.isValidId64(informationRecordId2));
    const informationRecordProps3 = {
      classFullName: "ExtensiveTestScenario:SourceInformationRecord",
      model: informationModelId,
      code: { spec: codeSpecId3, scope: informationModelId, value: "InformationRecord3" },
      commonString: "Common3",
      sourceString: "Three",
    };
    const informationRecordId3 = sourceDb.elements.insertElement(informationRecordProps3);
    assert.isTrue(Id64.isValidId64(informationRecordId3));
    // Insert PhysicalObject1
    const physicalObjectProps1: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject1",
      geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), spatialCategoryId, subCategoryId, renderMaterialId, geometryPartId),
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1 = sourceDb.elements.insertElement(physicalObjectProps1);
    assert.isTrue(Id64.isValidId64(physicalObjectId1));
    // Insert PhysicalObject1 children
    const childObjectProps1A: PhysicalElementProps = physicalObjectProps1;
    childObjectProps1A.userLabel = "ChildObject1A";
    childObjectProps1A.parent = new ElementOwnsChildElements(physicalObjectId1);
    childObjectProps1A.placement!.origin = Point3d.create(0, 1, 1);
    const childObjectId1A = sourceDb.elements.insertElement(childObjectProps1A);
    assert.isTrue(Id64.isValidId64(childObjectId1A));
    const childObjectProps1B: PhysicalElementProps = childObjectProps1A;
    childObjectProps1B.userLabel = "ChildObject1B";
    childObjectProps1B.placement!.origin = Point3d.create(1, 0, 1);
    const childObjectId1B = sourceDb.elements.insertElement(childObjectProps1B);
    assert.isTrue(Id64.isValidId64(childObjectId1B));
    // Insert PhysicalObject2
    const physicalObjectProps2: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject2",
      geom: IModelTestUtils.createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(2, 2, 2),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId2 = sourceDb.elements.insertElement(physicalObjectProps2);
    assert.isTrue(Id64.isValidId64(physicalObjectId2));
    // Insert PhysicalObject3
    const physicalObjectProps3: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      federationGuid: ExtensiveTestScenario.federationGuid3,
      userLabel: "PhysicalObject3",
    };
    const physicalObjectId3 = sourceDb.elements.insertElement(physicalObjectProps3);
    assert.isTrue(Id64.isValidId64(physicalObjectId3));
    // Insert PhysicalObject4
    const physicalObjectProps4: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject4",
      geom: IModelTestUtils.createBoxes([subCategoryId, filteredSubCategoryId]),
      placement: {
        origin: Point3d.create(4, 4, 4),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId4 = sourceDb.elements.insertElement(physicalObjectProps4);
    assert.isTrue(Id64.isValidId64(physicalObjectId4));
    // Insert PhysicalElement1
    const sourcePhysicalElementProps: PhysicalElementProps = {
      classFullName: "ExtensiveTestScenario:SourcePhysicalElement",
      model: physicalModelId,
      category: sourcePhysicalCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalElement1",
      geom: IModelTestUtils.createBox(Point3d.create(2, 2, 2)),
      placement: {
        origin: Point3d.create(4, 4, 4),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
      sourceString: "S1",
      sourceDouble: 1.1,
      sourceNavigation: { id: sourcePhysicalCategoryId, relClassName: "ExtensiveTestScenario:SourcePhysicalElementUsesSourceDefinition" },
      commonNavigation: { id: sourcePhysicalCategoryId },
      commonString: "Common",
      commonDouble: 7.3,
      sourceBinary: new Uint8Array([1, 3, 5, 7]),
      commonBinary: Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])),
      extraString: "Extra",
    } as PhysicalElementProps;
    const sourcePhysicalElementId = sourceDb.elements.insertElement(sourcePhysicalElementProps);
    assert.isTrue(Id64.isValidId64(sourcePhysicalElementId));
    assert.doesNotThrow(() => sourceDb.elements.getElement(sourcePhysicalElementId));
    // Insert ElementAspects
    sourceDb.elements.insertAspect({
      classFullName: "ExtensiveTestScenario:SourceUniqueAspect",
      element: new ElementOwnsUniqueAspect(physicalObjectId1),
      commonDouble: 1.1,
      commonString: "Unique",
      commonLong: physicalObjectId1,
      commonBinary: Base64EncodedString.fromUint8Array(new Uint8Array([2, 4, 6, 8])),
      sourceDouble: 11.1,
      sourceString: "UniqueAspect",
      sourceLong: physicalObjectId1,
      sourceGuid: ExtensiveTestScenario.uniqueAspectGuid,
      extraString: "Extra",
    } as ElementAspectProps);
    const sourceUniqueAspect: ElementUniqueAspect = sourceDb.elements.getAspects(physicalObjectId1, "ExtensiveTestScenario:SourceUniqueAspect")[0];
    assert.equal(sourceUniqueAspect.asAny.commonDouble, 1.1);
    assert.equal(sourceUniqueAspect.asAny.commonString, "Unique");
    assert.equal(sourceUniqueAspect.asAny.commonLong, physicalObjectId1);
    assert.equal(sourceUniqueAspect.asAny.sourceDouble, 11.1);
    assert.equal(sourceUniqueAspect.asAny.sourceString, "UniqueAspect");
    assert.equal(sourceUniqueAspect.asAny.sourceLong, physicalObjectId1);
    assert.equal(sourceUniqueAspect.asAny.sourceGuid, ExtensiveTestScenario.uniqueAspectGuid);
    assert.equal(sourceUniqueAspect.asAny.extraString, "Extra");
    sourceDb.elements.insertAspect({
      classFullName: "ExtensiveTestScenario:SourceMultiAspect",
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
      classFullName: "ExtensiveTestScenario:SourceMultiAspect",
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
      classFullName: "ExtensiveTestScenario:SourceUniqueAspectToExclude",
      element: new ElementOwnsUniqueAspect(physicalObjectId1),
      description: "SourceUniqueAspect1",
    } as ElementAspectProps);
    sourceDb.elements.insertAspect({
      classFullName: "ExtensiveTestScenario:SourceMultiAspectToExclude",
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
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = sourceDb.elements.insertElement(drawingGraphicProps1);
    assert.isTrue(Id64.isValidId64(drawingGraphicId1));
    const drawingGraphicRepresentsId1 = DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId1, physicalObjectId1);
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId1));
    const drawingGraphicProps2: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic2",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(3, 3), angle: 0 },
    };
    const drawingGraphicId2 = sourceDb.elements.insertElement(drawingGraphicProps2);
    assert.isTrue(Id64.isValidId64(drawingGraphicId2));
    const drawingGraphicRepresentsId2 = DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId2, physicalObjectId1);
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId2));
    // Insert DisplayStyles
    const displayStyle2dId = DisplayStyle2d.insert(sourceDb, definitionModelId, "DisplayStyle2d");
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
    const displayStyle3dId = displayStyle3d.insert();
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
      classFullName: "ExtensiveTestScenario:SourceRelToExclude",
      sourceId: spatialCategorySelectorId,
      targetId: drawingCategorySelectorId,
    });
    const relationshipId1 = sourceDb.relationships.insertInstance(relationship1);
    assert.isTrue(Id64.isValidId64(relationshipId1));
    // Insert instance of RelWithProps to test relationship property remapping
    const relationship2: Relationship = sourceDb.relationships.createInstance({
      classFullName: "ExtensiveTestScenario:SourceRelWithProps",
      sourceId: spatialCategorySelectorId,
      targetId: drawingCategorySelectorId,
      sourceString: "One",
      sourceDouble: 1.1,
      sourceLong: spatialCategoryId,
      sourceGuid: Guid.createValue(),
    } as any);
    const relationshipId2 = sourceDb.relationships.insertInstance(relationship2);
    assert.isTrue(Id64.isValidId64(relationshipId2));
  }

  public static updateDb(sourceDb: IModelDb): void {
    // Update Subject element
    const subjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(subjectId));
    const subject = sourceDb.elements.getElement<Subject>(subjectId);
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
      "ExtensiveTestScenario:SourceRelWithProps",
      { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
    );
    assert.equal(relWithProps.sourceString, "One");
    assert.equal(relWithProps.sourceDouble, 1.1);
    relWithProps.sourceString += "-Updated";
    relWithProps.sourceDouble = 1.2;
    sourceDb.relationships.updateInstance(relWithProps);
    // Update ElementAspect properties
    const physicalObjectId1 = IModelTestUtils.queryByUserLabel(sourceDb, "PhysicalObject1");
    const sourceUniqueAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "ExtensiveTestScenario:SourceUniqueAspect");
    assert.equal(sourceUniqueAspects.length, 1);
    sourceUniqueAspects[0].asAny.commonString += "-Updated";
    sourceUniqueAspects[0].asAny.sourceString += "-Updated";
    sourceDb.elements.updateAspect(sourceUniqueAspects[0]);
    const sourceMultiAspects: ElementAspect[] = sourceDb.elements.getAspects(physicalObjectId1, "ExtensiveTestScenario:SourceMultiAspect");
    assert.equal(sourceMultiAspects.length, 2);
    sourceMultiAspects[1].asAny.commonString += "-Updated";
    sourceMultiAspects[1].asAny.sourceString += "-Updated";
    sourceDb.elements.updateAspect(sourceMultiAspects[1]);
    // clear NavigationProperty of PhysicalElement1
    const physicalElementId1 = IModelTestUtils.queryByUserLabel(sourceDb, "PhysicalElement1");
    let physicalElement1: PhysicalElement = sourceDb.elements.getElement(physicalElementId1);
    physicalElement1.asAny.commonNavigation = RelatedElement.none;
    physicalElement1.update();
    physicalElement1 = sourceDb.elements.getElement(physicalElementId1);
    assert.isUndefined(physicalElement1.asAny.commonNavigation);
    // delete PhysicalObject3
    const physicalObjectId3 = IModelTestUtils.queryByUserLabel(sourceDb, "PhysicalObject3");
    assert.isTrue(Id64.isValidId64(physicalObjectId3));
    sourceDb.elements.deleteElement(physicalObjectId3);
    assert.equal(Id64.invalid, IModelTestUtils.queryByUserLabel(sourceDb, "PhysicalObject3"));
    // Insert PhysicalObject5
    const physicalObjectProps5: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalElement1.model,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject5",
      geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      placement: {
        origin: Point3d.create(5, 5, 5),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId5 = sourceDb.elements.insertElement(physicalObjectProps5);
    assert.isTrue(Id64.isValidId64(physicalObjectId5));
    // delete relationship
    const drawingGraphicId1 = IModelTestUtils.queryByUserLabel(sourceDb, "DrawingGraphic1");
    const drawingGraphicId2 = IModelTestUtils.queryByUserLabel(sourceDb, "DrawingGraphic2");
    const relationship: Relationship = sourceDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId1 });
    relationship.delete();
    // insert relationships
    DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId1, physicalObjectId5);
    DrawingGraphicRepresentsElement.insert(sourceDb, drawingGraphicId2, physicalObjectId5);
    // update InformationRecord2
    const informationRecordCodeSpec: CodeSpec = sourceDb.codeSpecs.getByName("InformationRecords");
    const informationModelId = sourceDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(sourceDb, subjectId, "Information"))!;
    const informationRecodeCode2: Code = new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord2" });
    const informationRecordId2 = sourceDb.elements.queryElementIdByCode(informationRecodeCode2)!;
    assert.isTrue(Id64.isValidId64(informationRecordId2));
    const informationRecord2: any = sourceDb.elements.getElement(informationRecordId2);
    informationRecord2.commonString = `${informationRecord2.commonString}-Updated`;
    informationRecord2.sourceString = `${informationRecord2.sourceString}-Updated`;
    informationRecord2.update();
    // delete InformationRecord3
    const informationRecodeCode3: Code = new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord3" });
    const informationRecordId3 = sourceDb.elements.queryElementIdByCode(informationRecodeCode3)!;
    assert.isTrue(Id64.isValidId64(informationRecordId3));
    sourceDb.elements.deleteElement(informationRecordId3);
  }

  public static assertUpdatesInDb(iModelDb: IModelDb, assertDeletes: boolean = true): void {
    // determine which schema was imported
    const testSourceSchema = iModelDb.querySchemaVersion("ExtensiveTestScenario") ? true : false;
    const testTargetSchema = iModelDb.querySchemaVersion("ExtensiveTestScenarioTarget") ? true : false;
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
    const relClassFullName = testTargetSchema ? "ExtensiveTestScenarioTarget:TargetRelWithProps" : "ExtensiveTestScenario:SourceRelWithProps";
    const relWithProps: any = iModelDb.relationships.getInstanceProps(
      relClassFullName,
      { sourceId: spatialCategorySelectorId, targetId: drawingCategorySelectorId },
    );
    assert.equal(testTargetSchema ? relWithProps.targetString : relWithProps.sourceString, "One-Updated");
    assert.equal(testTargetSchema ? relWithProps.targetDouble : relWithProps.sourceDouble, 1.2);
    // assert ElementAspect properties
    const physicalObjectId1 = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject1");
    const uniqueAspectClassFullName = testTargetSchema ? "ExtensiveTestScenarioTarget:TargetUniqueAspect" : "ExtensiveTestScenario:SourceUniqueAspect";
    const uniqueAspects: ElementAspect[] = iModelDb.elements.getAspects(physicalObjectId1, uniqueAspectClassFullName);
    assert.equal(uniqueAspects.length, 1);
    const uniqueAspect = uniqueAspects[0].asAny;
    assert.equal(uniqueAspect.commonDouble, 1.1);
    assert.equal(uniqueAspect.commonString, "Unique-Updated");
    assert.equal(uniqueAspect.commonLong, physicalObjectId1);
    assert.equal(testTargetSchema ? uniqueAspect.targetDouble : uniqueAspect.sourceDouble, 11.1);
    assert.equal(testTargetSchema ? uniqueAspect.targetString : uniqueAspect.sourceString, "UniqueAspect-Updated");
    assert.equal(testTargetSchema ? uniqueAspect.targetLong : uniqueAspect.sourceLong, physicalObjectId1);
    const multiAspectClassFullName = testTargetSchema ? "ExtensiveTestScenarioTarget:TargetMultiAspect" : "ExtensiveTestScenario:SourceMultiAspect";
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
    const physicalElementId = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalElement1");
    const physicalElement: PhysicalElement = iModelDb.elements.getElement(physicalElementId);
    assert.isUndefined(physicalElement.asAny.commonNavigation);
    // assert PhysicalObject5 was inserted
    const physicalObjectId5 = IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject5");
    assert.isTrue(Id64.isValidId64(physicalObjectId5));
    // assert relationships were inserted
    const drawingGraphicId1 = IModelTestUtils.queryByUserLabel(iModelDb, "DrawingGraphic1");
    const drawingGraphicId2 = IModelTestUtils.queryByUserLabel(iModelDb, "DrawingGraphic2");
    iModelDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId1, targetId: physicalObjectId5 });
    iModelDb.relationships.getInstance(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId5 });
    // assert InformationRecord2 was updated
    const informationRecordCodeSpec: CodeSpec = iModelDb.codeSpecs.getByName("InformationRecords");
    const informationModelId = iModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(iModelDb, subjectId, "Information"))!;
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
      assert.equal(Id64.invalid, IModelTestUtils.queryByUserLabel(iModelDb, "PhysicalObject3"));
      assert.throws(() => iModelDb.relationships.getInstanceProps(DrawingGraphicRepresentsElement.classFullName, { sourceId: drawingGraphicId2, targetId: physicalObjectId1 }));
      assert.isUndefined(iModelDb.elements.queryElementIdByCode(new Code({ spec: informationRecordCodeSpec.id, scope: informationModelId, value: "InformationRecord3" })));
    }
  }
}

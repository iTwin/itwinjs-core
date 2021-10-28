/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { join } from "path";
import * as semver from "semver";
import * as path from "path";
import { ClientRequestContext, DbOpcode, DbResult, Guid, GuidString, Id64, Id64Array, Id64String, IModelStatus, Logger, LogLevel, ProcessDetector } from "@bentley/bentleyjs-core";
import { Point3d, Range2d, Range3d, StandardViewIndex, YawPitchRollAngles } from "@bentley/geometry-core";
import { ChangesType } from "@bentley/imodelhub-client";
import { Code, ColorByName, ColorDef, IModel, IModelVersion, PhysicalElementProps, Placement3d, RenderMode, SubCategoryAppearance, ViewFlagProps, ViewFlags } from "@bentley/imodeljs-common";
import {
  BackendLoggerCategory, BisCoreSchema, BriefcaseDb, CategorySelector, ConcurrencyControl, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DisplayStyleCreationOptions, DocumentListModel, Drawing, DrawingCategory, DrawingViewDefinition, ECSqlStatement, Element, ElementRefersToElements, ExternalSourceAspect,
  FunctionalModel,
  FunctionalSchema,
  IModelDb,  IModelHost, IModelJsFs, IModelJsNative, IModelTransformer, InformationPartitionElement, ModelSelector, NativeLoggerCategory, PhysicalElement, PhysicalModel,
  PhysicalObject, PhysicalPartition, SnapshotDb, SpatialCategory, SpatialViewDefinition,
} from "../../imodeljs-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { CountingIModelImporter, IModelToTextFileExporter, IModelTransformerUtils, TestIModelTransformer } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { StandardDefinitionManager } from "../../substation desing/StandardDefinitionManager";
import { lockElements } from "../../substation desing/EntityLocks";
import { EquipmentPlacementProps, EquipmentPlacementService } from "../../substation desing/EquipmentPlacementService";
import { DefinitionContainerName, TestDefinitionDataCodes } from "../../substation desing/TestDataConstants";
import { DefinitionImportEngine } from "../../substation desing/DefinitionImportEngine";
import { SubstationSchema } from "./Schema";

const  catalogDbPath = "C:\\Users\\Pratik.Thube\\source\\repos\\imodeljs\\core\\backend\\src\\substation desing\\catlog\\Substation Test Catalog.bim";
/**
 * Creates a 3d view with some defaults. To be improved if we want to expose this.
 */
async function insert3dView(context: AuthorizedClientRequestContext, iModelDb: IModelDb, modelIds: Id64Array, definitionModelId: Id64String, categoryIds: Id64Array): Promise<Id64String> {
  context.enter();

  // Default view display settings
  const viewFlagProps: ViewFlagProps = {
    renderMode: RenderMode.SmoothShade,
    grid: true,
    acs: true,
    noTransp: true,
    clipVol: false,
  };
  const displayStyleOptions: DisplayStyleCreationOptions = {
    backgroundColor: ColorDef.fromTbgr(ColorByName.lightGray),
    viewFlags: ViewFlags.fromJSON(viewFlagProps),
  };

  const viewName = "Default 3D View";
  const modelSelector: ModelSelector = ModelSelector.create(iModelDb, definitionModelId, viewName, modelIds);
  const categorySelector: CategorySelector = CategorySelector.create(iModelDb, definitionModelId, viewName, categoryIds);
  const displayStyle: DisplayStyle3d = DisplayStyle3d.create(iModelDb, definitionModelId, viewName, displayStyleOptions);

  const viewRange = new Range3d(-100, -100, -100, 100, 100, 100);

  await lockElements(context, iModelDb, DbOpcode.Insert, [modelSelector, categorySelector, displayStyle]);
  context.enter();
  const modelSelectorId: Id64String = modelSelector.insert();
  const categorySelectorId: Id64String = categorySelector.insert();
  const displayStyleId: Id64String = displayStyle.insert();

  const spatialView: SpatialViewDefinition = SpatialViewDefinition.createWithCamera(iModelDb, definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, viewRange, StandardViewIndex.Iso);

  await lockElements(context, iModelDb, DbOpcode.Insert, [spatialView]);
  context.enter();
  const spatialViewId: Id64String = spatialView.insert();

  return spatialViewId;
}

/**
 * Creates a 2d view with some defaults. To be improved if we want to expose this.
 */
async function insert2dView(context: AuthorizedClientRequestContext, iModelDb: IModelDb, drawingModelId: Id64String, definitionModelId: Id64String, categoryIds: Id64Array): Promise<Id64String> {
  const viewName = "Default 2D View";
  const categorySelector: CategorySelector = CategorySelector.create(iModelDb, definitionModelId, viewName, categoryIds);
  const viewRange = new Range2d(-100, -100, 100, 100);
  const displayStyle: DisplayStyle2d = DisplayStyle2d.create(iModelDb, definitionModelId, viewName);

  await lockElements(context, iModelDb, DbOpcode.Insert, [categorySelector, displayStyle]);
  context.enter();
  const categorySelectorId: Id64String = categorySelector.insert();
  const displayStyleId: Id64String = displayStyle.insert();

  const drawingView: DrawingViewDefinition = DrawingViewDefinition.create(iModelDb, definitionModelId, viewName, drawingModelId, categorySelectorId, displayStyleId, viewRange);

  await lockElements(context, iModelDb, DbOpcode.Insert, [drawingView]);
  context.enter();
  const drawingViewId: Id64String = drawingView.insert();

  return drawingViewId;
}

async function provisionOnlineIModel(context: AuthorizedClientRequestContext, iModel: IModelDb){
  context.enter();
  if (iModel.isBriefcaseDb()) {
    iModel.concurrencyControl.startBulkMode();
    context.enter();
  }
  // Import Temp Electrical, Functional schemas.
  const electricalSchemaPath = "\\\\?\\C:\\Users\\Pratik.Thube\\source\\repos\\imodeljs\\core\\backend\\src\\test\\Substation.ecschema.xml";
  const schemas: string[] = [BisCoreSchema.schemaFilePath, FunctionalSchema.schemaFilePath, electricalSchemaPath];
  await iModel.importSchemas(ClientRequestContext.current, schemas);

  // Changeset containing schema imports should not have any other kind of changes
  iModel.saveChanges();

  // Default partitions and models
  const spatialLocationModelId: Id64String = PhysicalModel.insert(iModel, IModel.rootSubjectId, "Substation Physical");
  const documentListModelId: Id64String = DocumentListModel.insert(iModel, IModel.rootSubjectId, "Substation Documents");
  const definitionModelId: Id64String = DefinitionModel.insert(iModel, IModel.rootSubjectId, "Substation Definitions");
  const drawingModelId: Id64String = Drawing.insert(iModel, documentListModelId, "Substation Drawings");
  const functionalModelId: Id64String = FunctionalModel.insert(iModel, IModel.rootSubjectId, "Substation Functional");

  // Create a couple of default categories (later these follow the schema)
  const appearance: SubCategoryAppearance = new SubCategoryAppearance({
    color: ColorByName.black,
    fill: ColorByName.blue,
  });
  const defaultSpatialCategoryId: Id64String = SpatialCategory.insert(iModel, definitionModelId,
    "Default Category (Spatial)", appearance);
  const defaultDrawingCategoryId: Id64String = DrawingCategory.insert(iModel, definitionModelId,
    "Default Category (Drawing)", appearance);

  const defaultView3dId: Id64String = await insert3dView(context, iModel, [spatialLocationModelId], definitionModelId, [defaultSpatialCategoryId]);
  context.enter();
  const defaultView2dId: Id64String = await insert2dView(context, iModel, drawingModelId, definitionModelId, [defaultDrawingCategoryId]);
  context.enter();

  iModel.views.setDefaultViewId(defaultView3dId);

  const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
  iModel.updateProjectExtents(projectExtents);

  // Import CodeSpecs
  const defManager = new StandardDefinitionManager(iModel);
  defManager.ensureStandardCodeSpecs();

  if (iModel.isBriefcaseDb()) {
    await iModel.concurrencyControl.endBulkMode(context);
    context.enter();
  }

  iModel.saveChanges();
}

describe.only("IModelTransformerHubSubstationSpecific (#integration)", () => {
  const outputDir = join(KnownTestLocations.outputDir, "IModelTransformerHub");
  let projectId: GuidString;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    HubMock.startup("IModelTransformerHub");
    IModelJsFs.recursiveMkDirSync(outputDir);

    requestContext = await IModelTestUtils.getUserContext(TestUserType.Regular);
    projectId = HubUtility.contextId!;

    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
      Logger.setLevel(NativeLoggerCategory.Changeset, LogLevel.Trace);
    }
  });
  after(() => HubMock.shutdown());

  it("should merge changes made on a branch back to master", async () => {
    SubstationSchema.registerSchema();
    // create and push master IModel
    const masterIModelName = "Master";
    const masterSeedFileName = join(outputDir, `${masterIModelName}.bim`);
    if (IModelJsFs.existsSync(masterSeedFileName))
      IModelJsFs.removeSync(masterSeedFileName); // make sure file from last run does not exist

    const state0 = [1, 2];
    const masterSeedDb = SnapshotDb.createEmpty(masterSeedFileName, { rootSubject: { name: "Master" } });
    // populateMaster(masterSeedDb, state0);
    assert.isTrue(IModelJsFs.existsSync(masterSeedFileName));
    masterSeedDb.nativeDb.saveProjectGuid(projectId); // WIP: attempting a workaround for "ContextId was not properly setup in the checkpoint" issue
    masterSeedDb.saveChanges();
    masterSeedDb.close();
    const masterIModelId = await IModelHost.hubAccess.createIModel({ contextId: projectId, iModelName: masterIModelName, revision0: masterSeedFileName });
    assert.isTrue(Guid.isGuid(masterIModelId));
    IModelJsFs.removeSync(masterSeedFileName); // now that iModel is pushed, can delete local copy of the seed
    const masterDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: masterIModelId });
    masterDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    await provisionOnlineIModel( requestContext, masterDb);
    await saveAndPushChanges(masterDb, "State0");
    assert.isTrue(masterDb.isBriefcaseDb());
    assert.equal(masterDb.contextId, projectId);
    assert.equal(masterDb.iModelId, masterIModelId);
    const changeSetMasterState0 = masterDb.changeSetId;

    // create Branch1 iModel using Master as a template
    const branchIModelName1 = "Branch1";
    const branchIModelId1 = await IModelHost.hubAccess.createIModel({ contextId: projectId, iModelName: branchIModelName1, description: `Branch1 of ${masterIModelName}`, revision0: masterDb.pathName });

    const branchDb1 = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: branchIModelId1 });
    branchDb1.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    assert.isTrue(branchDb1.isBriefcaseDb());
    assert.equal(branchDb1.contextId, projectId);
    const changeSetBranch1First = branchDb1.changeSetId;

    // create empty iModel meant to contain replayed master history
    const replayedIModelName = "Replayed";
    const replayedIModelId = await IModelHost.hubAccess.createIModel({ contextId: projectId, iModelName: replayedIModelName, description: "blank" });

    const replayedDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: replayedIModelId });
    replayedDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    assert.isTrue(replayedDb.isBriefcaseDb());
    assert.equal(replayedDb.contextId, projectId);

    try {
      // record provenance in Branch1 and Branch2 iModels
      const provenanceInserterB1 = new IModelTransformer(masterDb, branchDb1, {
        wasSourceIModelCopiedToTarget: true,
      });
      await provenanceInserterB1.processAll();
      provenanceInserterB1.dispose();
      assert.equal(count(masterDb, ExternalSourceAspect.classFullName), 0);

      // push Branch1 and Branch2 provenance changes
      await saveAndPushChanges(branchDb1, "State0");
      const changeSetBranch1State0 = branchDb1.changeSetId;
      assert.notEqual(changeSetBranch1State0, changeSetBranch1First);

      // push Branch1 State1
      // await importACMEBreakerDefination(requestContext, branchDb1);
      await placeACMEBreaker(requestContext, branchDb1, "TEST01");
      await saveAndPushChanges(branchDb1, "State0 -> State1");
      const changeSetBranch1State1 = branchDb1.changeSetId;
      assert.notEqual(changeSetBranch1State1, changeSetBranch1State0);

      // merge changes made on Branch1 back to Master
      const branch1ToMaster = new IModelTransformer(branchDb1, masterDb, {
        isReverseSynchronization: true, // provenance stored in source/branch
      });
      await branch1ToMaster.processChanges(requestContext, changeSetBranch1State1);
      branch1ToMaster.dispose();
      assert.equal(count(masterDb, ExternalSourceAspect.classFullName), 0);
      await saveAndPushChanges(masterDb, "State0 -> State2"); // a squash of 2 branch changes into 1 in the masterDb change ledger
      const changeSetMasterState2 = masterDb.changeSetId;
      assert.notEqual(changeSetMasterState2, changeSetMasterState0);
      branchDb1.saveChanges(); // saves provenance locally in case of re-merge

      const masterDbChangeSets = await IModelHost.hubAccess.downloadChangesets({ requestContext, iModelId: masterIModelId, range: { after: "", end: masterDb.changeSetId } });
      assert.equal(masterDbChangeSets.length, 3);
      const masterDeletedElementIds = new Set<Id64String>();
      for (const masterDbChangeSet of masterDbChangeSets) {
        assert.isDefined(masterDbChangeSet.id);
        assert.isDefined(masterDbChangeSet.description); // test code above always included a change description when pushChanges was called
        const changeSetPath = masterDbChangeSet.pathname;
        assert.isTrue(IModelJsFs.existsSync(changeSetPath));
        // below is one way of determining the set of elements that were deleted in a specific changeSet
        const statusOrResult: IModelJsNative.ErrorStatusOrResult<IModelStatus, any> = masterDb.nativeDb.extractChangedInstanceIdsFromChangeSet(changeSetPath);
        assert.isUndefined(statusOrResult.error);
        const result: IModelJsNative.ChangedInstanceIdsProps = JSON.parse(statusOrResult.result);
        assert.isDefined(result.element);
        if (result.element?.delete) {
          result.element.delete.forEach((id: Id64String) => masterDeletedElementIds.add(id));
        }
      }

      // replay master history to create replayed iModel
      const sourceDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: masterIModelId, asOf: IModelVersion.first().toJSON() });
      const replayTransformer = new IModelTransformer(sourceDb, replayedDb);
      // this replay strategy pretends that deleted elements never existed
      for (const elementId of masterDeletedElementIds) {
        replayTransformer.exporter.excludeElement(elementId);
      }
      // note: this test knows that there were no schema changes, so does not call `processSchemas`
      await replayTransformer.processAll(); // process any elements that were part of the "seed"
      await saveAndPushChanges(replayedDb, "changes from source seed");
      for (const masterDbChangeSet of masterDbChangeSets) {
        await sourceDb.pullAndMergeChanges(requestContext, IModelVersion.asOfChangeSet(masterDbChangeSet.id));
        await replayTransformer.processChanges(requestContext, sourceDb.changeSetId);
        await saveAndPushChanges(replayedDb, masterDbChangeSet.description ?? "", masterDbChangeSet.changesType);
      }
      replayTransformer.dispose();
      sourceDb.close();

      // make sure there are no deletes in the replay history (all elements that were eventually deleted from masterDb were excluded)
      const replayedDbChangeSets = await IModelHost.hubAccess.downloadChangesets({ requestContext, iModelId: replayedIModelId, range: { after: "", end: replayedDb.changeSetId } });
      assert.isAtLeast(replayedDbChangeSets.length, masterDbChangeSets.length); // replayedDb will have more changeSets when seed contains elements
      const replayedDeletedElementIds = new Set<Id64String>();
      for (const replayedDbChangeSet of replayedDbChangeSets) {
        assert.isDefined(replayedDbChangeSet.id);
        const changeSetPath = replayedDbChangeSet.pathname;
        assert.isTrue(IModelJsFs.existsSync(changeSetPath));
        // below is one way of determining the set of elements that were deleted in a specific changeSet
        const statusOrResult: IModelJsNative.ErrorStatusOrResult<IModelStatus, any> = replayedDb.nativeDb.extractChangedInstanceIdsFromChangeSet(changeSetPath);
        assert.isUndefined(statusOrResult.error);
        const result: IModelJsNative.ChangedInstanceIdsProps = JSON.parse(statusOrResult.result);
        assert.isDefined(result.element);
        if (result.element?.delete) {
          result.element.delete.forEach((id: Id64String) => replayedDeletedElementIds.add(id));
        }
      }
      assert.equal(replayedDeletedElementIds.size, 0);

      masterDb.close();
      branchDb1.close();
      replayedDb.close();
    } finally {
      await IModelHost.hubAccess.deleteIModel({ contextId: projectId, iModelId: masterIModelId });
      await IModelHost.hubAccess.deleteIModel({ contextId: projectId, iModelId: branchIModelId1 });
      await IModelHost.hubAccess.deleteIModel({ contextId: projectId, iModelId: replayedIModelId });
    }
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  async function saveAndPushChanges(briefcaseDb: BriefcaseDb, description: string, changesType?: ChangesType): Promise<void> {
    await briefcaseDb.concurrencyControl.request(requestContext);
    briefcaseDb.saveChanges(description);
    return briefcaseDb.pushChanges(requestContext, description, changesType);
  }

  async function  importACMEBreakerDefination(requestContext:  AuthorizedClientRequestContext, targetDB: IModelDb) {
    requestContext.enter();
    const sourceDb = SnapshotDb.openFile(catalogDbPath);
    const srcStandardDefinitionManager = new StandardDefinitionManager(sourceDb);
    const targetStandardDefinitionManager = new StandardDefinitionManager(targetDB);
    const defImporter = new DefinitionImportEngine(srcStandardDefinitionManager, targetStandardDefinitionManager);
    const breakerDefId = srcStandardDefinitionManager.tryGetEquipmentDefinitionId(DefinitionContainerName.SampleEquipmentCatalog, TestDefinitionDataCodes.ACMEBreaker);
    await defImporter.importEquipmentDefinition(requestContext, breakerDefId!);
  }

  function getEquipmentPlacementProps(srcIModelDbPath: string, targetIModelDb: IModelDb, equipmentDefId: string, placement: Placement3d, codeValue: string): EquipmentPlacementProps {
    const physicalModelId = targetIModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetIModelDb, IModel.rootSubjectId, "Substation Physical"))!;// IModelDb.rootSubjectId
    const functionalModelId = targetIModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetIModelDb, IModel.rootSubjectId, "Substation Functional"))!;
    const drawingModelId = targetIModelDb.elements.queryElementIdByCode(InformationPartitionElement.createCode(targetIModelDb,IModel.rootSubjectId, "Substation Drawing"))!;

    const props: EquipmentPlacementProps = {
      equipmentDefinitionId: equipmentDefId,
      catalogDbPath: srcIModelDbPath,
      physicalModelId,
      functionalModelId,
      drawingModelId,
      placement,
      codeValue,
    };

    return props;
  }

  async function placeACMEBreaker(requestContext: AuthorizedClientRequestContext, iModelDb: IModelDb, codeValue: string) {
    requestContext.enter();
    if (iModelDb.isBriefcaseDb()) {
      iModelDb.concurrencyControl.startBulkMode();
      requestContext.enter();
    }
    const srcDb = SnapshotDb.openFile(catalogDbPath);
    const definitionId = EquipmentPlacementService.getEquipmentDefinitionIdByName(TestDefinitionDataCodes.ACMEBreaker, srcDb);
    const placement = new Placement3d(Point3d.create(0, 0, 0), new YawPitchRollAngles(), new Range3d());

    const placementProps = getEquipmentPlacementProps(catalogDbPath, iModelDb, definitionId, placement, codeValue);

    const placedBreakerEquipmentId = await EquipmentPlacementService.placeEquipment(requestContext, iModelDb, placementProps);
    assert.isTrue(Id64.isValidId64(placedBreakerEquipmentId));

    if (iModelDb.isBriefcaseDb()) {
      await iModelDb.concurrencyControl.endBulkMode(requestContext);
      requestContext.enter();
    }
    const physicalElement = iModelDb.elements.getElement<PhysicalElement>(placedBreakerEquipmentId, PhysicalElement);
    assert.isTrue(Id64.isValidId64(physicalElement.id));
    assert.equal(physicalElement.code.value, codeValue);
  }
});

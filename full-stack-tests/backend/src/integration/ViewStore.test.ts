/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { existsSync, mkdirSync, unlinkSync } from "fs-extra";
import { Suite } from "mocha";
import { join } from "path";
import * as sinon from "sinon";
import {
  AuxCoordSystem2d, CategorySelector, CloudSqlite, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory,
  DrawingGraphic, DrawingViewDefinition, GroupModel, IModelDb, IModelHost, InformationRecordModel, ModelSelector, OrthographicViewDefinition,
  PhysicalModel, RenderMaterialElement, SpatialCategory, SpatialLocationModel, SpatialViewDefinition, StandaloneDb, SubCategory, Subject, ViewStore,
} from "@itwin/core-backend";
import { CompressedId64Set, Guid, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import {
  AuxCoordSystem2dProps, Camera, Code, CodeScopeSpec, ColorByName, ColorDef, DefinitionElementProps, DisplayStyle3dProps, DisplayStyle3dSettingsProps,
  Environment, GeometricElement2dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, LocalFileName, PlanProjectionSettings, SkyBoxImageType,
  SpatialViewDefinitionProps, SubCategoryAppearance, SubCategoryOverride, ViewDefinition2dProps, ViewDefinitionProps,
} from "@itwin/core-common";
import { LineString3d, Matrix3d, Point2d, Point3d, Range2d, Range3d, StandardViewIndex, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import { AzuriteTest } from "./AzuriteTest";

const viewContainer = "views-itwin1";
const storageType = "azure" as const;
let iModel: StandaloneDb;
let vs1: ViewStore.CloudAccess;
let drawingViewId: Id64String;
let auxCoordSystemId: Id64String;
let guidMap: IModelDb.GuidMapper;

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props = { baseUri: AzuriteTest.baseUri, storageType, containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await ViewStore.CloudAccess.initializeDb({ ...props, accessToken });
}

async function makeViewStore(user: string) {
  const props = { baseUri: AzuriteTest.baseUri, storageType, containerId: viewContainer, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const viewStore = new ViewStore.CloudAccess({ ...props, accessToken });
  viewStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: user }));
  viewStore.lockParams.user = user;
  return viewStore;
}

function insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
  const appearance: SubCategoryAppearance.Props = {
    color: color.toJSON(),
    transp: 0,
    invisible: false,
  };
  return SpatialCategory.insert(iModelDb, modelId, categoryName, appearance);
}

function createRectangle(size: Point2d): GeometryStreamProps {
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

function prepareOutputFile(subDirName: string, fileName: string): LocalFileName {
  const outputDir = join(__dirname, "output", subDirName);
  if (!existsSync(outputDir))
    mkdirSync(outputDir, { recursive: true });

  const outputFile = join(outputDir, fileName);
  if (existsSync(outputFile))
    unlinkSync(outputFile);

  return outputFile;
}

function populateDb(sourceDb: IModelDb) {
  // make sure Arial is in the font table
  sourceDb.addNewFont("Arial");
  assert.exists(sourceDb.fontMap.getFont("Arial"));

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
  auxCoordSystemId = sourceDb.elements.insertElement(auxCoordSystemProps);
  assert.isTrue(Id64.isValidId64(auxCoordSystemId));
  const renderMaterialId = RenderMaterialElement.insert(sourceDb, definitionModelId, "RenderMaterial", { paletteName: "PaletteName" });
  assert.isTrue(Id64.isValidId64(renderMaterialId));
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
  const drawingGraphicId1 = sourceDb.elements.insertElement(drawingGraphicProps1);
  assert.isTrue(Id64.isValidId64(drawingGraphicId1));
  const drawingGraphicProps2: GeometricElement2dProps = {
    classFullName: DrawingGraphic.classFullName,
    model: drawingId,
    category: drawingCategoryId,
    code: Code.createEmpty(),
    userLabel: "DrawingGraphic2",
    geom: createRectangle(Point2d.create(1, 1)),
    placement: { origin: Point2d.create(3, 3), angle: 0 },
  };
  const drawingGraphicId2 = sourceDb.elements.insertElement(drawingGraphicProps2);
  assert.isTrue(Id64.isValidId64(drawingGraphicId2));
  // Insert DisplayStyles
  const displayStyle2dId = DisplayStyle2d.insert(sourceDb, definitionModelId, "DisplayStyle2d");
  assert.isTrue(Id64.isValidId64(displayStyle2dId));
  const displayStyle3d: DisplayStyle3d = DisplayStyle3d.create(sourceDb, definitionModelId, "DisplayStyle3d");
  const subCategoryOverride: SubCategoryOverride = SubCategoryOverride.fromJSON({ color: ColorDef.from(1, 2, 3).toJSON() });
  displayStyle3d.settings.overrideSubCategory(subCategoryId, subCategoryOverride);
  displayStyle3d.settings.addExcludedElements("0x123");
  displayStyle3d.settings.setPlanProjectionSettings(spatialLocationModelId, new PlanProjectionSettings({ elevation: 10.0 }));
  displayStyle3d.settings.environment = Environment.fromJSON({
    sky: {
      image: {
        type: SkyBoxImageType.Spherical,
        texture: "0x31",
      },
    },
  });
  const displayStyle3dId = displayStyle3d.insert();
  assert.isTrue(Id64.isValidId64(displayStyle3dId));
  // Insert ViewDefinitions
  const viewId = OrthographicViewDefinition.insert(sourceDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, projectExtents, StandardViewIndex.Iso);
  assert.isTrue(Id64.isValidId64(viewId));
  const drawingViewRange = new Range2d(0, 0, 100, 100);
  drawingViewId = DrawingViewDefinition.insert(sourceDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
  assert.isTrue(Id64.isValidId64(drawingViewId));
}

describe("ViewStore", function (this: Suite) {
  this.timeout(0);

  class FakeGuids {
    private _ids = new Map<Id64String, GuidString>();
    private _guids = new Map<GuidString, Id64String>();
    private add(id: Id64String, guid: GuidString) {
      this._ids.set(id, guid);
      this._guids.set(guid, id);
      return guid;
    }
    public getFederationGuidFromId(id: Id64String): GuidString | undefined {
      return this._ids.get(id) ?? this.add(id, Guid.createValue());
    }
    public getIdFromFederationGuid(guid?: GuidString): Id64String | undefined {
      return guid ? this._guids.get(guid) : undefined;
    }
  }

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer(viewContainer);
    vs1 = await makeViewStore("viewStore1");
    iModel = StandaloneDb.createEmpty(prepareOutputFile("ViewStore", "test.bim"), {
      rootSubject: { name: "ViewStore tests", description: "ViewStore tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
    guidMap = new FakeGuids();
    vs1.getCloudDb().guidMap = guidMap;
    populateDb(iModel);
  });
  after(async () => {
    vs1.close();
    iModel.close();
    IModelHost.authorizationClient = undefined;
  });

  it("access ViewStore", async () => {
    const vs1locker = vs1.writeLocker;
    const vs1reader = vs1.reader;

    const c1 = { time: 3, interpolation: 2, value: { red: 0, green: 1, blue: 2 } };
    const c2 = { time: 4, interpolation: 2, value: { red: 255, green: 254, blue: 253 } };
    const colorTimeline = [c1, c2];

    const displayStyleProps: DisplayStyle3dSettingsProps = {
      backgroundColor: ColorDef.fromString("rgb(255,20,10)").toJSON(),
      subCategoryOvr:
        [{
          subCategory: "0x40",
          color: ColorByName.fuchsia,
          invisible: true,
          style: "0xaaa",
          weight: 10,
          transp: 0.5,
        },
        {
          subCategory: "0x41",
          color: ColorByName.darkBlue,
          invisible: false,
          style: "0xaa3",
          weight: 10,
        },
        ],

      excludedElements: CompressedId64Set.compressArray(["0x8", "0x12", "0x22"]),
      scheduleScript: [{
        modelId: "0x21",
        realityModelUrl: "reality.com",
        elementTimelines: [{
          batchId: 64,
          colorTimeline,
          elementIds: CompressedId64Set.compressArray(["0x1a", "0x1d"]),
        }, {
          batchId: 65,
          elementIds: CompressedId64Set.compressArray(["0x2a", "0x2b", "0x2d", "0x2e", "0x144"]),
        }],
      }],
    };

    const dsEl = DisplayStyle3d.create(iModel, IModel.dictionaryId, "test style 1", displayStyleProps);
    const styleProps = dsEl.toJSON() as DisplayStyle3dProps;
    const dsId = iModel.elements.insertElement(styleProps);
    const ds1Row = await vs1locker.addDisplayStyle({ className: dsEl.classFullName, name: dsEl.code.value, settings: styleProps.jsonProperties!.styles! });
    expect(ds1Row).equals("@1");
    expect(Id64.isValid(dsId)).true;

    const categories = ["0x101", "0x22"];
    const cs1Row = await vs1locker.addCategorySelector({ selector: { ids: categories }, name: "default" });
    const cs1Id = CategorySelector.insert(iModel, IModel.dictionaryId, "default", categories);
    expect(Id64.isValid(cs1Id)).true;
    expect(cs1Row).equals("@1");

    const models = ["0x11", "0x32"];
    const ms1Id = ModelSelector.insert(iModel, IModel.dictionaryId, "default", models);
    const ms1Row = await vs1locker.addModelSelector({ selector: { ids: models }, name: "default" });
    expect(Id64.isValid(ms1Id)).true;
    expect(ms1Row).equals("@1");

    const viewDef: ViewDefinitionProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "spatial",
      categorySelectorId: "@1",
      displayStyleId: "@1",
    };
    viewDef.code.value = "view1";

    expect(vs1reader.getViewByNameSync({ name: "view1" })).to.be.undefined;
    const v1Id = await vs1locker.addView({ viewDefinition: viewDef, owner: "owner1" });
    expect(v1Id).equals("@1");

    const v1 = vs1reader.getViewByNameSync({ name: "view1" })!;
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).equals("@1");
    expect(v1.isPrivate).to.be.false;
    expect(v1.name).equals("view1");

    const g1 = await vs1locker.addViewGroup({ name: "group1" });
    const foundViewGroups = await vs1reader.getViewGroups({});
    expect(foundViewGroups.length).eq(1);
    expect(foundViewGroups[0].id).eq(g1);

    const standardView = StandardViewIndex.Iso;
    const rotation = Matrix3d.createStandardWorldToView(standardView);
    const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const range = new Range3d(1, 1, 1, 8, 8, 8);
    const rotatedRange = rotationTransform.multiplyRange(range);
    const basicProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "BisCore:SpatialViewDefinition",
      cameraOn: false,
      origin: rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z),
      extents: rotatedRange.diagonal(),
      angles,
      camera: new Camera(),
    };

    let props: SpatialViewDefinitionProps = { ...basicProps, modelSelectorId: ms1Id, categorySelectorId: cs1Id, displayStyleId: dsId };
    props.code.value = "view2";
    props.jsonProperties = { viewDetails: { aspectSkew: 1, acs: auxCoordSystemId } };

    const viewDefinition = iModel.elements.createElement<SpatialViewDefinition>(props);
    const viewDefinitionId = iModel.elements.insertElement(viewDefinition.toJSON());
    expect(Id64.isValid(viewDefinitionId)).true;

    props = viewDefinition.toJSON();
    props.categorySelectorId = cs1Row;
    props.displayStyleId = ds1Row;
    props.modelSelectorId = ms1Row;
    const v2Id = await vs1locker.addView({ viewDefinition: props, owner: "owner2", group: g1 });
    expect(v2Id).equals("@2");

    props.classFullName = "spatial";
    props.code.value = "view3";
    const v3Id = await vs1locker.addView({ viewDefinition: props, owner: "owner2", group: g1 });
    expect(v3Id).equals("@3");

    sinon.stub(iModel.elements, "getFederationGuidFromId").callsFake((id) => guidMap.getFederationGuidFromId(id));
    sinon.stub(iModel.elements, "getIdFromFederationGuid").callsFake((id) => guidMap.getIdFromFederationGuid(id));

    iModel.views.viewStore = vs1;
    const vsElOut = await iModel.views.getViewStateProps(viewDefinitionId, { displayStyle: { compressExcludedElementIds: true } });
    const vsStoreOut = await iModel.views.getViewStateProps(v2Id, { displayStyle: { compressExcludedElementIds: true } });
    const compareHeader = (props1: DefinitionElementProps, props2: DefinitionElementProps) => {
      expect(props1.code.value).equals(props2.code.value);
      expect(props1.model).equals(props2.model);
      expect(props1.classFullName).equals(props2.classFullName);
    };
    compareHeader(vsElOut.categorySelectorProps, vsStoreOut.categorySelectorProps);
    compareHeader(vsElOut.displayStyleProps, vsStoreOut.displayStyleProps);
    compareHeader(vsElOut.modelSelectorProps!, vsStoreOut.modelSelectorProps!);
    compareHeader(vsElOut.viewDefinitionProps, vsStoreOut.viewDefinitionProps);

    expect(vsElOut.categorySelectorProps.categories).to.deep.equal(vsStoreOut.categorySelectorProps.categories);
    expect(vsElOut.modelSelectorProps!.models).to.deep.equal(vsStoreOut.modelSelectorProps!.models);
    const s1 = vsElOut.displayStyleProps.jsonProperties!.styles! as DisplayStyle3dSettingsProps;
    const s2 = vsStoreOut.displayStyleProps.jsonProperties!.styles! as DisplayStyle3dSettingsProps;
    expect(s1.backgroundMap).to.deep.equal(s2.backgroundMap);
    expect(s1.backgroundColor).to.deep.equal(s2.backgroundColor);
    expect(s1.viewflags).to.deep.equal(s2.viewflags);
    expect(s1.subCategoryOvr).to.deep.equal(s2.subCategoryOvr);
    expect(s1.monochromeColor).to.deep.equal(s2.monochromeColor);
    expect(s1.monochromeMode).to.deep.equal(s2.monochromeMode);
    expect(s1.timePoint).to.deep.equal(s2.timePoint);
    expect(s1.analysisFraction).to.deep.equal(s2.analysisFraction);
    expect(s1.mapImagery).to.deep.equal(s2.mapImagery);
    expect(s1.scheduleScript).to.deep.equal(s2.scheduleScript);
    expect(s1.hline).to.deep.equal(s2.hline);
    expect(s1.ao).to.deep.equal(s2.ao);
    expect(s1.solarShadows).to.deep.equal(s2.solarShadows);

    const vd1 = vsElOut.viewDefinitionProps as SpatialViewDefinitionProps;
    const vd2 = vsStoreOut.viewDefinitionProps as SpatialViewDefinitionProps;
    expect(vd1.camera).to.deep.equal(vd2.camera);
    expect(vd1.origin).to.deep.equal(vd2.origin);
    expect(vd1.extents).to.deep.equal(vd2.extents);
    expect(YawPitchRollAngles.fromJSON(vd1.angles).isAlmostEqual(YawPitchRollAngles.fromJSON(vd2.angles))).true;
    expect(vd1.cameraOn).to.deep.equal(vd2.cameraOn);
    expect(vd1.jsonProperties).to.deep.equal(vd2.jsonProperties);

    expect(vs1reader.queryViewsSync({ classNames: ["spatial"] }).length).equals(1);
    expect(vs1reader.queryViewsSync({ group: g1, classNames: ["BisCore:SpatialViewDefinition"] }).length).equals(1);
    expect(vs1reader.queryViewsSync({ group: g1, classNames: ["spatial", "BisCore:SpatialViewDefinition", "blah"] }).length).equals(2);
    expect(vs1reader.queryViewsSync({ classNames: [] }).length).equals(0);
    expect(vs1reader.queryViewsSync({ classNames: ["blah"] }).length).equals(0);
    expect((await vs1reader.findViewsByOwner({ owner: "owner1" })).length).equals(1);

    expect(vs1reader.getViewByNameSync({ name: "group1/view2" })!.groupId).equals(g1);
    await vs1locker.deleteViewGroup({ name: g1 });
    expect(vs1reader.getViewByNameSync({ name: "group1/view2" })).to.be.undefined;

    // now test Drawing views.
    const dv = await iModel.views.getViewStateProps(drawingViewId); // this was added in the populateDb function.
    const dcs = await vs1locker.addCategorySelector({ selector: { ids: dv.categorySelectorProps.categories } });
    const dds = await vs1locker.addDisplayStyle({ className: dv.displayStyleProps.classFullName, settings: dv.displayStyleProps.jsonProperties!.styles! });
    dv.viewDefinitionProps.categorySelectorId = dcs;
    dv.viewDefinitionProps.displayStyleId = dds;
    const dvId = await vs1locker.addView({ viewDefinition: dv.viewDefinitionProps, owner: "owner1" });
    expect(dvId).equals("@4");
    const dFromVs = await iModel.views.getViewStateProps(dvId);
    expect(dFromVs.categorySelectorProps.categories).to.deep.equal(dv.categorySelectorProps.categories);
    expect(dFromVs.displayStyleProps.jsonProperties!.styles!).to.deep.equal(dv.displayStyleProps.jsonProperties!.styles!);
    expect(dFromVs.displayStyleProps.classFullName).equals(dv.displayStyleProps.classFullName);
    expect(dFromVs.viewDefinitionProps.classFullName).equals(dv.viewDefinitionProps.classFullName);
    expect(dFromVs.viewDefinitionProps.code.value).equals(dv.viewDefinitionProps.code.value);
    expect(dFromVs.modelExtents).to.deep.equal(dv.modelExtents);
    const v2dEl = dv.viewDefinitionProps as ViewDefinition2dProps;
    const v2dVs = dFromVs.viewDefinitionProps as ViewDefinition2dProps;
    expect(v2dEl.baseModelId).equals(v2dVs.baseModelId);
    expect(v2dEl.angle).to.deep.equal(v2dVs.angle);
    expect(v2dEl.origin).to.deep.equal(v2dVs.origin);
    expect(v2dEl.delta).to.deep.equal(v2dVs.delta);
    expect(v2dEl.jsonProperties).to.deep.equal(v2dVs.jsonProperties);

    sinon.restore();
  });
});


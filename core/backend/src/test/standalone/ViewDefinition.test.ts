/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import { CompressedId64Set, Guid, GuidString, Id64, Id64String, OpenMode } from "@itwin/core-bentley";
import {
  Camera, Code, ColorByName, ColorDef, DisplayStyle3dProps, ElementProps, IModel, IModelError, PlanProjectionSettings, SpatialViewDefinitionProps,
  SubCategoryAppearance,
} from "@itwin/core-common";
import { Matrix3d, Range3d, StandardViewIndex, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  CategorySelector, DictionaryModel, DisplayStyle3d, IModelDb, ModelSelector, SpatialCategory, SpatialViewDefinition, StandaloneDb, ViewStore,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

function createNewModelAndCategory(rwIModel: IModelDb) {
  const modelId = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"))[1];
  const modelId2 = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "PhysicalModel2"), true)[1];
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "TestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = category.insert();
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));

  newCategoryCode.value = "spatial category 2";
  SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value).insert();

  rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, modelId2, spatialCategoryId).toJSON());

  return { modelId, modelId2, spatialCategoryId };
}

// cspell:disable

let vs1: ViewStore.ViewDb;

describe("ViewDefinition", () => {
  // to simulate elements with guids without having to add elements to the iModel
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

  let iModel: StandaloneDb;
  before(() => {
    iModel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("ViewDefinition", "ViewDefinition.bim"), {
      rootSubject: { name: "ViewDefinition tests", description: "ViewDefinition tests" },
      client: "ViewDefinition",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    const dbName = join(KnownTestLocations.outputDir, "viewDefTest.db");
    ViewStore.ViewDb.createNewDb(dbName);
    vs1 = new ViewStore.ViewDb({ iModel, guidMap: new FakeGuids() });
    vs1.openDb(dbName, OpenMode.ReadWrite);
  });

  after(() => {
    iModel.abandonChanges();
    iModel.close();
    vs1.closeDb(true);
  });

  it("SpatialViewDefinition", async () => {
    const { modelId, modelId2, spatialCategoryId } = createNewModelAndCategory(iModel);
    const displayStyleId = DisplayStyle3d.insert(iModel, IModel.dictionaryId, "default", { backgroundColor: ColorDef.fromString("rgb(255,0,0)") });
    const modelSelectorId = ModelSelector.insert(iModel, IModel.dictionaryId, "default", [modelId, modelId2]);
    const categorySelectorId = CategorySelector.insert(iModel, IModel.dictionaryId, "default", [spatialCategoryId]);
    iModel.saveChanges("Basic setup");

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

    const ms1 = iModel.elements.getElement<ModelSelector>(modelSelectorId);
    const ms1Row = await vs1.addModelSelector({ name: ms1.code.value, selector: { ids: ms1.models } });
    expect(ms1Row).equal("@1");
    let ms1out = vs1.getModelSelectorSync({ id: ms1Row });
    expect(ms1out.classFullName).equal("BisCore:ModelSelector");
    expect(ms1out.models.length).equal(2);
    expect(ms1out.models[0]).equal(modelId);
    expect(ms1out.models[1]).equal(modelId2);
    ms1out.models.push("0x123");
    await vs1.updateModelSelector({ id: ms1Row, selector: { ids: ms1out.models } });
    ms1out = vs1.getModelSelectorSync({ id: ms1Row });
    expect(ms1out.models.length).equal(3);
    expect(ms1out.models[2]).equal("0x123");

    const cs1 = iModel.elements.getElement<CategorySelector>(categorySelectorId);
    const cs1Row = await vs1.addCategorySelector({ selector: { ids: cs1.categories } });
    expect(cs1Row).equal("@1");
    let cs1out = vs1.getCategorySelectorSync({ id: cs1Row });
    expect(cs1out.classFullName).equal("BisCore:CategorySelector");
    expect(cs1out.categories.length).equal(1);
    expect(cs1out.categories[0]).equal(spatialCategoryId);
    cs1out.categories.push("0x1234");
    await vs1.updateCategorySelector({ id: cs1Row, selector: { ids: cs1out.categories } });
    cs1out = vs1.getCategorySelectorSync({ id: cs1Row });
    expect(cs1out.categories.length).equal(2);
    expect(cs1out.categories[1]).equal("0x1234");

    const longElementList = CompressedId64Set.sortAndCompress(["0x2a", "0x2b", "0x2d", "0x2e", "0x43", "0x1a", "0x1d", "0x12", "0x22",
      "0x8", "0x21", "0x1b", "0x1c", "0x1e", "0x1f", "0x2c", "0x2f", "0x3a", "0x3b", "0x3d", "0x3e", "0x43",
      "0x4a", "0x4b", "0x4d", "0x4e", "0x5a", "0x5b", "0x5d", "0x5e", "0x6a", "0x6b", "0x6d", "0x6e", "0x7a",
      "0x7b", "0x7d", "0x7e", "0x8a", "0x8b", "0x8d", "0x8e", "0x9a", "0x9b", "0x9d", "0x9e", "0xaa", "0xab", "0xad",
      "0xae", "0xba", "0xbb", "0xbd", "0xbe", "0xf5ca", "0xcb", "0xcd", "0xce", "0xda", "0xdb", "0xdd", "0xde", "0xea",
      "0xeb", "0xed", "0xee", "0xfa", "0xfb", "0xfd", "0xfe", "0x10a", "0x10b", "0x10d", "0x10e", "0x11a", "0x11b", "0x11d",
      "0x11e", "0x12a", "0x12b", "0x12d", "0x12e", "0x13a", "0x13b", "0x13d", "0x13e", "0x14a", "0x14b", "0x14d", "0x14e",
      "0x15a", "0x15b", "0x15d", "0x15e", "0x16a", "0x16b", "0x16d"]);

    await expect(vs1.addCategorySelector({ selector: { query: { from: "BisCore:SubCategory" } } })).to.be.rejectedWith("must select from BisCore:Category");
    const cs2 = (await vs1.addCategorySelector({ selector: { query: { from: "BisCore:Category" } } }));
    expect(cs2).equal("@2");
    const cs3 = (await vs1.addCategorySelector({ selector: { query: { from: "BisCore:Category", adds: longElementList } } }));
    const cs4 = (await vs1.addCategorySelector({ selector: { query: { from: "BisCore:Category", removes: ["0x233", "0x21"], adds: longElementList } } }));
    const onlyUsedProps = {
      name: "only used spatial categories",
      selector: {
        query: {
          from: "BisCore.Category",
          where: "ECInstanceId IN (SELECT DISTINCT Category.Id FROM BisCore.GeometricElement3d)",
        },
      },
    };
    await vs1.addCategorySelector(onlyUsedProps);
    let selected = vs1.getCategorySelectorSync({ id: cs2 });
    expect(selected.categories.length).equal(2);
    selected = vs1.getCategorySelectorSync({ id: cs3 });
    expect(selected.categories.length).equal(98);
    selected = vs1.getCategorySelectorSync({ id: cs4 });
    expect(selected.categories.length).equal(97);
    selected = vs1.getCategorySelectorSync({ name: onlyUsedProps.name });
    expect(selected.categories.length).equal(1);
    expect(selected.categories[0]).equal(spatialCategoryId);

    const ms3 = (await vs1.addModelSelector({ name: "model selector 2", selector: { query: { from: "Bis.GeometricModel3d" } } }));
    let selectedModels = vs1.getModelSelectorSync({ id: ms3 });
    expect(selectedModels.models.length).equal(2);
    const ms4Props = {
      name: "spatial, non-private models",
      selector: {
        query: {
          from: "BisCore.GeometricModel3d",
          where: "IsPrivate=false AND IsTemplate=false AND (IsNotSpatiallyLocated IS NULL OR IsNotSpatiallyLocated=false)",
        },
      },
    };

    await vs1.addModelSelector(ms4Props);
    selectedModels = vs1.getModelSelectorSync({ name: ms4Props.name });
    expect(selectedModels.models.length).equal(1);
    expect(selectedModels.models[0]).equal(modelId);

    const ds1 = iModel.elements.getElement<DisplayStyle3d>(displayStyleId);
    ds1.settings.setPlanProjectionSettings("0x1", new PlanProjectionSettings({ elevation: 1 }));
    ds1.settings.setPlanProjectionSettings("0x2", new PlanProjectionSettings({ elevation: 2 }));

    const styles = (ds1.toJSON() as DisplayStyle3dProps).jsonProperties!.styles!;
    styles.subCategoryOvr =
      [{
        subCategory: spatialCategoryId,
        color: ColorByName.fuchsia,
        invisible: true,
        style: "0xaaa",
        weight: 10,
        transp: 0.5,
      },
      ];

    styles.excludedElements = CompressedId64Set.sortAndCompress(["0x8", "0x12", "0x22"]);
    styles.scheduleScript = [{
      modelId: "0x21",
      realityModelUrl: "altavista.com",
      elementTimelines: [{
        batchId: 64,
        elementIds: CompressedId64Set.sortAndCompress(["0x1a", "0x1d"]),
      }, {
        batchId: 65,
        elementIds: longElementList,
      }],
    }];

    const ds1Row = await vs1.addDisplayStyle({ className: ds1.classFullName, settings: ds1.toJSON().jsonProperties.styles });
    expect(ds1Row).equal("@1");
    const ds1out = vs1.getDisplayStyleSync({ id: ds1Row });
    expect(ds1out.classFullName).equal("BisCore:DisplayStyle3d");
    expect(ds1out.jsonProperties?.styles).deep.equal(JSON.parse(JSON.stringify(styles)));
    ds1out.jsonProperties!.styles!.scheduleScript![0].elementTimelines[0].elementIds = CompressedId64Set.sortAndCompress(["0x11a", "0x11d", "0x11e", "0x12a"]);
    await vs1.updateDisplayStyle({ id: ds1Row, className: ds1.classFullName, settings: ds1out.jsonProperties!.styles! });
    const ds1out2 = vs1.getDisplayStyleSync({ id: ds1Row });
    expect(ds1out2.jsonProperties?.styles).deep.equal(ds1out.jsonProperties!.styles!);

    const tl1Row = await vs1.addTimeline({ name: "TestRenderTimeline", timeline: styles.scheduleScript, owner: "owner2" });
    expect(tl1Row).equal("@1");
    const tl1out = vs1.getTimelineSync({ id: tl1Row });
    expect(tl1out.classFullName).equal("BisCore:RenderTimeline");
    expect(tl1out.id).equal(tl1Row);
    expect(tl1out.code.value).equal("TestRenderTimeline");
    expect(tl1out.script).equal(JSON.stringify(styles.scheduleScript));

    const viewDefProps: SpatialViewDefinitionProps = {
      ...basicProps,
      modelSelectorId: ms1Row,
      categorySelectorId: cs1Row,
      displayStyleId: ds1Row,
    };

    viewDefProps.code = { value: "TestViewDefinition", spec: "0x1", scope: "0x1" };
    const v1 = await vs1.addView({ viewDefinition: viewDefProps, tags: ["big", "in progress", "done"] });
    expect(v1).equal("@1");
    let viewDefOut = vs1.getViewDefinitionSync({ viewId: v1 }) as SpatialViewDefinitionProps;
    expect(viewDefOut.code.value).equal("TestViewDefinition");
    expect(viewDefOut.classFullName).equal("BisCore:SpatialViewDefinition");
    expect(viewDefOut.modelSelectorId).equal(ms1Row);
    expect(viewDefOut.categorySelectorId).equal(cs1Row);
    expect(viewDefOut.displayStyleId).equal(ds1Row);
    expect(viewDefOut.cameraOn).equal(false);
    expect(JSON.stringify(viewDefOut.origin)).equal(JSON.stringify(basicProps.origin));
    expect(JSON.stringify(viewDefOut.extents)).equal(JSON.stringify(basicProps.extents));
    expect(JSON.stringify(viewDefOut.angles)).equal(JSON.stringify(basicProps.angles));
    expect(JSON.stringify(viewDefOut.camera)).equal(JSON.stringify(basicProps.camera));
    viewDefOut.cameraOn = true;
    viewDefOut.origin = [1, 2, 3];
    await vs1.updateViewDefinition({ viewId: v1, viewDefinition: viewDefOut });
    viewDefOut = vs1.getViewDefinitionSync({ viewId: v1 }) as SpatialViewDefinitionProps;
    expect(viewDefOut.cameraOn).equal(true);
    expect(JSON.stringify(viewDefOut.origin)).equal(JSON.stringify([1, 2, 3]));
    viewDefOut.displayStyleId = "@2";
    await expect(vs1.updateViewDefinition({ viewId: v1, viewDefinition: viewDefOut })).to.be.rejectedWith("invalid Id for displayStyles");
    // add a new display style and uodate the view to use it
    viewDefOut.displayStyleId = await vs1.addDisplayStyle({ className: ds1.classFullName, settings: ds1.toJSON().jsonProperties.styles });
    await vs1.updateViewDefinition({ viewId: v1, viewDefinition: viewDefOut });
    viewDefOut = vs1.getViewDefinitionSync({ viewId: v1 }) as SpatialViewDefinitionProps;
    expect(viewDefOut.displayStyleId).equal("@2");
    const vinfo = await vs1.getViewInfo({ viewId: v1 });
    expect(vinfo?.displayStyleId).equal(viewDefOut.displayStyleId);
    viewDefOut.displayStyleId = "@1";
    await vs1.updateViewDefinition({ viewId: v1, viewDefinition: viewDefOut }); // change it back for sharing test below

    viewDefProps.code.value = "TestViewDefinition2";
    const v2 = await vs1.addView({ viewDefinition: viewDefProps, tags: ["big", "done"] });
    await vs1.addTagsToView({ viewId: v2, tags: ["problems", "finished", "big"] });

    let tags = vs1.getTagsForView(v2);
    expect(tags?.length).equal(4);
    expect(tags).includes("big");
    expect(tags).includes("done");
    await vs1.removeTagFromView({ viewId: v2, tag: "done" });
    tags = vs1.getTagsForView(v2);
    expect(tags).not.includes("done");
    expect(tags?.length).equal(3);

    // v1 and v2 share modelselector, categoryselector, and displaystyle so when v2 is deleted they should not be deleted
    await vs1.deleteView({ viewId: v2 });
    expect(() => vs1.getViewDefinitionSync({ viewId: v2 })).throws("View not found");
    expect(vs1.getDisplayStyleRow(1)).not.undefined;
    expect(vs1.getModelSelectorRow(1)).not.undefined;
    expect(vs1.getCategorySelectorRow(1)).not.undefined;

    // the categoryselector, and displaystyle are no longer shared, so they should be deleted when v1 is deleted
    await vs1.deleteView({ viewId: v1 });
    expect(() => vs1.getViewDefinitionSync({ viewId: v1 })).throws("View not found");
    expect(vs1.getDisplayStyleRow(1)).undefined;
    expect(vs1.getCategorySelectorRow(1)).undefined;
    expect(vs1.getModelSelectorRow(1)).not.undefined; // modelselector has a name so it should not be deleted

    // attempt to create a ViewDefinition element with invalid properties
    assert.throws(() => iModel.elements.createElement({ ...basicProps, modelSelectorId, categorySelectorId } as ElementProps), IModelError, "displayStyleId is invalid");
    assert.throws(() => iModel.elements.createElement({ ...basicProps, categorySelectorId, displayStyleId } as ElementProps), IModelError, "modelSelectorId is invalid");
    assert.throws(() => iModel.elements.createElement({ ...basicProps, modelSelectorId, displayStyleId } as ElementProps), IModelError, "categorySelectorId is invalid");

    // attempt to insert a ViewDefinition with invalid properties
    assert.throws(() => iModel.elements.insertElement({ ...basicProps, modelSelectorId, categorySelectorId, displayStyleId: modelId } as ElementProps), "invalid displayStyle");
    assert.throws(() => iModel.elements.insertElement({ ...basicProps, modelSelectorId: modelId, displayStyleId, categorySelectorId } as ElementProps), "invalid modelSelector");
    assert.throws(() => iModel.elements.insertElement({ ...basicProps, modelSelectorId, categorySelectorId: modelId, displayStyleId } as ElementProps), "invalid categorySelector");

    // Better way to create and insert
    const props: SpatialViewDefinitionProps = { ...basicProps, modelSelectorId, categorySelectorId, displayStyleId };
    const viewDefinition = iModel.elements.createElement<SpatialViewDefinition>(props);
    const viewDefinitionId = iModel.elements.insertElement(viewDefinition.toJSON());
    assert.isNotEmpty(viewDefinitionId);
    assert.isTrue(Id64.isValid(viewDefinitionId));

    // Best way to create and insert
    SpatialViewDefinition.insertWithCamera(iModel, IModel.dictionaryId, "default", modelSelectorId, categorySelectorId, displayStyleId, iModel.projectExtents);
  });
});

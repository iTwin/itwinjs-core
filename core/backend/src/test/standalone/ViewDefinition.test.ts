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

function createNewModelAndCategory(rwIModel: IModelDb, parent?: Id64String) {
  const modelId = IModelTestUtils.createAndInsertPhysicalPartition(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), parent);
  const modelId2 = IModelTestUtils.createAndInsertPhysicalPartition(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "2PhysicalModel"), parent);
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);

  const spatialCategoryId = category.insert();
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  return { modelId, modelId2, spatialCategoryId };
}

// cspell:disable

let vs1: ViewStore.ViewDb;

describe("ViewDefinition", () => {
  let iModel: StandaloneDb;
  before(() => {
    iModel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("ViewDefinition", "ViewDefinition.bim"), {
      rootSubject: { name: "ViewDefinition tests", description: "ViewDefinition tests" },
      client: "ViewDefinition",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    const dbName = join(__dirname, "output", "viewDefTest.db");
    ViewStore.ViewDb.createNewDb(dbName);
    vs1 = new ViewStore.ViewDb();
    vs1.openDb(dbName, OpenMode.ReadWrite);
  });

  after(() => {
    iModel.abandonChanges();
    iModel.close();
    vs1.closeDb(true);
  });

  it.only("SpatialViewDefinition", async () => {
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

    const guidMap = iModel.elements;
    const ms1 = iModel.elements.getElement<ModelSelector>(modelSelectorId);
    const ms1Row = await vs1.addModelSelector({ elements: guidMap, name: ms1.code.value, models: ms1.models });
    expect(ms1Row).equal("@1");
    const ms1out = vs1.loadModelSelector({ elements: guidMap, id: ms1Row });
    expect(ms1out.classFullName).equal("BisCore:ModelSelector");
    expect(ms1out.models.length).equal(2);
    expect(ms1out.models[0]).equal(modelId);
    expect(ms1out.models[1]).equal(modelId2);

    const cs1 = iModel.elements.getElement<CategorySelector>(categorySelectorId);
    const cs1Row = await vs1.addCategorySelector({ elements: guidMap, name: cs1.code.value, categories: cs1.categories });
    expect(cs1Row).equal("@1");
    const cs1out = vs1.loadCategorySelector({ elements: guidMap, id: cs1Row });
    expect(cs1out.classFullName).equal("BisCore:CategorySelector");
    expect(cs1out.categories.length).equal(1);
    expect(cs1out.categories[0]).equal(spatialCategoryId);

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

    styles.excludedElements = CompressedId64Set.compressArray(["0x8", "0x12", "0x22"]);
    styles.scheduleScript = [{
      modelId: "0x21",
      realityModelUrl: "altavista.com",
      elementTimelines: [{
        batchId: 64,
        elementIds: CompressedId64Set.compressArray(["0x1a", "0x1d"]),
      }, {
        batchId: 65,
        elementIds: CompressedId64Set.compressArray(["0x2a", "0x2b", "0x2d", "0x2e"]),
      }],
    }];

    const guids: GuidString[] = [];
    const ids1: Id64String[] = [];
    const id1Mapper: IModelDb.GuidMapper = {
      getFederationGuidFromId(id: Id64String): GuidString | undefined {
        const index = ids1.indexOf(id);
        if (index >= 0)
          return guids[index];
        return undefined;
      },
      getIdFromFederationGuid(guid?: GuidString): Id64String | undefined {
        const index = guids.indexOf(guid!);
        if (index >= 0)
          return ids1[index];
        return undefined;
      },
    };
    for (let i = 0; i < 100; i++) {
      guids.push(Guid.createValue());
      ids1.push(Id64.fromLocalAndBriefcaseIds(i, 0));
    }

    const ds1Row = await vs1.addDisplayStyle({ elements: id1Mapper, name: "default", className: ds1.classFullName, settings: ds1.toJSON().jsonProperties.styles });
    expect(ds1Row).equal("@1");
    const ds1out = vs1.loadDisplayStyle({ elements: id1Mapper, id: ds1Row });
    expect(ds1out.classFullName).equal("BisCore:DisplayStyle3d");
    expect(ds1out.code.value).equal("default");
    expect(ds1out.jsonProperties?.styles).deep.equal(JSON.parse(JSON.stringify(styles)));

    const tl1Row = await vs1.addTimeline({ elements: id1Mapper, name: "TestRenderTimeline", timeline: styles.scheduleScript, owner: "owner2" });
    expect(tl1Row).equal("@1");
    const tl1out = vs1.loadTimeline({ elements: id1Mapper, id: tl1Row });
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
    const viewDefId = await vs1.addViewDefinition({ elements: id1Mapper, viewDefinition: viewDefProps });
    expect(viewDefId).equal("@1");
    const viewDefOut = vs1.loadViewDefinition({ elements: id1Mapper, id: viewDefId }) as SpatialViewDefinitionProps;
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
    let viewDefinitionId = iModel.elements.insertElement(viewDefinition.toJSON());
    assert.isNotEmpty(viewDefinitionId);
    assert.isTrue(Id64.isValid(viewDefinitionId));

    // Best way to create and insert
    viewDefinitionId = SpatialViewDefinition.insertWithCamera(iModel, IModel.dictionaryId, "default", modelSelectorId, categorySelectorId, displayStyleId, iModel.projectExtents);
    iModel.views.setDefaultViewId(viewDefinitionId);
  });

});

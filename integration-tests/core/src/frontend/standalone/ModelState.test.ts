/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { Code, IModel, ModelSelectorProps } from "@bentley/imodeljs-common";
import { DrawingModelState, GeometricModelState, IModelConnection, MockRender, ModelSelectorState, SheetModelState, SpatialModelState } from "@bentley/imodeljs-frontend";
import { assert, expect } from "chai";
import * as path from "path";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/");

describe("ModelState", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  before(async () => {
    MockRender.App.startup();
    imodel2 = await IModelConnection.openSnapshot(iModelLocation + "mirukuru.ibim");
    imodel = await IModelConnection.openSnapshot(iModelLocation + "CompatibilityTestSeed.bim");
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    if (imodel2) await imodel2.closeSnapshot();
    MockRender.App.shutdown();
  });

  it("ModelSelectors should hold models", () => {
    const props: ModelSelectorProps = {
      classFullName: ModelSelectorState.classFullName,
      model: Id64.fromLocalAndBriefcaseIds(1, 1),
      code: Code.createEmpty(),
      models: ["0x1"],
    };

    const selector = new ModelSelectorState(props, imodel);
    selector.addModels([Id64.fromLocalAndBriefcaseIds(2, 1), Id64.fromLocalAndBriefcaseIds(2, 1), Id64.fromLocalAndBriefcaseIds(2, 3)]);
    assert.equal(selector.models.size, 3);
    const out = selector.toJSON();
    assert.isArray(out.models);
    assert.equal(out.models.length, 3);
    out.iModel = imodel;
    const sel3 = selector.clone();
    assert.deepEqual(sel3, selector, "clone worked");
  });

  it("should be able to load ModelState", async () => {
    await imodel.models.load(["0x24", "0x28", "0x2c", "0x11", "0x34", "0x24", "nonsense"]);
    const models = imodel.models.loaded;
    assert.equal(models.size, 5);
    assert.instanceOf(models.get("0x24"), DrawingModelState);
    assert.instanceOf(models.get("0x28"), SheetModelState);
    assert.instanceOf(models.get("0x2c"), DrawingModelState);
    assert.instanceOf(models.get("0x11"), SpatialModelState);
    assert.instanceOf(models.get("0x34"), DrawingModelState);

    models.forEach((model) => {
      const geomModel = model as GeometricModelState;
      expect(geomModel.is3d).to.equal(model instanceof SpatialModelState);
      expect(geomModel.is2d).to.equal(!geomModel.is3d);
    });

    models.forEach((model) => assert.deepEqual(model.clone(), model, "clone of ModelState should work"));

    await imodel.models.load(["0x24", "0x28", "0x2c", "0x11", "0x34", "0x24", "nonsense"]);
    assert.equal(models.size, 5);

    const testDrawing = models.get("0x24") as DrawingModelState;
    let testSpatial = models.get("0x11") as SpatialModelState;

    let range = await testDrawing.queryModelRange();
    assert.isTrue(range.low.isAlmostEqual({ x: 0, y: 0, z: -1 }));
    assert.isTrue(range.high.isAlmostEqual({ x: 5, y: 5, z: 1 }));

    range = await testSpatial.queryModelRange();
    assert.isTrue(range.isNull);

    const modelProps = await imodel.models.queryProps({ from: SpatialModelState.classFullName });
    assert.isAtLeast(modelProps.length, 2);
    // check modelProps[0] against expected values
    assert.equal(modelProps[0].classFullName, "BisCore:PhysicalModel");
    assert.equal(modelProps[0].id, "0x11");
    assert.equal(modelProps[0].modeledElement.id, "0x11");
    assert.equal(modelProps[0].modeledElement.relClassName, "BisCore:ModelModelsElement");
    assert.equal(modelProps[0].name, "DefaultModel");
    assert.equal(modelProps[0].parentModel, IModel.repositoryModelId);
    assert.equal(modelProps[0].jsonProperties.formatter.fmtFlags.angMode, 1);
    assert.isNotTrue(modelProps[0].isPrivate);
    assert.isNotTrue(modelProps[0].isTemplate);
    // check modelProps[1] against expected values
    assert.equal(modelProps[1].classFullName, "BisCore:PhysicalModel");
    assert.equal(modelProps[1].id, "0x1c");
    assert.equal(modelProps[1].modeledElement.id, "0x1c");
    assert.equal(modelProps[1].modeledElement.relClassName, "BisCore:ModelModelsElement");
    assert.equal(modelProps[1].name, "Physical");
    assert.equal(modelProps[1].parentModel, IModel.repositoryModelId);
    assert.equal(modelProps[1].jsonProperties.formatter.fmtFlags.angMode, 1);
    assert.isNotTrue(modelProps[1].isPrivate);
    assert.isNotTrue(modelProps[1].isTemplate);

    let propsCount = 0;
    for await (const props of imodel.models.query({ from: "BisCore:DictionaryModel", wantPrivate: true, wantTemplate: true, limit: 1 })) {
      propsCount++;
      assert.equal(props.classFullName, "BisCore:DictionaryModel");
      assert.equal(props.id, "0x10");
      assert.equal(props.modeledElement.id, "0x10");
      assert.equal(props.modeledElement.relClassName, "BisCore:ModelModelsElement");
      assert.equal(props.name, "BisCore.DictionaryModel");
      assert.equal(props.parentModel, IModel.repositoryModelId);
      assert.isTrue(props.isPrivate);
      assert.isNotTrue(props.isTemplate);
    }
    assert.equal(propsCount, 1);

    await imodel2.models.load(["0x28", "0x1c"]);
    assert.equal(imodel2.models.loaded.size, 2);
    const scalableMesh = imodel2.models.getLoaded("0x28");
    assert.instanceOf(scalableMesh, SpatialModelState, "ScalableMeshModel should be SpatialModel");
    assert.equal(scalableMesh!.classFullName, "ScalableMesh:ScalableMeshModel");

    testSpatial = imodel2.models.getLoaded("0x1c") as SpatialModelState;
    range = await testSpatial.queryModelRange();
    assert.isTrue(range.low.isAlmostEqual({ x: 288874.1174466432, y: 3803761.1888925503, z: -0.0005 }));
    assert.isTrue(range.high.isAlmostEqual({ x: 289160.8417204395, y: 3803959.118535, z: 0.0005 }));
  });

  it("view thumbnails", async () => {
    const thumbnail = await imodel2.views.getThumbnail("0x24");
    assert.equal(thumbnail.format, "jpeg");
    assert.equal(thumbnail.height, 768);
    assert.equal(thumbnail.width, 768);
    assert.equal(thumbnail.image.length, 18062);
    assert.equal(thumbnail.image[3], 224);
    assert.equal(thumbnail.image[18061], 217);

    try {
      await imodel2.views.getThumbnail("0x25");
    } catch (_err) {
      return;
    } // thumbnail doesn't exist
    assert.fail("getThumbnail should not return");

    // thumbnail.format = "png";
    // thumbnail.height = 100;
    // thumbnail.width = 200;
    // thumbnail.image = new Uint8Array(300);
    // thumbnail.image.fill(33);

    // await imodel2.views.saveThumbnail("0x24", thumbnail);
    // const thumbnail2 = await imodel2.views.getThumbnail("0x24");
    // assert.equal(thumbnail2.format, "png");
    // assert.equal(thumbnail2.height, 100);
    // assert.equal(thumbnail2.width, 200);
    // assert.equal(thumbnail2.image.length, 300);
    // assert.equal(thumbnail2.image[3], 33);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64, ProcessDetector } from "@itwin/core-bentley";
import { Code, IModel, ModelSelectorProps } from "@itwin/core-common";
import {
  DrawingModelState, GeometricModelState, IModelConnection, ModelSelectorState, SheetModelState, SpatialModelState,
} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("ModelState", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  let imodel3: IModelConnection;
  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel2 = await TestSnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
    imodel = await TestSnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
    imodel3 = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });

  afterAll(async () => {
    await imodel?.close();
    await imodel2?.close();
    await imodel3?.close();
    await TestUtility.shutdownFrontend();
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
    expect(selector.models.size).toBe(3);
    const out = selector.toJSON();
    expect(out.models).toBeInstanceOf(Array);
    expect(out.models.length).toBe(3);
    (out as any).iModel = imodel;
    const sel3 = selector.clone();
    expect(sel3, "clone worked").toEqual(selector);
  });

  it("should be able to load ModelState", async () => {
    await imodel.models.load(["0x24", "0x28", "0x2c", "0x11", "0x34", "0x24", "nonsense"]);
    const models = imodel.models.loaded;
    expect(models.size).toBe(5);
    expect(models.get("0x24")).toBeInstanceOf(DrawingModelState);
    expect(models.get("0x28")).toBeInstanceOf(SheetModelState);
    expect(models.get("0x2c")).toBeInstanceOf(DrawingModelState);
    expect(models.get("0x11")).toBeInstanceOf(SpatialModelState);
    expect(models.get("0x34")).toBeInstanceOf(DrawingModelState);

    models.forEach((model) => {
      const geomModel = model as GeometricModelState;
      expect(geomModel.is3d).toBe(model instanceof SpatialModelState);
      expect(geomModel.is2d).toBe(!geomModel.is3d);
    });

    models.forEach((model) => expect(model.clone(), "clone of ModelState should work").toEqual(model));

    await imodel.models.load(["0x24", "0x28", "0x2c", "0x11", "0x34", "0x24", "nonsense"]);
    expect(models.size).toBe(5);

    const testDrawing = models.get("0x24") as DrawingModelState;
    let testSpatial = models.get("0x11") as SpatialModelState;

    let range = await testDrawing.queryModelRange();
    expect(range.low.isAlmostEqual({ x: 0, y: 0, z: -1 })).toBe(true);
    expect(range.high.isAlmostEqual({ x: 5, y: 5, z: 1 })).toBe(true);

    range = await testSpatial.queryModelRange();
    expect(range.isNull).toBe(true);

    const modelProps = await imodel.models.queryProps({ from: SpatialModelState.classFullName });
    expect(modelProps.length).toBeGreaterThanOrEqual(2);
    // check modelProps[0] against expected values
    expect(modelProps[0].classFullName).toBe("BisCore:PhysicalModel");
    expect(modelProps[0].id).toBe("0x11");
    expect(modelProps[0].modeledElement.id).toBe("0x11");
    expect(modelProps[0].modeledElement.relClassName).toBe("BisCore:ModelModelsElement");
    expect(modelProps[0].name).toBe("DefaultModel");
    expect(modelProps[0].parentModel).toBe(IModel.repositoryModelId);
    expect(modelProps[0].jsonProperties.formatter.fmtFlags.angMode).toBe(1);
    expect(modelProps[0].isPrivate).not.toBe(true);
    expect(modelProps[0].isTemplate).not.toBe(true);
    // check modelProps[1] against expected values
    expect(modelProps[1].classFullName).toBe("BisCore:PhysicalModel");
    expect(modelProps[1].id).toBe("0x1c");
    expect(modelProps[1].modeledElement.id).toBe("0x1c");
    expect(modelProps[1].modeledElement.relClassName).toBe("BisCore:ModelModelsElement");
    expect(modelProps[1].name).toBe("Physical");
    expect(modelProps[1].parentModel).toBe(IModel.repositoryModelId);
    expect(modelProps[1].jsonProperties.formatter.fmtFlags.angMode).toBe(1);
    expect(modelProps[1].isPrivate).not.toBe(true);
    expect(modelProps[1].isTemplate).not.toBe(true);

    let propsCount = 0;
    for await (const props of imodel.models.query({ from: "BisCore:DictionaryModel", wantPrivate: true, wantTemplate: true, limit: 1 })) {
      propsCount++;
      expect(props.classFullName).toBe("BisCore:DictionaryModel");
      expect(props.id).toBe("0x10");
      expect(props.modeledElement.id).toBe("0x10");
      expect(props.modeledElement.relClassName).toBe("BisCore:ModelModelsElement");
      expect(props.name).toBe("BisCore.DictionaryModel");
      expect(props.parentModel).toBe(IModel.repositoryModelId);
      expect(props.isPrivate).toBe(true);
      expect(props.isTemplate).not.toBe(true);
    }
    expect(propsCount).toBe(1);

    await imodel2.models.load(["0x28", "0x1c"]);
    expect(imodel2.models.loaded.size).toBe(2);
    const scalableMesh = imodel2.models.getLoaded("0x28");
    expect(scalableMesh, "ScalableMeshModel should be SpatialModel").toBeInstanceOf(SpatialModelState);
    expect(scalableMesh!.classFullName).toBe("ScalableMesh:ScalableMeshModel");

    testSpatial = imodel2.models.getLoaded("0x1c") as SpatialModelState;
    range = await testSpatial.queryModelRange();
    expect(range.low.isAlmostEqual({ x: 288874.09375, y: 3803760.75, z: -0.0005 })).toBe(true);
    expect(range.high.isAlmostEqual({ x: 289160.84375, y: 3803959.5, z: 0.0005 })).toBe(true);
  });
});

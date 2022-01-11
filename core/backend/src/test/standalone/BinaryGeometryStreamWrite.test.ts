/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import {
  Code,
  ElementGeometry,
  ElementGeometryBuilderParams,
  ElementGeometryUpdate,
  GeometricElementProps,
  GeometryPrimitive,
  GeometryStreamIterator,
  IModel, PhysicalElementProps, SubCategoryAppearance,
} from "@itwin/core-common";
import { LineSegment3d, LineString3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  DictionaryModel, IModelDb, PhysicalObject, SpatialCategory,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

export function createNewModelAndCategory(rwIModel: IModelDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = rwIModel.elements.insertElement(category);
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  // const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

describe.only("BinaryGeometryStreamWriteTest", () => {
  it.only("should insert element with binary geometry stream", () => {
    const imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "bingeom.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const { modelId, spatialCategoryId } = createNewModelAndCategory(imodel);

    // const geomBuilder = new GeometryStreamBuilder();
    // geomBuilder.appendGeometry(Box.createDgnBox(Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, 2), 2, 2, 2, 2, true)!);

    const lspts: Point3d[] = [];
    lspts.push(Point3d.create(5, 10, 0));
    lspts.push(Point3d.create(10, 10, 0));

    const elementGeometryBuilderParams: ElementGeometryBuilderParams = {
      entryArray: [],
    };
    const entryLN = ElementGeometry.fromGeometryQuery(LineSegment3d.create(lspts[0], lspts[1]));
    assert.isTrue(entryLN !== undefined);
    elementGeometryBuilderParams.entryArray.push(entryLN!);

    const elemProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      // geom: geomBuilder.geometryStream,
      elementGeometryBuilderParams,
    };

    const spatialElementId = imodel.elements.insertElement(elemProps);

    const persistentProps = imodel.elements.getElementProps<GeometricElementProps>({ id: spatialElementId, wantGeometry: true });
    assert.isDefined(persistentProps.geom);
    assert.isTrue(persistentProps.placement !== undefined);
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.origin), Point3d.create(0, 0, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.low), Point3d.create(5, 10, 0));
    assert.deepEqual(Point3d.fromJSON(persistentProps.placement!.bbox!.high), Point3d.create(10, 10, 0));

    const itLocal = new GeometryStreamIterator(persistentProps.geom!, persistentProps.category);
    for (const entry of itLocal) {
      assert.equal(entry.primitive.type, "geometryQuery");
      const geometry = (entry.primitive as GeometryPrimitive).geometry;
      assert.isTrue(geometry instanceof LineString3d);
      const ls: LineString3d = geometry as LineString3d;
      assert.deepEqual(ls.points, lspts);
    }
  });
});

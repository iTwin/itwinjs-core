/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { RenderGraphic, IndexedPrimitiveParamsFeatures, PolylineParamVertex, PolylineParam, MeshArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { FeatureIndexType, FeatureIndex, ColorByName, QParams3d, QPoint3dList } from "@bentley/imodeljs-common";
import * as path from "path";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";

export class FakeGraphic extends RenderGraphic {
  constructor(iModel: IModelConnection) { super(iModel); }
}

function withinTol(x: number, y: number): boolean {
  return Math.abs(x - y) < 0.0000000000001;
}

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("RenderGraphic", () => {
  let iModel: IModelConnection;

  before(async () => {
    iModel = await IModelConnection.openStandalone(iModelLocation);
  });

  after(async () => {
    if (iModel) await iModel.closeStandalone();
  });

  it("RenderGraphic works as expected", () => {
    const g = new FakeGraphic(iModel);
    assert.isTrue(g.iModel instanceof IModelConnection, "can access IModelConnection");
  });

  it("IndexedPrimitiveParamsFeatures works as expected", () => {
    // Test constructor with no params
    let ippFeatures: IndexedPrimitiveParamsFeatures = new IndexedPrimitiveParamsFeatures();
    assert.isTrue(FeatureIndexType.Empty === ippFeatures.type, "IndexedPrimitiveParamsFeatures constructed with no parameters should have type kEmpty");
    assert.isTrue(ippFeatures.isEmpty(), "IndexedPrimitiveParamsFeatures constructed with no parameters should return true for isEmpty()");
    assert.isFalse(ippFeatures.isUniform(), "IndexedPrimitiveParamsFeatures constructed with no parameters should return false for isUniform()");
    assert.isTrue(undefined === ippFeatures.nonUniform, "nonUniform of empty IndexedPrimitiveParamsFeatures should be undefined");
    let fIndex: FeatureIndex = ippFeatures.toFeatureIndex();
    assert.isTrue(FeatureIndexType.Empty === fIndex.type, "FeatureIndex created with toFeatureIndex() of empty IndexedPrimitiveParamsFeatures should have type kEmpty");
    assert.isTrue(fIndex.isEmpty(), "Empty IndexedPrimitiveParamsFeatures should return empty FeatureIndex from toFeatureIndex()");
    assert.isFalse(fIndex.isUniform(), "Empty IndexedPrimitiveParamsFeatures should not return uniform FeatureIndex from toFeatureIndex()");
    assert.isTrue(undefined === fIndex.featureIDs, "featureIDs of FeatureIndex created with toFeatureIndex() of empty IndexedPrimitiveParamsFeatures should be undefined");
    // Test using constructor with empty FeatureIndex
    fIndex.reset();
    ippFeatures = new IndexedPrimitiveParamsFeatures(fIndex);
    assert.isTrue(FeatureIndexType.Empty === ippFeatures.type, "IndexedPrimitiveParamsFeatures constructed with empty FeatureIndex should have type kEmpty");
    assert.isTrue(ippFeatures.isEmpty(), "IndexedPrimitiveParamsFeatures constructed with empty FeatureIndex should return true for isEmpty()");
    assert.isFalse(ippFeatures.isUniform(), "IndexedPrimitiveParamsFeatures constructed with empty FeatureIndex should return false for isUniform()");
    assert.isTrue(undefined === ippFeatures.nonUniform, "nonUniform of empty IndexedPrimitiveParamsFeatures should be undefined");
    fIndex = ippFeatures.toFeatureIndex();
    assert.isTrue(FeatureIndexType.Empty === fIndex.type, "FeatureIndex created with toFeatureIndex() of empty IndexedPrimitiveParamsFeatures should have type kEmpty");
    assert.isTrue(fIndex.isEmpty(), "Empty IndexedPrimitiveParamsFeatures should return empty FeatureIndex from toFeatureIndex()");
    assert.isFalse(fIndex.isUniform(), "Empty IndexedPrimitiveParamsFeatures should not return uniform FeatureIndex from toFeatureIndex()");
    assert.isTrue(undefined === fIndex.featureIDs, "featureIDs of FeatureIndex created with toFeatureIndex() of empty IndexedPrimitiveParamsFeatures should be undefined");
    // Test using constructor with uniform FeatureIndex
    fIndex.reset();
    fIndex.type = FeatureIndexType.Uniform;
    fIndex.featureID = 42;
    ippFeatures = new IndexedPrimitiveParamsFeatures(fIndex);
    assert.isTrue(FeatureIndexType.Uniform === ippFeatures.type, "IndexedPrimitiveParamsFeatures constructed with uniform FeatureIndex should have type kUniform");
    assert.isFalse(ippFeatures.isEmpty(), "IndexedPrimitiveParamsFeatures constructed with uniform FeatureIndex should return false for isEmpty()");
    assert.isTrue(ippFeatures.isUniform(), "IndexedPrimitiveParamsFeatures constructed with uniform FeatureIndex should return true for isUniform()");
    assert.isTrue(undefined === ippFeatures.nonUniform, "nonUniform of uniform IndexedPrimitiveParamsFeatures should be undefined");
    fIndex = ippFeatures.toFeatureIndex();
    assert.isTrue(FeatureIndexType.Uniform === fIndex.type, "FeatureIndex created with toFeatureIndex() of uniform IndexedPrimitiveParamsFeatures should have type kUniform");
    assert.isFalse(fIndex.isEmpty(), "Uniform IndexedPrimitiveParamsFeatures should not return empty FeatureIndex from toFeatureIndex()");
    assert.isTrue(fIndex.isUniform(), "Uniform IndexedPrimitiveParamsFeatures should not return uniform FeatureIndex from toFeatureIndex()");
    assert.isTrue(undefined === fIndex.featureIDs, "featureIDs of FeatureIndex created with toFeatureIndex() of uniform IndexedPrimitiveParamsFeatures should be undefined");
    // Test using constructor with nonUniform FeatureIndex
    const numVerts = 10;
    const nonUniformData: number[] = [];
    for (let i = 0; i < numVerts; ++i) {
      nonUniformData[i] = i + 1;
    }
    fIndex.reset();
    fIndex.type = FeatureIndexType.NonUniform;
    fIndex.featureIDs = new Uint32Array(nonUniformData);
    ippFeatures = new IndexedPrimitiveParamsFeatures(fIndex, numVerts);
    assert.isTrue(FeatureIndexType.NonUniform === ippFeatures.type, "IndexedPrimitiveParamsFeatures constructed with nonUniform FeatureIndex should have type kNonUniform");
    assert.isFalse(ippFeatures.isEmpty(), "IndexedPrimitiveParamsFeatures constructed with nonUniform FeatureIndex should return false for isEmpty()");
    assert.isFalse(ippFeatures.isUniform(), "IndexedPrimitiveParamsFeatures constructed with nonUniform FeatureIndex should return true for isUniform()");
    assert.isTrue(undefined !== ippFeatures.nonUniform, "nonUniform of nonUniform IndexedPrimitiveParamsFeatures should not be undefined");
    if (undefined !== ippFeatures.nonUniform) {
      for (let i = 0; i < numVerts; ++i) {
        assert.isTrue(ippFeatures.nonUniform[i] === fIndex.featureIDs[i], "nonUniform[" + i + "] should be equal to fIndex.featureIDs[" + i);
      }
    }
    fIndex = ippFeatures.toFeatureIndex();
    assert.isTrue(FeatureIndexType.NonUniform === fIndex.type, "FeatureIndex created with toFeatureIndex() of nonUniform IndexedPrimitiveParamsFeatures should have type kNonUniform");
    assert.isFalse(fIndex.isEmpty(), "nonUniform IndexedPrimitiveParamsFeatures should not return empty FeatureIndex from toFeatureIndex()");
    assert.isFalse(fIndex.isUniform(), "nonUniform IndexedPrimitiveParamsFeatures should not return uniform FeatureIndex from toFeatureIndex()");
    assert.isTrue(undefined !== fIndex.featureIDs, "featureIDs of FeatureIndex created with toFeatureIndex() of uniform IndexedPrimitiveParamsFeatures should not be undefined");
    if (undefined !== ippFeatures.nonUniform && undefined !== fIndex.featureIDs) {
      for (let i = 0; i < numVerts; ++i) {
        assert.isTrue(fIndex.featureIDs[i] === ippFeatures.nonUniform[i], "fIndex.featureIDs[" + i + "] should be equal to nonUniform[" + i);
      }
    }
  });
  it("PolylineParamVertex works as expected", () => {
    const points: Point3d[] = [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(1, 2, 0)];
    let ppv = new PolylineParamVertex(true, true, points[1], points[0], points[2], 0xffffff, 0, 1.0);
    let dot = ppv.DotProduct();
    assert.isTrue(0.0 === dot, "DotProduct of vertex at point 1 should be 0");

    ppv = new PolylineParamVertex(true, true, points[2], points[1], points[0], 0xffffff, 0, 1.0);
    dot = ppv.DotProduct();
    assert.isTrue(withinTol(0.7071067811865475, dot), "DotProduct of vertex at point 2 should be 0.7071067811865475 but was " + dot);

    ppv = new PolylineParamVertex(true, true, points[2], points[1], points[3], 0xffffff, 0, 1.0);
    dot = ppv.DotProduct();
    assert.isTrue(withinTol(-1.0, dot), "DotProduct of vertex at point 2 should be -1.0 but was " + dot);

    let p1: PolylineParam = ppv.GetParam(true, true, true, true);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(true, true, true, false);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(true, false, true, true);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(true, false, true, false);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(false, true, true, true);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(false, true, true, false);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(false, false, true, true);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");
    p1 = ppv.GetParam(false, false, true, false);
    assert.isTrue(PolylineParam.kJointBase === p1, "GetParam should always return kJointBase if joint is true");

    p1 = ppv.GetParam(false, false, false, false);
    assert.isTrue(PolylineParam.kSquare === p1,
      "GetParam(false,false,false,false) should return kSquare if isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, false);
    assert.isTrue(PolylineParam.kSquare + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,false) should return kSquare + PolylineParam.kNegatePerp if isSegmentStart and isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt if isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + PolylineParam.kNegatePerp if isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt if isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + PolylineParam.kNegatePerp if isSegmentStart and isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly if isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + PolylineParam.kNegatePerp if isSegmentStart and isPolylineStartOrEnd");

    ppv = new PolylineParamVertex(true, false, points[2], points[1], points[3], 0xffffff, 0, 1.0);

    p1 = ppv.GetParam(false, false, false, false);
    assert.isTrue(PolylineParam.kMiter === p1,
      "GetParam(false,false,false,false) should return kMiter if isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, false);
    assert.isTrue(PolylineParam.kMiter + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,false) should return kMiter + PolylineParam.kNegatePerp if isSegmentStart and !isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt if isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + PolylineParam.kNegatePerp if isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt if isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + PolylineParam.kNegatePerp if isSegmentStart and !isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly if isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + PolylineParam.kNegatePerp if isSegmentStart and !isPolylineStartOrEnd");

    ppv = new PolylineParamVertex(false, true, points[2], points[1], points[3], 0xffffff, 0, 1.0);

    p1 = ppv.GetParam(false, false, false, false);
    assert.isTrue(PolylineParam.kSquare + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,false) should return kSquare + kNegateAlong if !isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, false);
    assert.isTrue(PolylineParam.kSquare + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,false) should return kSquare + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and isPolylineStartOrEnd");

    p1 = ppv.GetParam(false, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong if !isSegmentStart and isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and isPolylineStartOrEnd");

    ppv = new PolylineParamVertex(false, false, points[2], points[1], points[3], 0xffffff, 0, 1.0);

    p1 = ppv.GetParam(false, false, false, false);
    assert.isTrue(PolylineParam.kMiter + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,false) should return kMiter + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, false);
    assert.isTrue(PolylineParam.kMiter + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,false) should return kMiter + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, false, false, true);

    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, false);

    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");

    ppv = new PolylineParamVertex(false, false, points[2], points[1], points[3], 0xffffff, 0, 1.0);

    p1 = ppv.GetParam(false, false, false, false);
    assert.isTrue(PolylineParam.kMiter + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,false) should return kMiter + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, false);
    assert.isTrue(PolylineParam.kMiter + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,false) should return kMiter + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, false, false, true);

    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, false, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,false,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, true);
    assert.isTrue(PolylineParam.kNoneAdjWt + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,true) should return kNoneAdjWt + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(false, true, false, false);

    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong if !isSegmentStart and !isPolylineStartOrEnd");
    p1 = ppv.GetParam(true, true, false, false);
    assert.isTrue(PolylineParam.kMiterInsideOnly + PolylineParam.kNegateAlong + PolylineParam.kNegatePerp === p1,
      "GetParam(false,true,false,false) should return kMiterInsideOnly + kNegateAlong + PolylineParam.kNegatePerp if !isSegmentStart and !isPolylineStartOrEnd");
  });
});

describe("createTriMesh", () => {
  let imodel: IModelConnection;
  before(async () => {
    imodel = await IModelConnection.openStandalone(iModelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("should create a simple mesh graphic", () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const args = new MeshArgs();

    const points = [ new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0) ];
    args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
    for (const point of points)
      args.points.add(point);

    args.vertIndices = [ 0, 1, 2 ];
    args.colors.initUniform(ColorByName.tan);

    const graphic = IModelApp.renderSystem.createTriMesh(args, imodel);
    expect(graphic).not.to.be.undefined;
  });
});

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { ColorByName, QParams3d, QPoint3dList } from "@bentley/imodeljs-common";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { RenderGraphic, PolylineParamVertex, PolylineParam, MeshArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";

export class FakeGraphic extends RenderGraphic {
  public dispose(): void { }
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

    const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0)];
    args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
    for (const point of points)
      args.points.add(point);

    args.vertIndices = [0, 1, 2];
    args.colors.initUniform(ColorByName.tan);

    const graphic = IModelApp.renderSystem.createTriMesh(args);
    expect(graphic).not.to.be.undefined;
  });
});

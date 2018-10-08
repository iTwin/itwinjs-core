/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import {
  IModelConnection,
  // Viewport,
  SpatialViewState,
  StandardViewId,
} from "@bentley/imodeljs-frontend";
import * as path from "path";
import {
  Geometry,
  DisplayParams,
  StrokesPrimitiveList,
  PolyfacePrimitiveList,
  PolyfacePrimitive,
  GeometryAccumulator,
  GeometryOptions,
  RenderGraphic,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { Branch, System } from "@bentley/imodeljs-frontend/lib/webgl";
import { Transform, Range3d, StrokeOptions, LineString3d, Path, Point3d, Loop } from "@bentley/geometry-core";
import { GraphicParams } from "@bentley/imodeljs-common/lib/Render";
import { ColorDef } from "@bentley/imodeljs-common";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";
import { FakeDisplayParams } from "./DisplayParams.test";
// import { FakeGraphic } from "./Graphic.test";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

export class FakeGeometry extends Geometry {
  public constructor() { super(Transform.createIdentity(), Range3d.createNull(), new FakeDisplayParams()); }
  protected _getPolyfaces(_facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined { return undefined; }
  protected _getStrokes(_facetOptions: StrokeOptions): StrokesPrimitiveList | undefined { return undefined; }
}

/**
 * GEOMETRY ACCUMULATOR TESTS
 * tests all paths for each public method
 */
describe("GeometryAccumulator tests", () => {
  let iModel: IModelConnection;
  let spatialView: SpatialViewState;
  let accum: GeometryAccumulator;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert(null !== canvas);
  canvas!.width = canvas!.height = 1000;
  document.body.appendChild(canvas!);

  before(async () => {   // Create a ViewState to load into a Viewport
    iModel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await iModel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (iModel) await iModel.closeStandalone();
  });

  it("addPath works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));

    const line = LineString3d.create(points);
    const pth = Path.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    const displayParams: DisplayParams = DisplayParams.createForLinear(gfParams);

    expect(accum.geometries.isEmpty).to.be.true;
    expect(accum.addPath(pth, displayParams, Transform.createIdentity(), false)).to.be.true;
    expect(accum.geometries.length).to.equal(1);

    // ###TODO test case where addPath returns false
  });

  it("addLoop works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    expect(accum.geometries.isEmpty).to.be.true;
    expect(accum.addLoop(loop, displayParams, Transform.createIdentity(), false)).to.be.true;
    expect(accum.geometries.length).to.equal(1);

    // ###TODO test case where addLoop returns false
  });

  it("addPolyface works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).to.not.be.null;

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    assert(pfPrimList !== undefined);
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).to.be.greaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).to.equal(points.length);

    expect(accum.geometries.isEmpty).to.be.true;
    expect(accum.addPolyface(pfPrim.indexedPolyface, displayParams, Transform.createIdentity())).to.be.true;
    expect(accum.geometries.length).to.equal(1);

    // ###TODO test case where addPolyface returns false
  });

  it("addGeometry works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    expect(accum.geometries.isEmpty).to.be.true;
    expect(accum.isEmpty).to.be.true;
    const fkGeom = new FakeGeometry();
    expect(accum.addGeometry(fkGeom)).to.be.true;
    expect(accum.geometries.length).to.equal(1);
  });

  it("clear works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    expect(accum.isEmpty).to.be.true;
    accum.addGeometry(new FakeGeometry());
    expect(accum.isEmpty).to.be.false;
    accum.clear();
    expect(accum.isEmpty).to.be.true;
  });

  it("toMeshBuilderMap works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.setLineColor(ColorDef.white);
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    expect(accum.geometries.length).to.equal(2);
    const map = accum.toMeshBuilderMap(new GeometryOptions(), 0.22);
    expect(map.length).to.equal(2);
  });

  it("toMeshes works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.setLineColor(ColorDef.white);
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    expect(accum.geometries.length).to.equal(2);
    const meshes = accum.toMeshes(new GeometryOptions(), 0.22);
    expect(meshes.length).to.equal(2);
  });

  it("saveToGraphicList works as expected", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    accum = new GeometryAccumulator(iModel, System.instance);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.setLineColor(ColorDef.white);
    gfParams.setFillColor(ColorDef.black); // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.setLineColor(ColorDef.white);
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    const graphics = new Array<RenderGraphic>();
    accum.saveToGraphicList(graphics, new GeometryOptions(), 0.22);
    expect(graphics.length).to.equal(1);
    const graphic = graphics[0];
    expect(graphic instanceof Branch).to.be.true;
    expect((graphic as Branch).branch.entries.length).to.equal(2);
  });
});

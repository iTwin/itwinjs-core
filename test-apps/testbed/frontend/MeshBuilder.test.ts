/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { IModelConnection, SpatialViewState, StandardViewId, ScreenViewport } from "@bentley/imodeljs-frontend";
import { GraphicParams, ColorDef } from "@bentley/imodeljs-common";
import {
  Range3d,
  Point3d,
  Arc3d,
  LineString3d,
  Loop,
  Transform,
} from "@bentley/geometry-core";
import * as path from "path";
import {
  PolyfacePrimitive,
  PolyfacePrimitiveList,
  DisplayParams,
  Geometry,
  MeshBuilder,
  Mesh,
  ToleranceRatio,
  System,
  GraphicType,
  PrimitiveBuilder,
  StrokesPrimitiveList,
  StrokesPrimitivePointLists,
  Triangle,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { FakeDisplayParams } from "./DisplayParams.test";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

/**
 * MESH BUILDER TESTS
 * tests all paths for each public method
 */
describe("Mesh Builder Tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = document.createElement("div") as HTMLDivElement;
  assert(null !== viewDiv);
  viewDiv!.style.width = viewDiv!.style.height = "1000px";
  document.body.appendChild(viewDiv!);

  before(async () => {   // Create a ViewState to load into a Viewport
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("constructor", () => {
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.currentPolyface).to.be.undefined;
    expect(mb.mesh.displayParams).to.equal(displayParams);
    expect(mb.mesh.type).to.equal(type);
    expect(mb.mesh.is2d).to.equal(is2d);
    expect(mb.mesh.isPlanar).to.equal(isPlanar);
    expect(mb.tolerance).to.equal(tolerance);
    expect(mb.areaTolerance).to.equal(areaTolerance);
  });

  it("addStrokePointLists", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    const viewport = ScreenViewport.create(viewDiv, spatialView);
    const primBuilder = new PrimitiveBuilder(System.instance, GraphicType.Scene, viewport);

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const arc = Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC);
    assert(arc !== undefined && arc instanceof Arc3d);
    if (arc === undefined || !(arc instanceof Arc3d))
      return;

    primBuilder.addArc(arc, false, false);

    assert(!(primBuilder.accum.geometries.isEmpty));

    const arcGeom: Geometry | undefined = primBuilder.accum.geometries.first;
    assert(arcGeom !== undefined);
    if (arcGeom === undefined)
      return;

    const strokesPrimList: StrokesPrimitiveList | undefined = arcGeom.getStrokes(0.22);

    assert(strokesPrimList !== undefined);
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).to.be.greaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;

    const fillColor = ColorDef.white.tbgr;

    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Polyline;
    const range = Range3d.createArray([new Point3d(), new Point3d(10000, 10000, 10000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // calls addPolyline for each stroke points list in strokes
    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addStrokePointLists(strksPrims, false, fillColor);
    expect(mb.mesh.polylines!.length).to.equal(strksPrims.length);
    const lengthA = mb.mesh.points.length;
    const lengthB = strksPrims[0].points.length;
    expect(lengthA).to.be.lte(lengthB);
    expect(mb.mesh.points.length).to.be.greaterThan(0);
    // calls addPointString for each stroke points list in strokes
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.mesh.polylines!.length).to.equal(0);
    expect(mb.mesh.points.length).to.equal(0);
    mb.addStrokePointLists(strksPrims, true, fillColor);
    expect(mb.mesh.polylines!.length).to.equal(strksPrims.length);
    expect(mb.mesh.points.length).to.equal(strksPrims[0].points.length);
  });

  it("addFromPolyface", () => {
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

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyface(pfPrim.indexedPolyface, { includeParams, fillColor });

    expect(mb.triangleSet.length).to.equal(2);
  });

  it("addFromPolyfaceVisitor", () => {

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

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const visitor = pfPrim.indexedPolyface.createVisitor();
    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyfaceVisitor(visitor, { includeParams, fillColor });

    expect(mb.triangleSet.length).to.equal(1);
  });

  it("createTriangleVertices", () => {
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
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const visitor = pfPrim.indexedPolyface.createVisitor();
    const fillColor = ColorDef.white.tbgr;
    const triangleCount = visitor.pointCount - 2;
    const haveParam = includeParams && visitor.paramCount > 0;
    const triangleIndex = 0;
    const vertices = mb.createTriangleVertices(triangleIndex, visitor, { fillColor, includeParams, haveParam, triangleCount });

    expect(vertices!.length).to.equal(3);
  });

  it("createTriangle", () => {
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
    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    if (pfPrimList === undefined)
      return;
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const visitor = pfPrim.indexedPolyface.createVisitor();
    const fillColor = ColorDef.white.tbgr;
    const triangleCount = visitor.pointCount - 2;
    const haveParam = includeParams && visitor.paramCount > 0;
    const triangleIndex = 0;
    const triangle = mb.createTriangleVertices(triangleIndex, visitor, { fillColor, includeParams, haveParam, triangleCount });

    expect(triangle).to.not.be.undefined;
  });

  it("addPolyline", () => {
    const displayParams = new FakeDisplayParams();
    let type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    let points = [new Point3d(), new Point3d(100, 100, 100), new Point3d(200, 200, 200)];
    const fillColor = ColorDef.white.tbgr;

    // throws assertion error if type is mesh (should be point or polyline)
    expect(() => mb.addPolyline(points, fillColor, 0)).to.throw("Assert: Programmer Error");

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = Mesh.PrimitiveType.Polyline;
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPolyline(points, fillColor, 0);
    expect(mb.mesh.polylines!.length).to.equal(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPolyline(points, fillColor, 0);
    expect(mb.mesh.polylines!.length).to.equal(0);
  });

  it("addPointString", () => {
    const displayParams = new FakeDisplayParams();
    let type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    let points = [new Point3d(), new Point3d(100, 100, 100), new Point3d(200, 200, 200)];
    const fillColor = ColorDef.white.tbgr;

    // throws assertion error if type is mesh (should be point or polyline)
    expect(() => mb.addPointString(points, fillColor, 0)).to.throw("Assert: Programmer Error");

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = Mesh.PrimitiveType.Polyline;
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPointString(points, fillColor, 0);
    expect(mb.mesh.polylines!.length).to.equal(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPointString(points, fillColor, 0);
    expect(mb.mesh.polylines!.length).to.equal(0);
  });

  // it("beginPolyface", () => {

  // });

  // it("endPolyface", () => {

  // });

  // it("addVertex", () => {

  // });

  it("addTriangle", () => {
    const triangle = new Triangle();
    triangle.setIndices(1, 2, 3);

    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.mesh.triangles!.length).to.equal(0);
    mb.addTriangle(triangle);
    expect(mb.mesh.triangles!.length).to.equal(1);

    // degenerate case
    triangle.setIndices(0, 0, 0);
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(() => mb.addTriangle(triangle)).to.throw("Programmer Error");
  });
});

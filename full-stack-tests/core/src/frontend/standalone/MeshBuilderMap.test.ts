/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Arc3d, LineString3d, Loop, Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { ColorDef, GraphicParams } from "@bentley/imodeljs-common";
import {
  GraphicType, IModelApp, IModelConnection, MockRender, ScreenViewport, SnapshotConnection, SpatialViewState, StandardViewId,
} from "@bentley/imodeljs-frontend";
import {
  DisplayParams, Geometry, GeometryList, Mesh, MeshBuilderMap, PolyfacePrimitive, PolyfacePrimitiveList, PrimitiveBuilder, StrokesPrimitiveList,
  ToleranceRatio,
} from "@bentley/imodeljs-frontend/lib/render-primitives";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black); }
}

/**
 * MESH BUILDER MAP TESTS
 * tests all paths for each public method
 */
describe("MeshBuilderMap Tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;
  let viewport: ScreenViewport;

  const viewDiv = document.createElement("div");
  assert(null !== viewDiv);
  viewDiv.style.width = viewDiv.style.height = "1000px";
  document.body.appendChild(viewDiv);

  before(async () => {   // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  beforeEach(() => {
    viewport = ScreenViewport.create(viewDiv, spatialView);
  });

  after(async () => {
    if (imodel) await imodel.close();
    await MockRender.App.shutdown();
  });

  afterEach(() => {
    viewport.dispose();
  });

  it("constructor", () => {
    const range = Range3d.createNull();
    const is2d = false;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const map = new MeshBuilderMap(tolerance, range, is2d);
    expect(map.range).to.equal(range);
    expect(map.tolerance).to.equal(tolerance);
    expect(map.is2d).to.equal(is2d);
    expect(map.facetAreaTolerance).to.equal(areaTolerance);
  });

  it("createFromGeometries", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

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

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    gfParams2.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams2, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).to.not.be.null;

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.22;
    const geomList = new GeometryList();
    geomList.push(loopGeom);
    geomList.push(arcGeom);
    const map = MeshBuilderMap.createFromGeometries(geomList, tolerance, range, is2d, false, false);
    expect(map.size).to.equal(3);
  });

  it("toMeshes", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

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

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    gfParams2.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams2, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).to.not.be.null;

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.22;
    const geomList = new GeometryList();
    geomList.push(loopGeom);
    geomList.push(arcGeom);
    const map = MeshBuilderMap.createFromGeometries(geomList, tolerance, range, is2d, false, false);
    expect(map.size).to.equal(3);

    const meshes = map.toMeshes();
    expect(meshes.length).to.equal(3);
  });

  it("loadGeometry", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

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

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.22;
    const map = new MeshBuilderMap(tolerance, range, is2d);

    expect(map.size).to.equal(0);
    map.loadGeometry(arcGeom, false);
    expect(map.size).to.equal(1);
    const type = strokesPrimList[0].isDisjoint ? Mesh.PrimitiveType.Point : Mesh.PrimitiveType.Polyline;
    const builder = map.getBuilder(arcGeom.displayParams, type, false, strokesPrimList[0].isPlanar);
    expect(map.size).to.equal(1);
    // EDL Why is this a hard coded count?
    expect(builder.vertexMap.length).to.lte(25);
    expect(builder.mesh.polylines!.length).to.equal(strokesPrimList[0].strokes.length);
    const map2 = new MeshBuilderMap(tolerance, range, is2d);
    expect(map2.size).to.equal(0);
    map2.loadGeometry(arcGeom, true);
    expect(map2.size).to.equal(0);
  });

  it("loadPolyfacePrimitiveList", () => {
    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

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
    const tolerance = 0.15;
    const map = new MeshBuilderMap(tolerance, range, is2d);

    expect(pfPrim.indexedPolyface.pointCount).to.be.greaterThan(0);
    expect(map.size).to.equal(0);
    map.loadPolyfacePrimitiveList(loopGeom);

    expect(map.size).to.equal(1);
    const builder = map.getBuilder(pfPrim.displayParams, Mesh.PrimitiveType.Mesh, pfPrim.indexedPolyface.normalCount > 0, pfPrim.isPlanar);
    expect(builder.triangleSet.length).to.equal(2);
  });

  it("loadIndexedPolyface", () => {
    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);
    const emptyLine = LineString3d.create([]);
    const emptyLoop = Loop.create(emptyLine);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).to.not.be.null;

    const loopRange2: Range3d = new Range3d();

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false);
    const emptyloopGeom = Geometry.createFromLoop(emptyLoop, Transform.createIdentity(), loopRange2, displayParams, false);
    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    assert(pfPrimList !== undefined);
    if (pfPrimList === undefined)
      return;
    const emptyPfPrimList: PolyfacePrimitiveList | undefined = emptyloopGeom.getPolyfaces(0);
    assert(emptyPfPrimList !== undefined);
    if (emptyPfPrimList === undefined)
      return;

    expect(pfPrimList.length).to.be.greaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).to.equal(points.length);

    const emptyPfPrim: PolyfacePrimitive = emptyPfPrimList[0];

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.15;
    let map = new MeshBuilderMap(tolerance, range, is2d);

    expect(pfPrim.indexedPolyface.pointCount).to.be.greaterThan(0);
    expect(map.size).to.equal(0);
    map.loadIndexedPolyface(pfPrim);

    expect(map.size).to.equal(1);
    const builder = map.getBuilder(pfPrim.displayParams, Mesh.PrimitiveType.Mesh, pfPrim.indexedPolyface.normalCount > 0, pfPrim.isPlanar);
    expect(builder.triangleSet.length).to.equal(2);

    // test case: when polyface has no points, no builder is created
    map = new MeshBuilderMap(tolerance, range, is2d);
    expect(emptyPfPrim.indexedPolyface.pointCount).to.equal(0);
    expect(map.size).to.equal(0);
    map.loadIndexedPolyface(emptyPfPrim);
    expect(map.size).to.equal(0);
  });

  it("loadStrokePrimitiveList", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

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

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.22;
    const map = new MeshBuilderMap(tolerance, range, is2d);

    expect(map.size).to.equal(0);
    map.loadStrokePrimitiveList(arcGeom);
    expect(map.size).to.equal(1);
    const type = strokesPrimList[0].isDisjoint ? Mesh.PrimitiveType.Point : Mesh.PrimitiveType.Polyline;
    const builder = map.getBuilder(arcGeom.displayParams, type, false, strokesPrimList[0].isPlanar);
    expect(map.size).to.equal(1);
    expect(builder.vertexMap.length).to.equal(25);
    expect(builder.mesh.polylines!.length).to.equal(strokesPrimList[0].strokes.length);
  });

  it("loadStrokesPrimitive", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

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

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const tolerance = 0.22;
    const map = new MeshBuilderMap(tolerance, range, is2d);

    expect(map.size).to.equal(0);
    map.loadStrokesPrimitive(strokesPrimList[0]);
    expect(map.size).to.equal(1);
    const type = strokesPrimList[0].isDisjoint ? Mesh.PrimitiveType.Point : Mesh.PrimitiveType.Polyline;
    const builder = map.getBuilder(arcGeom.displayParams, type, false, strokesPrimList[0].isPlanar);
    expect(map.size).to.equal(1);
    expect(builder.vertexMap.length).to.equal(25);
    expect(builder.mesh.polylines!.length).to.equal(strokesPrimList[0].strokes.length);
  });

  it("getBuilder", () => {
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const isPlanar = true;
    const range = Range3d.createNull();
    const is2d = false;
    const tolerance = 0.15;
    const hasNormals = false;
    const map = new MeshBuilderMap(tolerance, range, is2d);

    expect(map.size).to.equal(0);
    const builder = map.getBuilder(displayParams, type, hasNormals, isPlanar);
    expect(map.size).to.equal(1);
    const builder2 = map.getBuilder(displayParams, type, hasNormals, isPlanar);

    // expect only one instance of builder to be created, so both should have same reference
    expect(builder).to.equal(builder2);
    expect(map.size).to.equal(1);
  });

  it("getKey", () => {
    const range = Range3d.createNull();
    const is2d = false;
    const tolerance = 0.15;
    const hasNormals = false;
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const isPlanar = true;
    let map = new MeshBuilderMap(tolerance, range, is2d);
    let key = map.getKey(displayParams, type, hasNormals, isPlanar);

    expect(key.order).to.equal(0);

    // test case when preserveOrder is true
    map = new MeshBuilderMap(tolerance, range, is2d, true);
    key = map.getKey(displayParams, type, hasNormals, isPlanar);
    expect(key.order).to.equal(1);
  });

  it("getBuilderFromKey", () => {
    const displayParams = new FakeDisplayParams();
    const type = Mesh.PrimitiveType.Mesh;
    const isPlanar = true;
    const range = Range3d.createNull();
    const is2d = false;
    const tolerance = 0.15;
    const hasNormals = false;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;
    const map = new MeshBuilderMap(tolerance, range, is2d);
    const key = map.getKey(displayParams, type, hasNormals, isPlanar);
    const builder = map.getBuilderFromKey(key, { displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const builder2 = map.get(key);

    // expect same key to return same builder reference
    expect(builder).to.equal(builder2);

    const builder3 = map.getBuilderFromKey(key, { displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // expect same key pass into getBuilderFromKey to not create new instance of builder, but instead return previously stored instance
    expect(builder).to.equal(builder3);

    const key2 = map.getKey(displayParams, type, hasNormals, isPlanar);

    const builder4 = map.getBuilderFromKey(key2, { displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // expect an equivalent key (different key instance) to return same builder reference
    expect(builder).to.equal(builder4);
  });
});

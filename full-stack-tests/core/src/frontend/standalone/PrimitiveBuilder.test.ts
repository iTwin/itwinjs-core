/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { ColorDef, GraphicParams } from "@itwin/core-common";
import {
  GraphicType, IModelApp, IModelConnection, ScreenViewport, SpatialViewState, StandardViewId,
} from "@itwin/core-frontend";
import {
  _accumulator, Branch, DisplayParams, Geometry, PrimitiveBuilder,
} from "@itwin/core-frontend/lib/cjs/internal/test-support";
import { Arc3d, IndexedPolyface, LineString3d, Loop, Path, Point2d, Point3d, Polyface, Range3d, Transform } from "@itwin/core-geometry";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("PrimitiveBuilder", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;

  beforeAll(async () => {   // Create a ViewState to load into a Viewport
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

    const viewDiv = document.createElement("div");
    expect(null !== viewDiv).toBeTruthy();
    viewDiv.style.width = viewDiv.style.height = "1000px";
    document.body.appendChild(viewDiv);

    const spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);

    viewport = ScreenViewport.create(viewDiv, spatialView);
  });

  afterAll(async () => {
    viewport?.[Symbol.dispose]();
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("should produce proper arc strokes for specific tolerances", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const arc = Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC);
    expect(arc !== undefined && arc instanceof Arc3d).toBeTruthy();
    if (arc === undefined || !(arc instanceof Arc3d))
      return;

    primBuilder.addArc(arc, false, false);

    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const arcGeom = primBuilder[_accumulator].geometries.first;
    expect(arcGeom !== undefined).toBeTruthy();
    if (arcGeom === undefined)
      return;

    let strokesPrimList = arcGeom.getStrokes(0.22);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    let strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    let strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[strks.points.length - 1].isAlmostEqual(pointC)).toBe(true);
    const numPointsA = strks.points.length;

    strokesPrimList = arcGeom.getStrokes(0.12);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[strks.points.length - 1].isAlmostEqual(pointC)).toBe(true);
    const numPointsB = strks.points.length;

    expect(numPointsA).toBeLessThan(numPointsB);
  });

  it("should not produce any strokes for Polyface", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    // const pointA = new Point3d(-100, 0, 0);
    // const pointB = new Point3d(0, 100, 0);
    // const pointC = new Point3d(100, 0, 0);

    const polyFace = IndexedPolyface.create();
    polyFace.addPointXYZ(-100, 0, 0);
    polyFace.addPointXYZ(0, 100, 0);
    polyFace.addPointXYZ(100, 0, 0);
    expect(polyFace !== undefined && polyFace instanceof Polyface).toBeTruthy();
    if (polyFace === undefined || !(polyFace instanceof Polyface))
      return;

    primBuilder.addPolyface(polyFace);

    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const firstGeom = primBuilder[_accumulator].geometries.first;
    expect(firstGeom !== undefined).toBeTruthy();
    if (firstGeom === undefined)
      return;

    let strokesPrimList = firstGeom.getStrokes(0.22);
    expect(strokesPrimList === undefined).toBeTruthy();

    strokesPrimList = firstGeom.getStrokes(0.12);
    expect(strokesPrimList === undefined).toBeTruthy();
  });

  it("should not produce any strokes for Shape", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    primBuilder.addShape([pointA, pointB, pointC]);
    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const arcGeom = primBuilder[_accumulator].geometries.first;
    expect(arcGeom !== undefined).toBeTruthy();
    if (arcGeom === undefined)
      return;

    let strokesPrimList = arcGeom.getStrokes(0.22);
    expect(strokesPrimList === undefined || strokesPrimList.length === 0).toBeTruthy();

    strokesPrimList = arcGeom.getStrokes(0.12);
    expect(strokesPrimList === undefined || strokesPrimList.length === 0).toBeTruthy();
  });

  it("should not produce any strokes for Shape2d", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point2d(-100, 0);
    const pointB = new Point2d(0, 100);
    const pointC = new Point2d(100, 0);
    primBuilder.addShape2d([pointA, pointB, pointC], 5);
    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const arcGeom = primBuilder[_accumulator].geometries.first;
    expect(arcGeom !== undefined).toBeTruthy();
    if (arcGeom === undefined)
      return;

    let strokesPrimList = arcGeom.getStrokes(0.22);
    expect(strokesPrimList === undefined || strokesPrimList.length === 0).toBeTruthy();

    strokesPrimList = arcGeom.getStrokes(0.12);
    expect(strokesPrimList === undefined || strokesPrimList.length === 0).toBeTruthy();
  });

  it("should produce proper LineString strokes; different tolerances should have no effect", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const pointList = [pointA, pointB, pointC];

    primBuilder.addLineString(pointList);

    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const pointGeom = primBuilder[_accumulator].geometries.first;
    expect(pointGeom !== undefined).toBeTruthy();
    if (pointGeom === undefined)
      return;

    let strokesPrimList = pointGeom.getStrokes(0.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    let strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    let strks = strksPrims[0];

    // check that points of stroking match points of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[1].isAlmostEqual(pointB)).toBe(true);
    expect(strks.points[2].isAlmostEqual(pointC)).toBe(true);
    const numPointsA = strks.points.length;

    strokesPrimList = pointGeom.getStrokes(1.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[1].isAlmostEqual(pointB)).toBe(true);
    expect(strks.points[2].isAlmostEqual(pointC)).toBe(true);
    const numPointsB = strks.points.length;

    expect(numPointsA).toBe(numPointsB);
  });

  it("should produce proper PointString strokes; different tolerances should have no effect", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const pointList = [pointA, pointB, pointC];

    primBuilder.addPointString(pointList);

    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const pointGeom = primBuilder[_accumulator].geometries.first;
    expect(pointGeom !== undefined).toBeTruthy();
    if (pointGeom === undefined)
      return;

    let strokesPrimList = pointGeom.getStrokes(0.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    let strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    let strks = strksPrims[0];

    // check that points of stroking match points of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[1].isAlmostEqual(pointB)).toBe(true);
    expect(strks.points[2].isAlmostEqual(pointC)).toBe(true);
    const numPointsA = strks.points.length;

    strokesPrimList = pointGeom.getStrokes(1.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(pointA)).toBe(true);
    expect(strks.points[1].isAlmostEqual(pointB)).toBe(true);
    expect(strks.points[2].isAlmostEqual(pointC)).toBe(true);
    const numPointsB = strks.points.length;

    expect(numPointsA).toBe(numPointsB);
  });

  it("should produce proper PointString2d strokes; different tolerances should have no effect", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point2d(-100, 0);
    const pointB = new Point2d(0, 100);
    const pointC = new Point2d(100, 0);
    const pointList = [pointA, pointB, pointC];

    primBuilder.addPointString2d(pointList, 5);

    expect(!(primBuilder[_accumulator].geometries.isEmpty)).toBeTruthy();

    const pointGeom = primBuilder[_accumulator].geometries.first;
    expect(pointGeom !== undefined).toBeTruthy();
    if (pointGeom === undefined)
      return;

    let strokesPrimList = pointGeom.getStrokes(0.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    let strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    let strks = strksPrims[0];

    // check that points of stroking match points of original points
    expect(strks.points[0].isAlmostEqual(Point3d.create(-100, 0, 5))).toBe(true);
    expect(strks.points[1].isAlmostEqual(Point3d.create(0, 100, 5))).toBe(true);
    expect(strks.points[2].isAlmostEqual(Point3d.create(100, 0, 5))).toBe(true);
    const numPointsA = strks.points.length;

    strokesPrimList = pointGeom.getStrokes(1.0);

    expect(strokesPrimList !== undefined).toBeTruthy();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    strksPrims = strokesPrimList[0].strokes;
    expect(strksPrims.length).toBeGreaterThan(0);
    strks = strksPrims[0];

    // check that first and last point of stroking match first and last point of original points
    expect(strks.points[0].isAlmostEqual(Point3d.create(-100, 0, 5))).toBe(true);
    expect(strks.points[1].isAlmostEqual(Point3d.create(0, 100, 5))).toBe(true);
    expect(strks.points[2].isAlmostEqual(Point3d.create(100, 0, 5))).toBe(true);
    const numPointsB = strks.points.length;

    expect(numPointsA).toBe(numPointsB);
  });

  it("should be able to finish graphics", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });
    const accum = primBuilder[_accumulator];

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));
    points.push(new Point3d(1, 1, 0));
    points.push(new Point3d(0, 1, 0));

    const line = LineString3d.create(points);
    const loop = Loop.create(line);
    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0.22)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    const graphic = primBuilder.finish();
    expect(primBuilder.primitives.length).toBe(0); // if only 1 entry (a branch), the list of primitives is popped.
    expect(graphic instanceof Branch).toBe(true);
    expect((graphic as Branch).branch.entries.length).toBe(2);
  });
});

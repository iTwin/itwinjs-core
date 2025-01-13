/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LineString3d, Loop, Path, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, GraphicParams } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { StandardViewId } from "../../../StandardView";
import { SpatialViewState } from "../../../SpatialViewState";
import { Branch } from "../../../render/webgl/Graphic";
import { createBlankConnection } from "../../createBlankConnection";
import { FakeGeometry } from "./Fake";
import { GraphicType } from "../../../common";
import { PrimitiveBuilder } from "../../../internal/render/PrimitiveBuilder";
import { GeometryAccumulator } from "../../../common/internal/render/GeometryAccumulator";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";
import { _accumulator } from "../../../common/internal/Symbols";

describe("GeometryAccumulator tests", () => {
  let iModel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas");
  expect(canvas).not.toBeNull();
  canvas.width = canvas.height = 1000;
  document.body.appendChild(canvas);

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = createBlankConnection();
    spatialView = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  afterAll(async () => {
    if (iModel)
      await iModel.close();

    await IModelApp.shutdown();
  });

  it("addPath works as expected", () => {
    const accum = new GeometryAccumulator();

    const points: Point3d[] = [];
    points.push(new Point3d(0, 0, 0));
    points.push(new Point3d(1, 0, 0));

    const line = LineString3d.create(points);
    const pth = Path.create(line);

    const gfParams: GraphicParams = new GraphicParams();
    gfParams.lineColor = ColorDef.white;
    const displayParams = DisplayParams.createForLinear(gfParams);

    expect(accum.geometries.isEmpty).toBe(true);
    expect(accum.addPath(pth, displayParams, Transform.createIdentity(), false)).toBe(true);
    expect(accum.geometries.length).toEqual(1);

    // ###TODO test case where addPath returns false
  });

  it("addLoop works as expected", () => {
    const accum = new GeometryAccumulator();

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

    expect(accum.geometries.isEmpty).toBe(true);
    expect(accum.addLoop(loop, displayParams, Transform.createIdentity(), false)).toBe(true);
    expect(accum.geometries.length).toEqual(1);

    // ###TODO test case where addLoop returns false
  });

  it("addPolyface works as expected", () => {
    const accum = new GeometryAccumulator();

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
    expect(loopRange.isNull).toBe(false);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    // query polyface list from loopGeom
    const pfPrimList = loopGeom.getPolyfaces(0)!;
    expect(pfPrimList).not.toBeUndefined();

    expect(pfPrimList.length).toBeGreaterThan(0);
    const pfPrim = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).toEqual(points.length);

    expect(accum.geometries.isEmpty).toBe(true);
    expect(accum.addPolyface(pfPrim.indexedPolyface, displayParams, Transform.createIdentity())).toBe(true);
    expect(accum.geometries.length).toEqual(1);

    // ###TODO test case where addPolyface returns false
  });

  it("addGeometry works as expected", () => {
    const accum = new GeometryAccumulator();

    expect(accum.geometries.isEmpty).toBe(true);
    expect(accum.isEmpty).toBe(true);
    const fkGeom = new FakeGeometry();
    expect(accum.addGeometry(fkGeom)).toBe(true);
    expect(accum.geometries.length).toEqual(1);
  });

  it("clear works as expected", () => {
    const accum = new GeometryAccumulator();

    expect(accum.isEmpty).toBe(true);
    accum.addGeometry(new FakeGeometry());
    expect(accum.isEmpty).toBe(false);
    accum.clear();
    expect(accum.isEmpty).toBe(true);
  });

  it("toMeshBuilderMap works as expected", () => {
    const accum = new GeometryAccumulator();

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

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    expect(accum.geometries.length).toEqual(2);
    const map = accum.toMeshBuilderMap({ wantEdges: false, preserveOrder: false }, 0.22, undefined);
    expect(map.size).toEqual(2);
  });

  it("toMeshes works as expected", () => {
    const accum = new GeometryAccumulator();

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

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    expect(accum.geometries.length).toEqual(2);
    const meshes = accum.toMeshes({ wantEdges: false, preserveOrder: false }, 0.22, undefined);
    expect(meshes.length).toEqual(2);
  });

  it("saveToGraphicList works as expected", () => {
    const builder = new PrimitiveBuilder(IModelApp.renderSystem, {
      type: GraphicType.Scene,
      computeChordTolerance: () => 0,
    });
    const accum = builder[_accumulator];

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

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    const pathPoints: Point3d[] = [];
    pathPoints.push(new Point3d(0, 0, 0));
    pathPoints.push(new Point3d(1, 0, 0));

    const line2 = LineString3d.create(pathPoints);
    const pth = Path.create(line2);

    const gfParams2: GraphicParams = new GraphicParams();
    gfParams2.lineColor = ColorDef.white;
    const displayParams2: DisplayParams = DisplayParams.createForLinear(gfParams2);

    accum.addPolyface(loopGeom.getPolyfaces(0)![0].indexedPolyface, displayParams, Transform.createIdentity());
    accum.addPath(pth, displayParams2, Transform.createIdentity(), false);

    const graphics = new Array<RenderGraphic>();
    builder.saveToGraphicList(graphics, { wantEdges: false, preserveOrder: false }, 0.22, undefined);
    expect(graphics.length).toEqual(1);
    const graphic = graphics[0];
    expect(graphic instanceof Branch).toBe(true);
    expect((graphic as Branch).branch.entries.length).toEqual(2);
  });
});

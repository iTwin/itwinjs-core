/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Arc3d, AuxChannel, AuxChannelData, AuxChannelDataType, LineString3d, Loop, Point3d, PolyfaceAuxData, PolyfaceBuilder, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, GraphicParams } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { MockRender } from "../../../render/MockRender";
import { ScreenViewport } from "../../../Viewport";
import { PrimitiveBuilder } from "../../../internal/render/PrimitiveBuilder";
import { openBlankViewport } from "../../openBlankViewport";
import { GraphicType } from "../../../common/render/GraphicType";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { MeshBuilder, MeshEdgeCreationOptions } from "../../../common/internal/render/MeshBuilder";
import { MeshPrimitiveType } from "../../../common/internal/render/MeshPrimitive";
import { ToleranceRatio, Triangle } from "../../../common/internal/render/Primitives";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";
import { StrokesPrimitiveList, StrokesPrimitivePointLists } from "../../../common/internal/render/Strokes";
import { PolyfacePrimitive, PolyfacePrimitiveList } from "../../../common/internal/render/Polyface";
import { Mesh } from "../../../common/internal/render/MeshPrimitives";
import { createMeshParams } from "../../../common/internal/render/VertexTableBuilder";
import { _accumulator } from "../../../common/internal/Symbols";

class FakeDisplayParams extends DisplayParams {
  public constructor() {
    super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black);
  }
}

const edgeOptions = new MeshEdgeCreationOptions(MeshEdgeCreationOptions.Type.NoEdges);

describe("Mesh Builder Tests", () => {
  let viewport: ScreenViewport;

  beforeAll(async () => {
    // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    viewport = openBlankViewport();
  });

  afterAll(async () => {
    viewport.dispose();
    await MockRender.App.shutdown();
  });

  it("constructor", () => {
    const displayParams = new FakeDisplayParams();
    const type = MeshPrimitiveType.Mesh;
    const range = Range3d.createNull();
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.currentPolyface).toBeUndefined();
    expect(mb.mesh.displayParams).toEqual(displayParams);
    expect(mb.mesh.type).toEqual(type);
    expect(mb.mesh.is2d).toEqual(is2d);
    expect(mb.mesh.isPlanar).toEqual(isPlanar);
    expect(mb.tolerance).toEqual(tolerance);
    expect(mb.areaTolerance).toEqual(areaTolerance);
  });

  it("addStrokePointLists", () => {
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, { type: GraphicType.Scene, viewport });

    const pointA = new Point3d(-100, 0, 0);
    const pointB = new Point3d(0, 100, 0);
    const pointC = new Point3d(100, 0, 0);
    const arc = Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC);
    expect(arc).toBeInstanceOf(Arc3d);
    if (!(arc instanceof Arc3d))
      return;

    primBuilder.addArc(arc, false, false);

    expect(primBuilder[_accumulator].geometries.isEmpty).toBe(false);

    const arcGeom: Geometry | undefined = primBuilder[_accumulator].geometries.first;
    expect(arcGeom).toBeDefined();
    if (arcGeom === undefined)
      return;

    const strokesPrimList: StrokesPrimitiveList | undefined = arcGeom.getStrokes(0.22);

    expect(strokesPrimList).toBeDefined();
    if (strokesPrimList === undefined)
      return;

    expect(strokesPrimList.length).toBeGreaterThan(0);
    const strksPrims: StrokesPrimitivePointLists = strokesPrimList[0].strokes;

    const fillColor = ColorDef.white.tbgr;

    const displayParams = new FakeDisplayParams();
    const type = MeshPrimitiveType.Polyline;
    const range = Range3d.createArray([new Point3d(), new Point3d(10000, 10000, 10000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // calls addPolyline for each stroke points list in strokes
    expect(mb.mesh.polylines!.length).toEqual(0);
    mb.addStrokePointLists(strksPrims, false, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(strksPrims.length);
    const lengthA = mb.mesh.points.length;
    const lengthB = strksPrims[0].points.length;
    expect(lengthA).to.be.lte(lengthB);
    expect(mb.mesh.points.length).toBeGreaterThan(0);
    // calls addPointString for each stroke points list in strokes
    mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.mesh.polylines!.length).toEqual(0);
    expect(mb.mesh.points.length).toEqual(0);
    mb.addStrokePointLists(strksPrims, true, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(strksPrims.length);
    expect(mb.mesh.points.length).toEqual(strksPrims[0].points.length);
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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange.isNull).toBe(false);

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    expect(pfPrimList).toBeDefined();
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).toBeGreaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).toEqual(points.length);

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = MeshPrimitiveType.Mesh;
    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyface(pfPrim.indexedPolyface, { edgeOptions, includeParams, fillColor }, undefined);

    expect(mb.triangleSet.length).toEqual(2);
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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).not.toBeNull();

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    expect(pfPrimList).toBeDefined();
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).toBeGreaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).toEqual(points.length);

    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = MeshPrimitiveType.Mesh;
    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const visitor = pfPrim.indexedPolyface.createVisitor();
    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyfaceVisitor(visitor, { edgeOptions, includeParams, fillColor }, undefined);

    expect(mb.triangleSet.length).toEqual(1);
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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    expect(loopRange).not.toBeNull();

    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);

    // query polyface list from loopGeom
    const pfPrimList: PolyfacePrimitiveList | undefined = loopGeom.getPolyfaces(0);
    expect(pfPrimList).toBeDefined();
    if (pfPrimList === undefined)
      return;

    expect(pfPrimList.length).toBeGreaterThan(0);
    const pfPrim: PolyfacePrimitive = pfPrimList[0];
    expect(pfPrim.indexedPolyface.pointCount).toEqual(points.length);
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = MeshPrimitiveType.Mesh;
    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const visitor = pfPrim.indexedPolyface.createVisitor();
    const fillColor = ColorDef.white.tbgr;
    const triangleCount = visitor.pointCount - 2;
    const haveParam = includeParams && visitor.paramCount > 0;
    const triangleIndex = 0;
    const vertices = mb.createTriangleVertices(triangleIndex, visitor, { edgeOptions, fillColor, includeParams, haveParam, triangleCount }, undefined);

    expect(vertices!.length).toEqual(3);
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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

    const loopRange: Range3d = new Range3d();
    loop.range(undefined, loopRange);
    const loopGeom = Geometry.createFromLoop(loop, Transform.createIdentity(), loopRange, displayParams, false, undefined);
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

    const type = MeshPrimitiveType.Mesh;
    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const visitor = pfPrim.indexedPolyface.createVisitor();
    const fillColor = ColorDef.white.tbgr;
    const triangleCount = visitor.pointCount - 2;
    const haveParam = includeParams && visitor.paramCount > 0;
    const triangleIndex = 0;
    const triangle = mb.createTriangleVertices(triangleIndex, visitor, { edgeOptions, fillColor, includeParams, haveParam, triangleCount }, undefined);

    expect(triangle).toBeDefined();
  });

  it("addPolyline", () => {
    const displayParams = new FakeDisplayParams();
    let type = MeshPrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    let points = [new Point3d(), new Point3d(100, 100, 100), new Point3d(200, 200, 200)];
    const fillColor = ColorDef.white.tbgr;

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = MeshPrimitiveType.Polyline;
    mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).toEqual(0);
    mb.addPolyline(points, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).toEqual(0);
    mb.addPolyline(points, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(0);
  });

  it("addPointString", () => {
    const displayParams = new FakeDisplayParams();
    let type = MeshPrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    let mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    let points = [new Point3d(), new Point3d(100, 100, 100), new Point3d(200, 200, 200)];
    const fillColor = ColorDef.white.tbgr;

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = MeshPrimitiveType.Polyline;
    mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).toEqual(0);
    mb.addPointString(points, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).toEqual(0);
    mb.addPointString(points, fillColor, undefined);
    expect(mb.mesh.polylines!.length).toEqual(0);
  });

  it("addTriangle", () => {
    const triangle = new Triangle();
    triangle.setIndices(1, 2, 3);

    const displayParams = new FakeDisplayParams();
    const type = MeshPrimitiveType.Mesh;
    const range = Range3d.createArray([new Point3d(), new Point3d(1000, 1000, 1000)]);
    const is2d = false;
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const mb = MeshBuilder.create({ quantizePositions: false, displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
    expect(mb.mesh.triangles!.length).toEqual(0);
    mb.addTriangle(triangle);
    expect(mb.mesh.triangles!.length).toEqual(1);
  });

  function createMeshBuilder(type: MeshPrimitiveType, range: Range3d, options?: Partial<Omit<MeshBuilder.Props, "range" | "type">>): MeshBuilder {
    options = options ?? {};
    const tolerance = options.tolerance ?? 0.15;
    return MeshBuilder.create({
      quantizePositions: false,
      type,
      range,
      tolerance,
      areaTolerance: options.areaTolerance ?? ToleranceRatio.facetArea * tolerance,
      displayParams: options.displayParams ?? new FakeDisplayParams(),
      is2d: options.is2d ?? false,
      isPlanar: options.isPlanar ?? true,
    });
  }

  describe("aux data", () => {
    function expectAuxChannelTable(mesh: Mesh, expectedUint16Data: number[]): void {
      const args = mesh.toMeshArgs()!;
      expect(args).toBeDefined();
      const meshParams = createMeshParams(args, IModelApp.renderSystem.maxTextureSize, "non-indexed" !== IModelApp.tileAdmin.edgeOptions.type);
      const aux = meshParams.auxChannels!;
      expect(aux).toBeDefined();
      expect(Array.from(new Uint16Array(aux.data.buffer))).toEqual(expectedUint16Data);
    }

    it("preserves aux data for triangle facets", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addTriangleFacet([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 0x7fff, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 2]);

      const meshBuilder = createMeshBuilder(MeshPrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 }, undefined);
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).toEqual(3);
      expect(mesh.auxChannels!.length).toEqual(1);
      expect(mesh.auxChannels).toEqual(pf.data.auxData.channels);

      expectAuxChannelTable(mesh, [0, 0x7fff, 0xffff, 0]); // trailing zero is unused byte in last texel.
    });

    it("preserves aux data for facets with more than 3 sides", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 0x4fff, 0xbfff, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 2, 3]);

      const meshBuilder = createMeshBuilder(MeshPrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 }, undefined);
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).toEqual(6);
      expect(mesh.auxChannels!.length).toEqual(1);

      const aux = mesh.auxChannels![0];
      expect(aux.data.length).toEqual(1);
      const expectedData = [0, 0x4fff, 0xbfff, 0, 0xbfff, 0xffff];
      expect(aux.data[0].values).toEqual(expectedData);
      expectAuxChannelTable(mesh, expectedData);
    });

    it("maps aux data to vertices based on indices", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0x4000, 0x6000, 0x8000]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [2, 0, 0, 1]);

      const meshBuilder = createMeshBuilder(MeshPrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 }, undefined);
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).toEqual(6);
      expect(mesh.auxChannels!.length).toEqual(1);

      const aux = mesh.auxChannels![0];
      expect(aux.data.length).toEqual(1);
      expect(aux.data[0].values).toEqual([0x8000, 0x4000, 0x4000, 0x8000, 0x4000, 0x6000]);
      expectAuxChannelTable(mesh, [0xffff, 0, 0, 0xffff, 0, 0x8000]);
    });

    it("produces aux data for vector channel", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 1, 2, 3, 4, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Vector, "v");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 1, 0]);

      const meshBuilder = createMeshBuilder(MeshPrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 }, undefined);

      const aux = meshBuilder.mesh.auxChannels![0];
      expect(aux.data[0].values).toEqual([0, 1, 2, 3, 4, 0xffff, 3, 4, 0xffff, 0, 1, 2, 3, 4, 0xffff, 0, 1, 2]);
      expectAuxChannelTable(meshBuilder.mesh, [0, 0, 0, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0]);
    });
  });
});

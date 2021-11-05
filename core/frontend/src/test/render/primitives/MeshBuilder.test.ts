/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Arc3d, AuxChannel, AuxChannelData, AuxChannelDataType, LineString3d, Loop, Point3d, PolyfaceAuxData, PolyfaceBuilder, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, GraphicParams } from "@itwin/core-common";
import { GraphicType } from "../../../render/GraphicBuilder";
import { IModelApp } from "../../../IModelApp";
import { MockRender } from "../../../render/MockRender";
import { ScreenViewport } from "../../../Viewport";
import { DisplayParams } from "../../../render/primitives/DisplayParams";
import { Geometry } from "../../../render/primitives/geometry/GeometryPrimitives";
import { Mesh, MeshGraphicArgs } from "../../../render/primitives/mesh/MeshPrimitives";
import { PolyfacePrimitive, PolyfacePrimitiveList } from "../../../render/primitives/Polyface";
import { PrimitiveBuilder } from "../../../render/primitives/geometry/GeometryListBuilder";
import { StrokesPrimitiveList, StrokesPrimitivePointLists } from "../../../render/primitives/Strokes";
import { ToleranceRatio, Triangle } from "../../../render/primitives/Primitives";
import { MeshParams } from "../../../render/primitives/VertexTable";
import { MeshBuilder, MeshEdgeCreationOptions } from "../../../render/primitives/mesh/MeshBuilder";
import { openBlankViewport } from "../../openBlankViewport";

class FakeDisplayParams extends DisplayParams {
  public constructor() {
    super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black);
  }
}

const edgeOptions = new MeshEdgeCreationOptions(MeshEdgeCreationOptions.Type.NoEdges);

describe("Mesh Builder Tests", () => {
  let viewport: ScreenViewport;

  before(async () => {   // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    viewport = openBlankViewport();
  });

  after(async () => {
    viewport.dispose();
    await MockRender.App.shutdown();
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
    const primBuilder = new PrimitiveBuilder(IModelApp.renderSystem, {type: GraphicType.Scene, viewport });

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
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyface(pfPrim.indexedPolyface, { edgeOptions, includeParams, fillColor });

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
    const isPlanar = true;
    const tolerance = 0.15;
    const areaTolerance = ToleranceRatio.facetArea * tolerance;

    const type = Mesh.PrimitiveType.Mesh;
    const mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    const visitor = pfPrim.indexedPolyface.createVisitor();
    const includeParams = false;
    const fillColor = ColorDef.white.tbgr;
    mb.addFromPolyfaceVisitor(visitor, { edgeOptions, includeParams, fillColor });

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
    const vertices = mb.createTriangleVertices(triangleIndex, visitor, { edgeOptions, fillColor, includeParams, haveParam, triangleCount });

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
    gfParams.lineColor = ColorDef.white;
    gfParams.fillColor = ColorDef.black; // forces region outline flag
    const displayParams: DisplayParams = DisplayParams.createForMesh(gfParams, false);

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
    const triangle = mb.createTriangleVertices(triangleIndex, visitor, { edgeOptions, fillColor, includeParams, haveParam, triangleCount });

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
    expect(() => mb.addPolyline(points, fillColor)).to.throw("Assert: Programmer Error");

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = Mesh.PrimitiveType.Polyline;
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPolyline(points, fillColor);
    expect(mb.mesh.polylines!.length).to.equal(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPolyline(points, fillColor);
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
    expect(() => mb.addPointString(points, fillColor)).to.throw("Assert: Programmer Error");

    points = [new Point3d(), new Point3d(1, 1, 1), new Point3d(2, 2, 2)];
    type = Mesh.PrimitiveType.Polyline;
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPointString(points, fillColor);
    expect(mb.mesh.polylines!.length).to.equal(1);

    points = [new Point3d()];
    mb = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });

    // if array is less than 1 in length, no polylines added
    expect(mb.mesh.polylines!.length).to.equal(0);
    mb.addPointString(points, fillColor);
    expect(mb.mesh.polylines!.length).to.equal(0);
  });

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

  function createMeshBuilder(type: Mesh.PrimitiveType, range: Range3d, options?: Partial<Omit<MeshBuilder.Props, "range" | "type">>): MeshBuilder {
    options = options ?? { };
    const tolerance = options.tolerance ?? 0.15;
    return MeshBuilder.create({
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
      const args = new MeshGraphicArgs();
      mesh.getGraphics(args, IModelApp.renderSystem);
      const meshParams = MeshParams.create(args.meshArgs);
      const aux = meshParams.auxChannels!;
      expect(aux).not.to.be.undefined;
      expect(Array.from(new Uint16Array(aux.data.buffer))).to.deep.equal(expectedUint16Data);
    }

    it("preserves aux data for triangle facets", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addTriangleFacet([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 1, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 0x7fff, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 2]);

      const meshBuilder = createMeshBuilder(Mesh.PrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 });
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).to.equal(3);
      expect(mesh.auxChannels!.length).to.equal(1);
      expect(mesh.auxChannels).to.deep.equal(pf.data.auxData.channels);

      expectAuxChannelTable(mesh, [0, 0x7fff, 0xffff, 0]); // trailing zero is unused byte in last texel.
    });

    it("preserves aux data for facets with more than 3 sides", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 0x4fff, 0xbfff, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 2, 3]);

      const meshBuilder = createMeshBuilder(Mesh.PrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 });
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).to.equal(6);
      expect(mesh.auxChannels!.length).to.equal(1);

      const aux = mesh.auxChannels![0];
      expect(aux.data.length).to.equal(1);
      const expectedData = [0, 0x4fff, 0xbfff, 0, 0xbfff, 0xffff];
      expect(aux.data[0].values).to.deep.equal(expectedData);
      expectAuxChannelTable(mesh, expectedData);
    });

    it("maps aux data to vertices based on indices", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0x4000, 0x6000, 0x8000]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Scalar, "s");
      pf.data.auxData = new PolyfaceAuxData([channel], [2, 0, 0, 1]);

      const meshBuilder = createMeshBuilder(Mesh.PrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 });
      const mesh = meshBuilder.mesh;
      expect(mesh.points.length).to.equal(6);
      expect(mesh.auxChannels!.length).to.equal(1);

      const aux = mesh.auxChannels![0];
      expect(aux.data.length).to.equal(1);
      expect(aux.data[0].values).to.deep.equal([0x8000, 0x4000, 0x4000, 0x8000, 0x4000, 0x6000]);
      expectAuxChannelTable(mesh, [0xffff, 0, 0, 0xffff, 0, 0x8000]);
    });

    it("produces aux data for vector channel", () => {
      const pfBuilder = PolyfaceBuilder.create();
      pfBuilder.addQuadFacet([new Point3d(0, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0), new Point3d(1, 0, 0)]);

      const pf = pfBuilder.claimPolyface();
      const channelData = new AuxChannelData(1, [0, 1, 2, 3, 4, 0xffff]);
      const channel = new AuxChannel([channelData], AuxChannelDataType.Vector, "v");
      pf.data.auxData = new PolyfaceAuxData([channel], [0, 1, 1, 0]);

      const meshBuilder = createMeshBuilder(Mesh.PrimitiveType.Mesh, Range3d.fromJSON({ low: [0, 0, 0], high: [1, 1, 0] }));
      meshBuilder.addFromPolyface(pf, { edgeOptions, includeParams: false, fillColor: 0 });

      const aux = meshBuilder.mesh.auxChannels![0];
      expect(aux.data[0].values).to.deep.equal([
        0, 1, 2, 3, 4, 0xffff, 3, 4, 0xffff,
        0, 1, 2, 3, 4, 0xffff, 0, 1, 2,
      ]);
      expectAuxChannelTable(meshBuilder.mesh, [
        0, 0, 0, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff,
        0, 0, 0, 0xffff, 0xffff, 0xffff, 0, 0, 0,
      ]);
    });
  });
});

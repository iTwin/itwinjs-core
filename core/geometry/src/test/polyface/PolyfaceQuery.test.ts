/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import { Arc3d } from "../../curve/Arc3d";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { JointOptions } from "../../curve/OffsetOptions";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry, PolygonLocation } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYArray } from "../../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { NumberArray, Point3dArray } from "../../geometry3d/PointHelpers";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { TorusImplicit } from "../../numerics/Polynomials";
import { FacetIntersectOptions, FacetLocationDetail } from "../../polyface/FacetLocationDetail";
import { SortableEdge, SortableEdgeCluster } from "../../polyface/IndexedEdgeMatcher";
import { IndexedPolyface, Polyface, PolyfaceVisitor } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceData } from "../../polyface/PolyfaceData";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Box } from "../../solid/Box";
import { Cone } from "../../solid/Cone";
import { LinearSweep } from "../../solid/LinearSweep";
import { RotationalSweep } from "../../solid/RotationalSweep";
import { Sphere } from "../../solid/Sphere";
import { TorusPipe } from "../../solid/TorusPipe";
import { SpacePolygonTriangulation } from "../../topology/SpaceTriangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { ImportedSample } from "../ImportedSamples";

function addSquareFacet(builder: PolyfaceBuilder, x0: number, y0: number, a: number = 1) {
  const x1 = x0 + a;
  const y1 = y0 + a;
  const blue = 256 * 256;
  const green = 256;
  const blue1 = 250 * blue;
  const blue2 = 185 * blue;
  const red1 = 255;
  const green1 = green * 240;
  const normalZ = builder.reversedFlag ? -1 : 1;
  const pointArray = [Point3d.create(x0, y0), Point3d.create(x1, y0), Point3d.create(x1, y1), Point3d.create(x0, y1)];
  const points = GrowableXYZArray.create(pointArray);
  const params = GrowableXYArray.create(pointArray);    // this ignores z
  const normals = GrowableXYZArray.create([[0, 0, normalZ], [0, 0, normalZ], [0, 0, normalZ], [0, 0, normalZ]]);
  const colors = [blue1, blue2, red1, green1];
  builder.addFacetFromGrowableArrays(points, normals, params, colors);
}

it("PartitionFacetsByConnectivity", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const a = 1.0;
  const dyBetweenComponents = 2 * a;
  let x0 = 0;
  for (const numVertexConnectedComponents of [1, 2, 3, 8]) {
    let y0 = 0;
    const builder = PolyfaceBuilder.create();
    if (!Geometry.isOdd(numVertexConnectedComponents))
      builder.toggleReversedFacetFlag();
    // primary facet stacked vertically ...
    for (let k = 0; k < numVertexConnectedComponents; k++) {
      addSquareFacet(builder, 0, k * dyBetweenComponents, a);
    }
    for (let m = 1; m < numVertexConnectedComponents; m++) {
      for (let k = 1; k < m; k++) {
        addSquareFacet(builder, (m - k) * a, k * dyBetweenComponents);
      }
    }
    // and another on the left of each strip
    for (let k = 1; k < numVertexConnectedComponents; k++)
      addSquareFacet(builder, -a, k * dyBetweenComponents, a);
    // above the first component, add two more on left with vertex connectivity
    const b = a * 0.5;
    let numEdgeConnectedComponents = numVertexConnectedComponents;
    for (let k = 1; k < numVertexConnectedComponents; k++) {
      numEdgeConnectedComponents++;
      addSquareFacet(builder, -a, k * dyBetweenComponents, -a * 0.5);
      addSquareFacet(builder, -a - b, k * dyBetweenComponents, -a * 0.5);
    }
    const polyface = builder.claimPolyface();
    polyface.twoSided = true;
    const partitionArray = [
      PolyfaceQuery.partitionFacetIndicesByVertexConnectedComponent(polyface),
      PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface)];
    const expectedComponentCountArray = [numVertexConnectedComponents, numEdgeConnectedComponents];
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
    y0 = - 2 * numVertexConnectedComponents * a;
    x0 += (numVertexConnectedComponents + 2) * a;
    for (const selector of [0, 1]) {
      const partitions = partitionArray[selector];
      ck.testExactNumber(expectedComponentCountArray[selector], partitions.length);
      const fragmentPolyfaces = PolyfaceQuery.clonePartitions(polyface, partitions);
      // draw a slightly expanded range around each partition ...
      const expansion = 0.1;
      for (const fragment of fragmentPolyfaces) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragment, x0, y0);
        const range = fragment.range();
        range.expandInPlace(expansion);
        const z1 = 0.01;
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(
          Point3d.create(range.low.x, range.low.y), Point3d.create(range.high.x, range.low.y), Point3d.create(range.high.x, range.high.y), Point3d.create(range.low.x, range.high.y), Point3d.create(range.low.x, range.low.y)), x0, y0, z1);
      }
      y0 += (2 * numVertexConnectedComponents + 3) * a;
    }
    x0 += (numVertexConnectedComponents + 10) * a;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "PartitionFacetsByConnectivity");
  expect(ck.getNumErrors()).equals(0);
});

it("ExpandToMaximalPlanarFacetsA", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const builder = PolyfaceBuilder.create();
  const linestringA = LineString3d.create(
    [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 1], [4, 0, 0],
  );
  const dx = 0;
  let dy = 1;
  const linestringB = linestringA.cloneTransformed(Transform.createTranslationXYZ(0, 2, 0));
  builder.addGreedyTriangulationBetweenLineStrings(linestringA, linestringB);
  const polyface = builder.claimPolyface(true);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy, 0);
  const partitions1 = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface, false);
  PolyfaceQuery.markPairedEdgesInvisible(polyface, Angle.createDegrees(1.0));
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy += 3, 0);
  const partitions2 = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface, true);
  ck.testExactNumber(1, partitions1.length, "Simple partitions");
  ck.testExactNumber(3, partitions2.length, "Planar partitions");
  dy += 3;
  for (const partition of [partitions1, partitions2]) {
    const fragmentPolyfaces = PolyfaceQuery.clonePartitions(polyface, partition);
    const dzBoundary = 0.25;
    dy += 3;
    const ax = 0.0;
    for (const fragment of fragmentPolyfaces) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, fragment, ax, dy, 0);
      const boundary = PolyfaceQuery.boundaryEdges(fragment);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundary, dx, dy, dzBoundary);
      dy += 2;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ExpandToMaximalPlanarFaces");
  expect(ck.getNumErrors()).equals(0);
});

/**
 * Return whether all edges in the clusters are visible.
 * @param allHidden whether to return whether all edges in the clusters are hidden instead
 */
function allEdgesAreVisible(mesh: IndexedPolyface, clusters: SortableEdgeCluster[], allHidden?: boolean): boolean {
  if (undefined === allHidden)
    allHidden = false;
  for (const cluster of clusters) {
    if (cluster instanceof SortableEdge) {
      if (allHidden === PolyfaceQuery.getSingleEdgeVisibility(mesh, cluster.facetIndex, cluster.vertexIndexA))
        return false;
    } else {
      for (const edge of cluster) {
        if (allHidden === PolyfaceQuery.getSingleEdgeVisibility(mesh, edge.facetIndex, edge.vertexIndexA))
          return false;
      }
    }
  }
  return true;
}

/**
 * Flex dihedral edge filter, and verify various clustered edge counts and visibilities.
 * @param expectedSmoothCount expected count of smooth manifold edge pairs
 * @param expectedSharpCount expected count of sharp manifold edge pairs
 * @param expectedOtherCount expected count of non-manifold edge clusters
 * @param expectAllSmoothEdgesHidden whether to verify all smooth edges are hidden (default, false: verify all are visible)
 * @param expectAllSharpEdgesHidden whether to verify all sharp edges are hidden (default, false: verify all are visible)
 * @param expectAllOtherEdgesHidden whether to verify all other edges are hidden (default, false: verify all are visible)
 */
function verifyEdgeCountsAndVisibilities(ck: Checker, mesh: IndexedPolyface, dihedralAngle: Angle | undefined,
  expectedSmoothCount: number, expectedSharpCount: number, expectedOtherCount: number,
  expectAllSmoothEdgesHidden?: boolean, expectAllSharpEdgesHidden?: boolean, expectAllOtherEdgesHidden?: boolean): boolean {
  const smoothEdges = PolyfaceQuery.collectEdgesByDihedralAngle(mesh, dihedralAngle);
  const sharpEdges = PolyfaceQuery.collectEdgesByDihedralAngle(mesh, dihedralAngle, true);
  const otherEdges: SortableEdgeCluster[] = [];
  PolyfaceQuery.createIndexedEdges(mesh).sortAndCollectClusters(undefined, otherEdges, otherEdges, otherEdges);
  if (!ck.testExactNumber(expectedSmoothCount, smoothEdges.length, "Unexpected smooth edge count"))
    return false;
  if (!ck.testExactNumber(expectedSharpCount, sharpEdges.length, "Unexpected sharp edge count"))
    return false;
  if (!ck.testExactNumber(expectedOtherCount, otherEdges.length, "Unexpected other edge count"))
    return false;
  if (!ck.testTrue(allEdgesAreVisible(mesh, smoothEdges, expectAllSmoothEdgesHidden), "Unexpected smooth edge visibility"))
    return false;
  if (!ck.testTrue(allEdgesAreVisible(mesh, sharpEdges, expectAllSharpEdgesHidden), "Unexpected sharp edge visibility"))
    return false;
  if (!ck.testTrue(allEdgesAreVisible(mesh, otherEdges, expectAllOtherEdgesHidden), "Unexpected other edge visibility"))
    return false;
  return true;
}

it("ExpandToMaximalPlanarFacetsWithHole", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const polyface = Sample.sweepXZLineStringToMeshWithHoles(
    [[0, 0], [5, 1], [7, 1]],
    5,
    (x: number, y: number) => {
      if (x === 1 && y === 1) return false;
      if (x === 3 && y === 2) return false;
      if (x === 5 && y === 2) return false;
      return true;
    },
  );
  let dx = 0;
  let dy = 0;
  const yStep = 10.0;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy, 0);
  verifyEdgeCountsAndVisibilities(ck, polyface, undefined, 42, 4, 36);

  const maximalPolyface = PolyfaceQuery.cloneWithMaximalPlanarFacets(polyface);
  if (maximalPolyface) {
    verifyEdgeCountsAndVisibilities(ck, maximalPolyface, undefined, 4, 4, 36, true);  // smooth edges are hidden because they are bridges
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, maximalPolyface, dx, dy += yStep, 0);
    dx += 20;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ExpandToMaximalPlanarFacesWithHoles");
  expect(ck.getNumErrors()).equals(0);
});

// implement a minimal visitor NOT backed by a Polyface
class VisitorSansMesh extends PolyfaceData implements PolyfaceVisitor {
  private _index: number;
  private _numIndices: number;
  public constructor(numIndicesAndVertices: number) {
    super();
    this._numIndices = numIndicesAndVertices;
    this._index = -1;
  }
  public moveToReadIndex(index: number): boolean {
    if (index < 0 || index >= this._numIndices)
      return false;
    this._index = index;
    this.pointIndex = [index];  // each "face loop" is a singleton array holding a unique index
    return true;
  }
  public currentReadIndex(): number {
    return this._index;
  }
  public moveToNextFacet(): boolean {
    return this.moveToReadIndex(this._index + 1);
  }
  public reset(): void {
    this._index = -1;
    this.pointIndex = [];
  }
  public clientPolyface(): Polyface | undefined {
    return undefined; // highly unusual
  }
  public clientPointIndex(_i: number): number {
    return this.pointIndex[0];
  }
  public clientParamIndex(_i: number): number {
    return -1;
  }
  public clientNormalIndex(_i: number): number {
    return -1;
  }
  public clientColorIndex(_i: number): number {
    return -1;
  }
  public clientAuxIndex(_i: number): number {
    return -1;
  }
  public setNumWrap(_numWrap: number): void {
  }
  public clearArrays(): void {
  }
  public pushDataFrom(_other: PolyfaceVisitor, _index: number): void {
  }
  public pushInterpolatedDataFrom(_other: PolyfaceVisitor, _index0: number, _fraction: number, _index1: number): void {
  }
}

it("CountVisitableFacets", () => {
  const ck = new Checker();
  const mesh = ImportedSample.createPolyhedron62();
  if (ck.testType(mesh, IndexedPolyface)) {
    ck.testExactNumber(60, PolyfaceQuery.visitorClientPointCount(mesh));
    ck.testExactNumber(62, PolyfaceQuery.visitorClientFacetCount(mesh));
    const visitor = mesh.createVisitor(0);
    ck.testExactNumber(60, PolyfaceQuery.visitorClientPointCount(visitor));
    ck.testExactNumber(62, PolyfaceQuery.visitorClientFacetCount(visitor));
  }
  // test a visitor without polyface backing
  const visitor0 = new VisitorSansMesh(5);
  ck.testExactNumber(5, PolyfaceQuery.visitorClientPointCount(visitor0));
  ck.testExactNumber(5, PolyfaceQuery.visitorClientFacetCount(visitor0));
  expect(ck.getNumErrors()).equals(0);
});

it("FillHoles", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const polyface = Sample.sweepXZLineStringToMeshWithHoles(
    [[0, 0], [5, 1], [7, 1]],
    5,
    (x: number, y: number) => {
      if (x === 1 && y === 1) return false;
      if (x === 3 && y === 2) return false;
      if (x === 3 && y === 3) return false;
      return true;
    },
  );
  const dx = 0;
  let dy = 0;
  const yStep = 10.0;
  const zShift = 5.0;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy += yStep, 0);
  dy += yStep;
  let numChains = 0;
  PolyfaceQuery.announceBoundaryChainsAsLineString3d(polyface,
    (ls: LineString3d) => { GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, dx, dy); numChains++; });
  ck.testExactNumber(3, numChains, "boundary chains");

  const options = { includeOriginalMesh: false, upVector: Vector3d.unitZ(), maxPerimeter: 5 };
  const unfilledChains: LineString3d[] = [];

  const filledHoles = PolyfaceQuery.fillSimpleHoles(polyface, options, unfilledChains);
  ck.testExactNumber(2, unfilledChains.length, "outer and large hole via perimeter");
  dy += yStep;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, filledHoles, dx, dy, 0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, unfilledChains, dx, dy, zShift);

  const optionsA = { includeOriginalMesh: true, maxEdgesAroundHole: 9 };
  const unfilledChainsA: LineString3d[] = [];
  const filledHolesA = PolyfaceQuery.fillSimpleHoles(polyface, optionsA, unfilledChainsA);
  ck.testExactNumber(1, unfilledChainsA.length, "outer via count");
  dy += yStep;
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, filledHolesA, dx, dy, 0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, unfilledChainsA, dx, dy, zShift);

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "FillHoles");
  expect(ck.getNumErrors()).equals(0);
});

it("SimplestTriangulation", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const range = Range3d.createXYZXYZ(0, 0, 0, 3, 1, 1);
  const points = range.corners();
  let dx = 0;
  const dy = 0;
  const dz = 0;
  const xStep = 5;
  const yStep = 4;

  const announceTriangles = (loop: Point3d[], triangles: Point3d[][]) => {
    const builder = PolyfaceBuilder.create();
    for (const t of triangles)
      builder.addPolygon(t);
    const polyface = builder.claimPolyface(true);
    polyface.twoSided = true;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy + yStep, dz);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy + 2 * yStep, dz);
  };
  const doTest = (pointsA: Point3d[], expected: boolean, message: any) => {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, dx, dy, dz);
    // (  force the linestring branch selectively)
    if (pointsA.length !== 4)
      ck.testBoolean(expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop(
        LineString3d.create(pointsA), announceTriangles), message);
    else
      ck.testBoolean(expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop(pointsA, announceTriangles), message);
    dx += xStep;
  };

  const pointQ = points[0].interpolate(0.5, points[1]);
  const pointR = points[0].interpolate(0.75, points[1]);

  doTest([points[0], points[1], points[3]], true, [0, 1, 3]);
  doTest([points[0], points[1], points[3], points[2]], true, "0,1,3,2");
  // force both diagonal variants
  doTest([points[0], pointR, points[3], points[2]], true, "0,R,3,2");
  doTest([pointR, points[1], points[3], points[2]], true, "R,1,3,2");

  doTest([points[0], points[1], points[3], points[7]], true, "0,1,3,7");
  doTest([points[0], points[1], points[3], points[7].interpolate(0.5, points[4])], true, "0,1,3,<7,0.5,4>");
  dx += xStep;
  doTest([points[0], points[1], points[1]], false, [0, 1, 1]);
  doTest([points[0], points[1], points[1], points[2]], false, [0, 1, 1, 2]);
  doTest([points[0], pointQ, pointR, points[1]], false, "4 colinear");
  doTest([points[0], pointQ, points[1]], false, "3 colinear");
  ck.testFalse(SpacePolygonTriangulation.triangulateSimplestSpaceLoop([points[0], points[1], points[3], points[2]], announceTriangles, 2.0), "perimeter trigger");

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "SimplestTriangulation");
  expect(ck.getNumErrors()).equals(0);
});

it("GreedyEarCutTriangulation", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const points = [
    Point3d.create(1, 0, 0),
    Point3d.create(1, 1, 0),
    Point3d.create(-1, 1, 0),
    Point3d.create(-1, 0, 0),
  ];
  const arc = Arc3d.createXYEllipse(Point3d.create(0, 0, 0), 0.75, 0.25);
  let dx = 0;
  const dy = 0;
  const dz = 0;
  const xStep = 5;
  const yStep = 4;

  const announceTriangles = (loop: Point3d[], triangles: Point3d[][]) => {
    const builder = PolyfaceBuilder.create();
    for (const t of triangles)
      builder.addPolygon(t);
    const polyface = builder.claimPolyface(true);
    polyface.twoSided = true;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, dx, dy + yStep, dz);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, dx, dy + 2 * yStep, dz);
  };
  const doTest = (pointsA: Point3d[], pointB: Point3d, expected: boolean, message: any) => {
    pointsA.push(pointB);
    dx += xStep;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, pointsA, dx, dy, dz);
    if (ck.testBoolean(expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop(pointsA, announceTriangles), message)) {
    }
    pointsA.pop();
  };

  for (const yMove of [0, 3]) {
    for (const zz of [0, 0.2, -0.4, 4.0]) {
      for (const fraction of [0.75, 0.9, 0.0, 0.1, 0.4, 0.5, 0.6]) {
        const pointB = arc.fractionToPoint(fraction);
        pointB.z = zz;
        pointB.y += yMove;
        // hmm.. zz values don't bother it alone.
        // shifting y does make it fail . . ..
        doTest(points, pointB, (yMove === 0), { fraction, zz, yMove });
      }
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "GreedyEarCutTriangulation");
  expect(ck.getNumErrors()).equals(0);
});

it("cloneWithTVertexFixup", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const builder = PolyfaceBuilder.create();
  addSquareFacet(builder, 0, 0, 1);
  const sectorRadius = 0.02;
  const x0 = 0;
  const y0 = 0;
  const dy = 3.0;
  addSquareFacet(builder, 1, 0, 0.5);
  addSquareFacet(builder, 0, 1, 0.3);
  addSquareFacet(builder, 1, 0.5, 1);
  const a = 0.10;
  addSquareFacet(builder, -a, 0, a);
  addSquareFacet(builder, -a, a, a);
  addSquareFacet(builder, -a, 2 * a, a);
  const mesh0 = builder.claimPolyface();
  const mesh1 = PolyfaceQuery.cloneWithTVertexFixup(mesh0);
  const mesh2 = PolyfaceQuery.cloneWithColinearEdgeFixup(mesh1);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh0, x0, y0);
  GeometryCoreTestIO.createAndCaptureSectorMarkup(allGeometry, mesh0, sectorRadius, true, x0 + dy, y0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, x0, y0 + dy);
  GeometryCoreTestIO.createAndCaptureSectorMarkup(allGeometry, mesh1, sectorRadius, true, x0 + dy, y0 + dy);
  // !!! this does NOT remove the T vertex additions !!!
  GeometryCoreTestIO.createAndCaptureSectorMarkup(allGeometry, mesh2, sectorRadius, true, x0 + dy, y0 + 2 * dy);
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "cloneWithTVertexFixup");
  expect(ck.getNumErrors()).equals(0);
});

it("cloneWithColinearEdgeFixup", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const x0 = 0;
  const y0 = 0;
  const dy = 5.0;
  const sectorRadius = 0.02;
  const builder = PolyfaceBuilder.create();
  const pointsA = Sample.createInterpolatedPoints(Point3d.create(0, 2), Point3d.create(0, 0), 3);
  const pointsB = Sample.createInterpolatedPoints(Point3d.create(4, 2), Point3d.create(4, 0), 3);

  const polygon0: Point3d[] = [];
  Sample.createInterpolatedPoints(pointsA[1], pointsB[1], 4, polygon0);
  Sample.createInterpolatedPoints(pointsB[0], pointsA[0], 3, polygon0);
  builder.addPolygon(polygon0);

  const polygon1: Point3d[] = [];
  Sample.createInterpolatedPoints(pointsB[1], pointsA[1], 4, polygon1);
  Sample.createInterpolatedPoints(pointsA[2], pointsB[2], 2, polygon1);
  builder.addPolygon(polygon1);

  const mesh0 = builder.claimPolyface();
  const mesh1 = PolyfaceQuery.cloneWithColinearEdgeFixup(mesh0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh0, x0, y0);
  GeometryCoreTestIO.createAndCaptureSectorMarkup(allGeometry, mesh0, sectorRadius, true, x0 + dy, y0);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, x0, y0 + dy);
  GeometryCoreTestIO.createAndCaptureSectorMarkup(allGeometry, mesh1, sectorRadius, true, x0 + dy, y0 + dy);
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "cloneWithColinearEdgeFixup");
  expect(ck.getNumErrors()).equals(0);
});

describe("MarkVisibility", () => {
  it("SimpleBoundary", () => {
    const ck = new Checker();
    let dy = 0.0;
    const dx = 0.0;
    const yStep = 10.0;
    const allGeometry: GeometryQuery[] = [];
    const numX = 4;
    const numY = 4;
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1.0324, 0, 0.1), Vector3d.create(0, 1.123, 0.5), numX, numY);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, dx, dy, 0);
    dy += yStep;
    PolyfaceQuery.markPairedEdgesInvisible(mesh);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, dx, dy, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "MarkVisibility", "SimpleBoundary");
    expect(ck.getNumErrors()).equals(0);
  });

  it("NonManifold", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const dy = 5.0;
    const pointA0 = Point3d.create(0, 0);
    const pointA1 = Point3d.create(0, 1);
    const pointB0 = Point3d.create(1, 0);
    const pointB1 = Point3d.create(1, 1);
    const pointC0 = Point3d.create(1, 0, 1);
    const pointC1 = Point3d.create(1, 1, 1);
    const pointD0 = Point3d.create(1, 0, 2);
    const pointD1 = Point3d.create(1, 1, 2);
    const pointE0 = Point3d.create(2, 0);
    const pointE1 = Point3d.create(2, 1);

    const builder = PolyfaceBuilder.create();
    builder.addPolygon([pointA0, pointB0, pointB1, pointA1]);
    builder.addPolygon([pointA0, pointC0, pointC1, pointA1]);
    builder.addPolygon([pointA0, pointD0, pointD1, pointA1]);
    builder.addPolygon([pointB0, pointE0, pointE1, pointB1]);
    const mesh = builder.claimPolyface(true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
    PolyfaceQuery.markPairedEdgesInvisible(mesh);
    y0 += dy;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "MarkVisibility", "NonManifold");

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("ReorientFacets", () => {
  it("TwoFacets", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const dy = 5.0;
    const pointA0 = Point3d.create(0, 0);
    const pointA1 = Point3d.create(0, 1);
    const pointB0 = Point3d.create(1, 0);
    const pointB1 = Point3d.create(1, 1);
    const pointC0 = Point3d.create(2, 0);
    const pointC1 = Point3d.create(2, 1);

    const builderA = PolyfaceBuilder.create();
    builderA.addPolygon([pointA0, pointB0, pointB1, pointA1]);
    builderA.addPolygon([pointB0, pointC0, pointC1, pointB1]);   // consistent
    const meshA = builderA.claimPolyface();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, x0, y0, 0);
    PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(meshA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, x0, y0 + dy, 0);
    x0 += 10;
    const builderB = PolyfaceBuilder.create();
    builderB.addPolygon([pointA0, pointB0, pointB1, pointA1]);
    builderB.addPolygon([pointB0, pointB1, pointC1, pointC0]);   // consistent
    const meshB = builderB.claimPolyface(true);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshB, x0, y0, 0);
    PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(meshB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshB, x0, y0 + dy, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "ReorientFacets", "TwoFacets");

    expect(ck.getNumErrors()).equals(0);
  });

  it("ManyFlips", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const dy = 5.0;
    const dx = 12.0;
    const facetsToFlip = [3, 4, 5, 12, 13, 14];
    for (let numFlip = 0; numFlip < facetsToFlip.length; numFlip++) {
      const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1.0324, 0, 0.1), Vector3d.create(0, 1.123, 0.5), 3, 7);
      for (let i = 0; i < numFlip; i++)
        mesh.reverseSingleFacet(facetsToFlip[i]);
      ck.testBoolean(numFlip === 0, PolyfaceQuery.isPolyfaceManifold(mesh, true), "initial mesh pairing state");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
      PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(mesh);
      ck.testTrue(PolyfaceQuery.isPolyfaceManifold(mesh, true), "corrected mesh pairing state");
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0 + dy, 0);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ReorientFacets", "ManyFlips");
    expect(ck.getNumErrors()).equals(0);
  });

  it("MeshClosure", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const testCases = ["./src/test/data/polyface/closedMesh.imjs", "./src/test/data/polyface/almostClosedMesh.imjs"];
    for (const testCase of testCases) {
      const mesh = IModelJson.Reader.parse(JSON.parse(fs.readFileSync(testCase, "utf8"))) as IndexedPolyface;
      if (ck.testType(mesh, IndexedPolyface, "input successfully parsed")) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0);
        const range = mesh.range();
        let isTopologicallyClosed = PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh);
        if (!isTopologicallyClosed) {
          // almostClosedMesh has two degenerate triangles with only 2 edges, and a degenerate hexagon with only 3 edges,
          // which can be seen in the allGeometry if the following compress is skipped.
          mesh.data.compress();
          const typicalBoundary = PolyfaceQuery.collectBoundaryEdges(mesh, true, false, false);
          ck.testUndefined(typicalBoundary, "compressed mesh anomalous boundary removed successfully");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, typicalBoundary, x0);
          isTopologicallyClosed = PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh);
        }
        ck.testBoolean(isTopologicallyClosed, 2 === mesh.expectedClosure, "expected closure agrees with topo closure");
        x0 += range.xLength();
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ReorientFacets", "MeshClosure");
    expect(ck.getNumErrors()).equals(0);
  });

  it("MoebiusStrip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const meshDataA = {
      indexedMesh: {
        point: [
          [0, 0, 0],
          [0, 1, 0],
          [1, 0, 0],
          [1, 1, 0],
          [1, 0, 1],
          [1, 1, 1],
          [0.5, 0.5, 0.5],
          [0, 0.5, 0.5],
        ],
        pointIndex: [
          1, 2, 4, 3, 0,
          3, 4, 6, 5, 0,
          5, 6, 8, 0,
          5, 8, 7, 0,
          7, 8, 1, 0,
          1, 7, 2, 0,
        ],
      },
    };
    const a = 8.0;
    const b = 0.5;
    const meshDataB = {
      indexedMesh: {
        point: [
          [0, 0, 0],
          [0, 0, 2],
          [a - b, b, 1],
          [a + b, -b, 1],
          [a, a, 2],
          [a, a, 0],
          [1, a - b, 1],
          [-1, a + b, 1],
        ],
        pointIndex: [
          1, 2, 3, 0,
          1, 3, 4, 0,

          4, 3, 6, 0,
          6, 5, 4, 0,

          5, 6, 7, 0,
          5, 7, 8, 0,

          8, 7, 1, 0,
          8, 1, 2, 0,
        ],
      },
    };
    const builderC = PolyfaceBuilder.create();
    const torus = new TorusImplicit(8.0, 1.0);
    let thetaDegrees = 0.0;
    const thetaDegreeStep = 45.0;
    let phiDegrees = 90.0;
    const phiDegreeStep = thetaDegreeStep / 2;
    for (; thetaDegrees < 360; thetaDegrees += thetaDegreeStep, phiDegrees += phiDegreeStep) {
      const theta0 = Angle.degreesToRadians(thetaDegrees);
      const phi0 = Angle.degreesToRadians(phiDegrees);
      const xyzA = torus.evaluateThetaPhi(theta0, phi0);
      const xyzB = torus.evaluateThetaPhi(theta0, phi0 + Math.PI);
      const theta1 = Angle.degreesToRadians(thetaDegrees + thetaDegreeStep);
      const phi1 = Angle.degreesToRadians(phiDegrees + phiDegreeStep);
      const xyzC = torus.evaluateThetaPhi(theta1, phi1);
      const xyzD = torus.evaluateThetaPhi(theta1, phi1 + Math.PI);
      builderC.addPolygon([xyzA, xyzB, xyzC]);
      builderC.addPolygon([xyzC, xyzB, xyzD]);
    }
    const meshC = builderC.claimPolyface();
    const meshA = IModelJson.Reader.parse(meshDataA) as IndexedPolyface;
    const meshB = IModelJson.Reader.parse(meshDataB) as IndexedPolyface;
    for (const mesh of [meshA.clone(), meshB.clone(), meshC.clone()]) {
      if (mesh instanceof IndexedPolyface) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
        ck.testFalse(PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(mesh));
      }
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ReorientFacets", "MoebiusStrip");

    expect(ck.getNumErrors()).equals(0);
  });
  it("DuplicateFacetPurge", () => {
    const ck = new Checker();
    // 7,8,9
    // 4,5,6
    // 1,2,3,10
    // initialize as 2x2 grid with a triangle added ... point indices start at various quadrants of the facets
    const meshDataA = {
      indexedMesh: {
        point: [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
          [0, 1, 0],
          [1, 1, 0],
          [2, 1, 0],
          [0, 2, 0],
          [1, 2, 0],
          [2, 2, 0],
          [3, 0, 0],
        ],
        pointIndex: [
          1, 2, 5, 4, 0,
          3, 6, 5, 2, 0,
          7, 4, 5, 8, 0,
          9, 8, 5, 6, 0,
          3, 10, 6, 0,
        ],
      },
    };

    testDuplicateFacetCounts(ck, "Original No Duplicates", meshDataA, 5, 0, 0, 0);
    // add a forward dup ...
    meshDataA.indexedMesh.pointIndex.push(1, 2, 5, 4, 0);
    testDuplicateFacetCounts(ck, "Single Quad Duplicate", meshDataA, 4, 1, 1, 0);
    // add reverse of the tri ..
    meshDataA.indexedMesh.pointIndex.push(6, 10, 3, 0);
    testDuplicateFacetCounts(ck, "Reversed Triangle Duplicate", meshDataA, 3, 2, 2, 0);
    // and again ..
    meshDataA.indexedMesh.pointIndex.push(6, 10, 3, 0);
    testDuplicateFacetCounts(ck, "Additional Triangle Duplicate", meshDataA, 3, 2, 1, 1);
    expect(ck.getNumErrors()).equals(0);
  });

  it("XYBoundaryHoles", () => {
    const ck = new Checker();
    const y0 = 0;
    let x0 = 0.0;
    // const xStep = 15.0;
    // const yStep = 10.0;
    const allGeometry: GeometryQuery[] = [];
    const rectangleA = Sample.createRectangle(0, 0, 10, 8, 0, true);
    const rectangleC = Sample.createRectangle(3, -1, 5, 5, 0, true);
    const rectangleD = Sample.createRectangle(10, 3, 12, 5, 0, true);
    const rectangleE = Sample.createRectangle(6.5, -1, 9, 5, 0, true);
    const rectangleZ = Sample.createRectangle(2, 2, 6, 6, 0, true);

    exerciseMultiUnionDiff(ck, allGeometry, [rectangleA, rectangleC], [], x0 += 20, y0);
    exerciseMultiUnionDiff(ck, allGeometry, [[rectangleA, rectangleZ]], [], x0 += 20, y0);
    exerciseMultiUnionDiff(ck, allGeometry, [[rectangleA, rectangleZ], rectangleC], [], x0 += 20, y0);
    exerciseMultiUnionDiff(ck, allGeometry, [[rectangleA, rectangleZ], rectangleD], [], x0 += 20, y0);

    exerciseMultiUnionDiff(ck, allGeometry, [[rectangleA, rectangleZ]], [rectangleC], x0 += 20, y0);
    exerciseMultiUnionDiff(ck, allGeometry, [[rectangleA, rectangleZ]], [rectangleC, rectangleE], x0 += 20, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "MarkVisibility", "XYBoundaryHoles");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ComputeNormals", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const solids = Sample.createClosedSolidSampler(true);
    const creaseAngle1 = Angle.createDegrees(20);
    const creaseAngle2 = Angle.createDegrees(45);
    const defaultOptions = StrokeOptions.createForFacets();
    const triangulatedOptions = StrokeOptions.createForFacets();
    triangulatedOptions.shouldTriangulate = true;
    // REMARK: (EDL Oct 2020) Mutter and grumble.  The builder does not observe shouldTriangulate !!!
    for (const solid of solids) {
      for (const options of [defaultOptions]) {
        const builder = PolyfaceBuilder.create(options);
        builder.addGeometryQuery(solid);
        const mesh = builder.claimPolyface();
        ck.testUndefined(mesh.data.normalIndex);
        ck.testUndefined(mesh.data.normal);
        let y0 = 0;
        if (ck.testType(mesh, IndexedPolyface)) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
          y0 += 10.0;
          PolyfaceQuery.buildPerFaceNormals(mesh);
          ck.testDefined(mesh.data.normalIndex);
          ck.testDefined(mesh.data.normal);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
          y0 += 10.0;
          PolyfaceQuery.buildAverageNormals(mesh, creaseAngle1);
          ck.testDefined(mesh.data.normalIndex);
          ck.testDefined(mesh.data.normal);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
          mesh.data.normalIndex = undefined;
          mesh.data.normal = undefined;
          y0 += 10.0;
          PolyfaceQuery.buildAverageNormals(mesh, creaseAngle2);
          ck.testDefined(mesh.data.normalIndex);
          ck.testDefined(mesh.data.normal);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
        }
        x0 += 20;
      }
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "ComputeNormals");

    expect(ck.getNumErrors()).equals(0);
  });

  it.only("null normal", () => {
    const json = `
      {
  "param": [
    [
      -71.78394226445462,
      -4.319436384751135
    ],
    [
      -71.78394226445462,
      1.117933783903647e-14
    ],
    [
      -65.0600406042341,
      -6.299212598425174
    ],
    [
      -65.0600406042341,
      -0.6770388293142826
    ],
    [
      -62.97356427013375,
      -6.299212598425197
    ],
    [
      -62.981774819362556,
      -0.6770388293142826
    ],
    [
      -62.97356427013375,
      -1.1984244958920085e-14
    ],
    [
      -62.981774819362556,
      4.062232975885713
    ],
    [
      -62.98049851044618,
      4.062232975885713
    ],
    [
      -65.0600406042341,
      29.81089709703083
    ],
    [
      -62.97766954474815,
      14.566929133858196
    ],
    [
      -61.58813735391908,
      2.5155030819971977
    ],
    [
      -62.97356427013375,
      25.07162529183078
    ],
    [
      -62.97356427013375,
      29.81089709703083
    ],
    [
      -56.9351972925848,
      -6.299212598425197
    ],
    [
      -56.9351972925848,
      4.062232975885713
    ],
    [
      -56.9351972925848,
      25.07162529183078
    ],
    [
      -50.88989607472348,
      -14.17322834645668
    ],
    [
      -50.88989607472348,
      -10.23622047244094
    ],
    [
      -50.88989607472348,
      -6.299212598425197
    ],
    [
      -50.88989607472348,
      4.062232975885713
    ],
    [
      -50.88989607472348,
      25.07162529183078
    ],
    [
      -42.734638159169634,
      -14.17322834645668
    ],
    [
      -42.734638159169634,
      -6.299212598425197
    ],
    [
      -42.73463815916963,
      0.4394137713729904
    ],
    [
      -42.734638159169634,
      4.062232975885713
    ],
    [
      -42.73463815916963,
      7.292541735425537
    ],
    [
      -42.734638159169634,
      7.538834481035629
    ],
    [
      -42.734638159169634,
      21.594515408387405
    ],
    [
      -42.734638159169634,
      25.07162529183078
    ],
    [
      -29.791972671963805,
      -6.298744646664404
    ],
    [
      -30.36498651441579,
      2.5155030819971977
    ],
    [
      -29.791972671963805,
      0.00046795158691492365
    ],
    [
      -28.8852788191233,
      -3.937007874015753
    ],
    [
      -29.114933873216362,
      0.00046795007534582877
    ],
    [
      -28.921683566033494,
      0
    ],
    [
      -28.8852788191233,
      -1.1984244958920083e-14
    ],
    [
      -28.921683566033494,
      2.7081553172571446
    ],
    [
      -28.921683566033494,
      4.062232975885713
    ],
    [
      -26.6995791426464,
      -3.1901220725420814
    ],
    [
      -26.425702950459364,
      -3.937007874015741
    ],
    [
      -28.8852788191233,
      25.07162529183078
    ],
    [
      -28.8852788191233,
      26.425702950459364
    ],
    [
      -26.759730550412545,
      2.7573795318823855
    ],
    [
      -26.759730550412534,
      3.2203537549009837
    ],
    [
      -26.425702950459364,
      0
    ],
    [
      -25.07162529183078,
      -14.173228346456668
    ],
    [
      -26.878882230929285,
      7.052127765322035
    ],
    [
      -26.878882230929285,
      7.755818249174255
    ],
    [
      -25.071625291830777,
      -6.299212598425184
    ],
    [
      -25.05270108073169,
      -6.298744657245387
    ],
    [
      -25.07162529183078,
      -3.937007874015741
    ],
    [
      -25.071625291830777,
      -2.7422946558651984
    ],
    [
      -25.071625291830777,
      1.79890405838957e-15
    ],
    [
      -25.05270108073169,
      0.00046794100593125943
    ],
    [
      -26.878882230929275,
      34.0690892153403
    ],
    [
      -26.878882230929314,
      34.155938292337815
    ],
    [
      -26.878882230929275,
      34.466125785224776
    ],
    [
      -26.87888223092931,
      35.35225269250951
    ],
    [
      -26.759730550412584,
      34.27344545042695
    ],
    [
      -23.924290681077263,
      2.7573795318823686
    ],
    [
      -23.924290681077245,
      3.220353754900981
    ],
    [
      -26.759730550412574,
      35.23474553442037
    ],
    [
      -23.805139000560537,
      7.052127765322042
    ],
    [
      -23.805139000560537,
      7.755818249174122
    ],
    [
      -21.594515408387405,
      -12.204724409448797
    ],
    [
      -21.594515408387412,
      -9.970867622522698
    ],
    [
      -23.924290681077302,
      34.273445450426934
    ],
    [
      -23.924290681077284,
      35.23474553442036
    ],
    [
      -23.80513900056052,
      34.0690892153403
    ],
    [
      -23.805139000560565,
      34.15593829233781
    ],
    [
      -23.80513900056052,
      34.466125785224776
    ],
    [
      -23.805139000560555,
      35.3522526925095
    ],
    [
      -17.946409953031562,
      -6.299212598425184
    ],
    [
      -17.848336753464388,
      -5.331814012374066
    ],
    [
      -17.946409953031562,
      -2.742294655865202
    ],
    [
      -17.521237919843834,
      -4.3770453405861165
    ],
    [
      -16.99280782468447,
      -3.5532691908883205
    ],
    [
      -16.29905810569938,
      -2.916624546528121
    ],
    [
      -15.487266659761787,
      -2.510497687913647
    ],
    [
      -14.612755732363546,
      -2.3625654893031065
    ],
    [
      -13.735121798009203,
      -2.4829092855622914
    ],
    [
      -12.914174158966354,
      -2.863327845853666
    ],
    [
      -12.205859040155651,
      -3.4778962739647685
    ],
    [
      -11.658446946377964,
      -4.284732747142174
    ],
    [
      -11.30924310718298,
      -5.228852693099155
    ],
    [
      -11.187448314684929,
      -6.299212598425184
    ],
    [
      -11.182045187125215,
      -6.245915897750729
    ],
    [
      -11.187448314684929,
      -2.742294655865205
    ],
    [
      -9.468232894426265,
      0
    ],
    [
      -9.022905302921885,
      -3.1901220725420814
    ],
    [
      -9.468232894426265,
      2.7081553172571446
    ],
    [
      -9.022905302921885,
      0
    ],
    [
      -7.538834481035629,
      -12.204724409448797
    ],
    [
      -7.5388344810356465,
      -9.970867622522697
    ],
    [
      -4.062232975885713,
      -14.173228346456668
    ],
    [
      -5.251180248933076,
      2.7572412590926794
    ],
    [
      -5.251180248933066,
      3.220215482111308
    ],
    [
      -4.1685965724872185,
      -7.489247480827442
    ],
    [
      -4.168596572487218,
      -6.299212598425186
    ],
    [
      -5.362679618347943,
      7.052127765323696
    ],
    [
      -5.362679618347956,
      7.7558182491750145
    ],
    [
      -4.062232975885711,
      -6.299212598425184
    ],
    [
      -4.043307246107656,
      -6.298744643148069
    ],
    [
      -4.062232975885713,
      -3.937007874015741
    ],
    [
      -4.06223297588571,
      -2.7422946558652006
    ],
    [
      -4.168596572487218,
      0
    ],
    [
      -4.062232975885711,
      1.79890405838957e-15
    ],
    [
      -4.043307246107656,
      0.0004679551032490095
    ],
    [
      -4.168596572487218,
      4.062232975885713
    ],
    [
      -2.7081553172571446,
      -3.937007874015741
    ],
    [
      -2.7081553172571446,
      0
    ],
    [
      -5.36267961834791,
      34.06908921534054
    ],
    [
      -5.3626796183479515,
      34.15593829234082
    ],
    [
      -5.362679618347911,
      34.466125785225024
    ],
    [
      -5.362679618347943,
      35.35225269251256
    ],
    [
      -5.251180248933107,
      34.26589875594358
    ],
    [
      -2.4004357573939936,
      2.757241259092705
    ],
    [
      -2.400435757393984,
      3.220215482111305
    ],
    [
      -5.251180248933099,
      35.2422922289098
    ],
    [
      -4.168596572487203,
      25.07162529183078
    ],
    [
      -2.288936387979166,
      7.052127765323755
    ],
    [
      -2.28893638797919,
      7.755818249174958
    ],
    [
      -1.4788082876047504e-15,
      -14.342117520143098
    ],
    [
      -0.6770388293142826,
      -4.319436384751146
    ],
    [
      -0.6770388293142862,
      0
    ],
    [
      0,
      -3.937007874015741
    ],
    [
      0,
      0
    ],
    [
      0.018925546376971126,
      0.00046794603383444014
    ],
    [
      -1.1469423770639206e-14,
      0.4394137713729904
    ],
    [
      0,
      0.5905511811015209
    ],
    [
      0.695964345124406,
      -6.298744653729053
    ],
    [
      0,
      2.7081553172571446
    ],
    [
      0,
      4.062232975885713
    ],
    [
      -2.400435757394029,
      34.26589875594358
    ],
    [
      0,
      7.5388344810356465
    ],
    [
      0.6959643451244095,
      0.00046794452226534526
    ],
    [
      -2.400435757394017,
      35.24229222890979
    ],
    [
      -2.2889363879791405,
      34.06908921534054
    ],
    [
      -2.2889363879791853,
      34.15593829234082
    ],
    [
      -2.2889363879791413,
      34.46612578522502
    ],
    [
      -2.2889363879791733,
      35.35225269251255
    ],
    [
      0,
      10.010435603566865
    ],
    [
      -1.6003559153179088,
      34.33682360699721
    ],
    [
      -1.5930873221929756,
      34.44654357377508
    ],
    [
      -1.5925884715170149,
      34.45407376272834
    ],
    [
      -1.5290447308658308,
      35.41327136724465
    ],
    [
      -1.5285458801895726,
      35.42080155619819
    ],
    [
      -1.5212772870649791,
      35.53052152297587
    ],
    [
      1.4210854715202004e-14,
      19.123422664149626
    ],
    [
      -1.4237820282286895,
      35.915401650197424
    ],
    [
      -1.4210854715202004e-14,
      21.594515408387412
    ],
    [
      -1.1306425022888686,
      34.4244094434884
    ],
    [
      -1.1301436516129222,
      34.4319396324414
    ],
    [
      -1.0665999109617523,
      35.391137236957704
    ],
    [
      -1.0661010602854515,
      35.39866742591151
    ],
    [
      -0.9081627642289509,
      34.21013920128951
    ],
    [
      1.4210854715202004e-14,
      25.07162529183078
    ],
    [
      2.7081553172571446,
      -3.937007874015741
    ],
    [
      -1.4210854715202004e-14,
      26.425702950459364
    ],
    [
      2.400435757393998,
      2.7751310291834788
    ],
    [
      -0.5181817288838351,
      35.74965971017575
    ],
    [
      2.4004357573939856,
      3.238105252202107
    ],
    [
      2.7081553172571446,
      0
    ],
    [
      4.062232975885713,
      -14.173228346456668
    ],
    [
      2.2889363879791476,
      6.945676189384606
    ],
    [
      2.288936387979145,
      7.866318515619822
    ],
    [
      4.062232975885713,
      -10.236220472440927
    ],
    [
      3.1901220725420814,
      0
    ],
    [
      3.1901220725420814,
      0.5905511811015209
    ],
    [
      4.062232975885713,
      -6.299212598425186
    ],
    [
      4.168596572487205,
      -6.299212598425197
    ],
    [
      4.062232975885713,
      -3.937007874015741
    ],
    [
      0.518181728884088,
      35.74965971017592
    ],
    [
      0.9081627642292038,
      34.210139201289685
    ],
    [
      4.062232975885713,
      0
    ],
    [
      4.168596572487205,
      -1.1984244958920083e-14
    ],
    [
      1.1306425022887776,
      34.42440944348841
    ],
    [
      1.1301436516128394,
      34.431939632441235
    ],
    [
      1.0665999109617974,
      35.391137236957555
    ],
    [
      1.066101060285531,
      35.398667425911526
    ],
    [
      1.4237820282289992,
      35.915401650197595
    ],
    [
      1.6003559153174085,
      34.33682360699727
    ],
    [
      1.5930873221928987,
      34.44654357377509
    ],
    [
      1.5925884715169463,
      34.45407376272818
    ],
    [
      1.52904473086589,
      35.4132713672445
    ],
    [
      1.5285458801896237,
      35.42080155619821
    ],
    [
      1.5212772870652747,
      35.53052152297603
    ],
    [
      -0.6770388293142826,
      60.63172269054629
    ],
    [
      4.168596572487206,
      7.292541735425534
    ],
    [
      -0.6770388293142826,
      67.64102846162989
    ],
    [
      5.251180248933084,
      2.7751310291836377
    ],
    [
      5.251180248933064,
      3.238105252202253
    ],
    [
      5.362679618347917,
      6.9456761893846135
    ],
    [
      5.362679618347915,
      7.8663185156198026
    ],
    [
      4.062232975885713,
      37.05775556501035
    ],
    [
      4.062232975885713,
      44.27202599345546
    ],
    [
      9.022905302921885,
      -3.1901220725420814
    ],
    [
      9.022905302921885,
      0
    ],
    [
      9.022905302921885,
      0.5905511811015209
    ],
    [
      9.468232894426265,
      0
    ],
    [
      12.642873237803732,
      3.712875164396655e-15
    ],
    [
      12.642873237803732,
      0.5905511811015246
    ],
    [
      16.53062669014053,
      3.712875164396657e-15
    ],
    [
      16.53062669014053,
      0.5905511811015246
    ],
    [
      25.07162529183078,
      -14.173228346456668
    ],
    [
      25.07162529183078,
      -10.236220472440927
    ],
    [
      23.92429068107722,
      2.7749927564363874
    ],
    [
      23.92429068107717,
      3.237966979455015
    ],
    [
      23.805139000560533,
      6.945676189385387
    ],
    [
      25.07162529183078,
      -6.299212598425186
    ],
    [
      23.805139000560526,
      7.866318515620521
    ],
    [
      25.07162529183078,
      -3.937007874015741
    ],
    [
      25.07162529183078,
      0
    ],
    [
      26.425702950459364,
      -3.937007874015741
    ],
    [
      26.6995791426464,
      -3.1901220725420814
    ],
    [
      26.425702950459364,
      0
    ],
    [
      26.6995791426464,
      0
    ],
    [
      26.6995791426464,
      0.5905511811015209
    ],
    [
      26.75973055041248,
      2.7749927564366956
    ],
    [
      26.759730550412453,
      3.237966979455309
    ],
    [
      26.878882230929282,
      6.945676189385387
    ],
    [
      26.878882230929282,
      7.866318515620521
    ],
    [
      25.07162529183078,
      37.05775556501035
    ],
    [
      28.921683566033494,
      -3.937007874015741
    ],
    [
      28.921683566033494,
      0
    ],
    [
      25.07162529183078,
      44.27202599345546
    ],
    [
      29.81089709703083,
      -4.319436384751146
    ],
    [
      29.81089709703083,
      0
    ],
    [
      30.401391261325955,
      2.5155030819972097
    ],
    [
      29.81089709703083,
      60.63172269054629
    ],
    [
      29.81089709703083,
      67.64102846162989
    ],
    [
      42.734638159169634,
      -14.342117520143095
    ],
    [
      42.734638159169634,
      -14.173228346456668
    ],
    [
      42.734638159169634,
      -7.489247480827446
    ],
    [
      42.734638159169634,
      -6.299212598425186
    ],
    [
      50.88989607472348,
      -14.173228346456668
    ],
    [
      50.88989607472348,
      -10.236220472440927
    ],
    [
      50.88989607472348,
      -6.299212598425186
    ],
    [
      56.9351972925848,
      -6.299212598425186
    ],
    [
      61.592242628533484,
      2.5155030819972097
    ],
    [
      62.98049851044618,
      -6.299212598425186
    ],
    [
      62.981774819362556,
      -6.299212598425186
    ],
    [
      62.981774819362556,
      -0.6770388293142862
    ],
    [
      62.981774819362556,
      0
    ],
    [
      65.0600406042341,
      -6.299212598425186
    ],
    [
      62.97356427013375,
      29.133858267716537
    ],
    [
      62.97356427013375,
      29.81089709703083
    ],
    [
      70.85758747056857,
      0
    ],
    [
      71.78394226445462,
      -4.319436384751146
    ],
    [
      71.78394226445462,
      -0.6770388293142862
    ],
    [
      71.78394226445462,
      3.094777000749971e-16
    ],
    [
      70.85758747056857,
      29.133858267716537
    ],
    [
      71.78394226445462,
      29.81089709703083
    ]
  ],
  "paramIndex": [
    183,
    174,
    175,
    0,
    174,
    183,
    188,
    0,
    174,
    188,
    182,
    0,
    162,
    144,
    157,
    0,
    144,
    162,
    149,
    0,
    149,
    162,
    151,
    0,
    73,
    69,
    71,
    0,
    69,
    73,
    59,
    0,
    69,
    59,
    63,
    0,
    63,
    59,
    60,
    0,
    71,
    68,
    57,
    0,
    68,
    71,
    69,
    0,
    57,
    68,
    60,
    0,
    57,
    60,
    59,
    0,
    210,
    223,
    212,
    0,
    223,
    210,
    222,
    0,
    58,
    70,
    72,
    0,
    70,
    58,
    56,
    0,
    142,
    138,
    140,
    0,
    138,
    142,
    116,
    0,
    138,
    116,
    120,
    0,
    120,
    116,
    117,
    0,
    140,
    135,
    114,
    0,
    135,
    140,
    138,
    0,
    114,
    135,
    117,
    0,
    114,
    117,
    116,
    0,
    166,
    195,
    167,
    0,
    195,
    166,
    194,
    0,
    115,
    139,
    141,
    0,
    139,
    115,
    113,
    0,
    48,
    65,
    49,
    0,
    65,
    48,
    64,
    0,
    162,
    144,
    157,
    0,
    144,
    162,
    149,
    0,
    149,
    162,
    151,
    0,
    101,
    123,
    102,
    0,
    123,
    101,
    122,
    0,
    183,
    174,
    175,
    0,
    174,
    183,
    188,
    0,
    174,
    188,
    182,
    0,
    184,
    181,
    178,
    0,
    181,
    184,
    187,
    0,
    98,
    118,
    119,
    0,
    118,
    98,
    97,
    0,
    156,
    145,
    153,
    0,
    145,
    156,
    148,
    0,
    163,
    192,
    193,
    0,
    192,
    163,
    161,
    0,
    185,
    180,
    179,
    0,
    180,
    185,
    186,
    0,
    45,
    61,
    62,
    0,
    61,
    45,
    44,
    0,
    155,
    146,
    154,
    0,
    146,
    155,
    147,
    0,
    209,
    220,
    221,
    0,
    220,
    209,
    208,
    0,
    128,
    34,
    127,
    0,
    34,
    128,
    37,
    0,
    43,
    158,
    160,
    0,
    158,
    43,
    42,
    0,
    46,
    52,
    54,
    0,
    52,
    46,
    41,
    0,
    250,
    243,
    246,
    0,
    243,
    250,
    245,
    0,
    245,
    250,
    252,
    0,
    7,
    3,
    5,
    0,
    3,
    7,
    1,
    0,
    1,
    7,
    2,
    0,
    125,
    229,
    126,
    0,
    229,
    125,
    228,
    0,
    251,
    245,
    244,
    0,
    245,
    251,
    249,
    0,
    249,
    251,
    253,
    0,
    253,
    248,
    247,
    0,
    248,
    253,
    254,
    0,
    254,
    253,
    251,
    0,
    10,
    11,
    14,
    0,
    11,
    10,
    8,
    0,
    8,
    10,
    6,
    0,
    6,
    10,
    4,
    0,
    6,
    9,
    8,
    0,
    232,
    189,
    231,
    0,
    189,
    232,
    191,
    0,
    215,
    214,
    213,
    0,
    214,
    215,
    217,
    0,
    39,
    133,
    134,
    0,
    133,
    39,
    38,
    0,
    8,
    9,
    11,
    0,
    100,
    127,
    107,
    0,
    127,
    100,
    225,
    0,
    107,
    127,
    128,
    0,
    245,
    242,
    243,
    0,
    242,
    245,
    240,
    0,
    240,
    245,
    239,
    0,
    239,
    245,
    236,
    0,
    236,
    245,
    225,
    0,
    236,
    225,
    100,
    0,
    225,
    245,
    226,
    0,
    226,
    245,
    241,
    0,
    226,
    241,
    230,
    0,
    238,
    234,
    237,
    0,
    234,
    238,
    236,
    0,
    236,
    238,
    239,
    0,
    35,
    51,
    55,
    0,
    51,
    35,
    31,
    0,
    31,
    35,
    33,
    0,
    129,
    132,
    137,
    0,
    132,
    129,
    104,
    0,
    104,
    129,
    109,
    0,
    13,
    16,
    17,
    0,
    16,
    13,
    9,
    0,
    9,
    13,
    11,
    0,
    22,
    26,
    30,
    0,
    26,
    22,
    21,
    0,
    206,
    168,
    165,
    0,
    168,
    206,
    207,
    0,
    94,
    96,
    103,
    0,
    96,
    94,
    47,
    0,
    47,
    94,
    66,
    0,
    47,
    66,
    50,
    0,
    17,
    21,
    22,
    0,
    21,
    17,
    16,
    0,
    207,
    171,
    168,
    0,
    171,
    207,
    211,
    0,
    227,
    196,
    224,
    0,
    196,
    227,
    197,
    0,
    152,
    28,
    136,
    0,
    28,
    152,
    29,
    0,
    235,
    124,
    233,
    0,
    124,
    235,
    99,
    0,
    190,
    25,
    130,
    0,
    25,
    190,
    27,
    0,
    89,
    95,
    106,
    0,
    95,
    89,
    67,
    0,
    67,
    89,
    76,
    0,
    67,
    76,
    53,
    0,
    108,
    111,
    112,
    0,
    111,
    108,
    105,
    0,
    134,
    121,
    110,
    0,
    121,
    134,
    143,
    0,
    121,
    143,
    158,
    0,
    158,
    143,
    150,
    0,
    24,
    18,
    23,
    0,
    18,
    24,
    19,
    0,
    19,
    24,
    20,
    0,
    172,
    127,
    24,
    0,
    127,
    172,
    177,
    0,
    24,
    127,
    20,
    0,
    20,
    127,
    15,
    0,
    15,
    127,
    5,
    0,
    127,
    177,
    128,
    0,
    5,
    34,
    7,
    0,
    34,
    5,
    127,
    0,
    7,
    34,
    37,
    0,
    7,
    37,
    32,
    0,
    7,
    32,
    12,
    0,
    108,
    82,
    103,
    0,
    82,
    108,
    54,
    0,
    103,
    82,
    83,
    0,
    103,
    83,
    84,
    0,
    103,
    84,
    85,
    0,
    103,
    85,
    86,
    0,
    103,
    86,
    88,
    0,
    82,
    54,
    81,
    0,
    81,
    54,
    80,
    0,
    80,
    54,
    79,
    0,
    79,
    54,
    78,
    0,
    78,
    54,
    77,
    0,
    77,
    54,
    75,
    0,
    75,
    54,
    74,
    0,
    74,
    54,
    50,
    0,
    87,
    103,
    88,
    0,
    226,
    127,
    225,
    0,
    127,
    226,
    128,
    0,
    128,
    226,
    201,
    0,
    38,
    90,
    92,
    0,
    90,
    38,
    40,
    0,
    40,
    38,
    36,
    0,
    90,
    91,
    93,
    0,
    91,
    90,
    40,
    0,
    219,
    199,
    218,
    0,
    199,
    219,
    200,
    0,
    173,
    164,
    159,
    0,
    164,
    173,
    176,
    0,
    131,
    169,
    170,
    0,
    169,
    131,
    128,
    0,
    216,
    199,
    198,
    0,
    199,
    216,
    226,
    0,
    204,
    203,
    202,
    0,
    203,
    204,
    205,
    0
  ],
  "point": [
    [
      2.2773364953887225,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      2.277336495388723,
      0.8193987316789585,
      0.5061962997578275
    ],
    [
      2.277336495388723,
      0.8192391211123036,
      0.5075500359549587
    ],
    [
      2.277336495388723,
      0.8229965989570112,
      0.5333834413531087
    ],
    [
      2.2773364953887225,
      0.6089169976840052,
      0.6661962997578272
    ],
    [
      2.277336495388723,
      0.833312221165819,
      0.557364087980416
    ],
    [
      2.277336495388723,
      0.8494829951325681,
      0.577857734399122
    ],
    [
      2.277336495388723,
      1.0190611836890504,
      0.5061962997578275
    ],
    [
      2.277336495388723,
      0.8704069093348921,
      0.5934677724731441
    ],
    [
      2.277336495388723,
      1.016164061830722,
      0.530768223843526
    ],
    [
      2.277336495388723,
      0.8946580335983059,
      0.603130403904545
    ],
    [
      2.277336495388723,
      1.0065014303993212,
      0.5550193481069399
    ],
    [
      2.277336495388723,
      0.9205836938811355,
      0.6061871363295283
    ],
    [
      2.277336495388723,
      0.9908913923252991,
      0.5759432623092638
    ],
    [
      2.277336495388723,
      0.9464170992792854,
      0.6024296584848206
    ],
    [
      2.277336495388723,
      0.9703977459065929,
      0.5921140362760129
    ],
    [
      2.277336495388723,
      1.2295429176840034,
      0.5061962997578275
    ],
    [
      2.277336495388723,
      1.2295429176840034,
      0.6661962997578272
    ],
    [
      2.3673364953887215,
      0.711617207911861,
      0.3561962997578278
    ],
    [
      2.3673364953887215,
      0.5689169976840054,
      0.5661962997578274
    ],
    [
      2.3673364953887215,
      0.6089169976840052,
      0.5661962997578274
    ],
    [
      2.3673364953887215,
      0.5689169976840054,
      0.6661962997578272
    ],
    [
      2.367336495388722,
      1.1268276897563814,
      0.3561962997578278
    ],
    [
      2.3673364953887215,
      0.6089169976840052,
      0.6661962997578272
    ],
    [
      2.3673364953887215,
      0.7846293016210057,
      0.6661962997578272
    ],
    [
      2.367336495388722,
      1.2295429176840034,
      0.5661962997578274
    ],
    [
      2.367336495388722,
      1.053830613747003,
      0.6661962997578272
    ],
    [
      2.367336495388722,
      1.2695429176840038,
      0.5661962997578274
    ],
    [
      2.367336495388722,
      1.2295429176840034,
      0.6661962997578272
    ],
    [
      2.367336495388722,
      1.2695429176840038,
      0.6661962997578272
    ],
    [
      2.3327848111770213,
      0.5565331014840614,
      1.5383516193755584
    ],
    [
      2.332941740102576,
      0.5598268378131217,
      1.5411385065317151
    ],
    [
      2.3343351898354268,
      0.5598268378131214,
      1.5658846592852624
    ],
    [
      2.334492118760982,
      0.5565331014840611,
      1.5686715464414192
    ],
    [
      2.3327848111770186,
      0.6473327158424251,
      1.5383516193755586
    ],
    [
      2.332941740102574,
      0.644038979513365,
      1.5411385065317154
    ],
    [
      2.3365970413992567,
      0.5565331014840611,
      1.5784475016728465
    ],
    [
      2.334335189835427,
      0.6440389795133648,
      1.5658846592852624
    ],
    [
      2.342925923764306,
      0.5598268378131219,
      1.5405762996224335
    ],
    [
      2.3344921187609824,
      0.6473327158424249,
      1.5686715464414192
    ],
    [
      2.3365970413992576,
      0.6473327158424249,
      1.578447501672847
    ],
    [
      2.347729261309013,
      0.5565331014840611,
      1.5351338354705861
    ],
    [
      2.3443193734971564,
      0.5598268378131216,
      1.5653224523759808
    ],
    [
      2.3429259237643034,
      0.6440389795133654,
      1.5405762996224337
    ],
    [
      2.3443193734971572,
      0.644038979513365,
      1.5653224523759808
    ],
    [
      2.347729261309013,
      0.6473327158424251,
      1.535133835470586
    ],
    [
      2.356148951862114,
      0.5565331014840611,
      1.5742376563962965
    ],
    [
      2.356148951862114,
      0.6473327158424249,
      1.5742376563962963
    ],
    [
      2.332784811177002,
      1.1921304019926078,
      1.5383516193755606
    ],
    [
      2.3329525102886643,
      1.1956501906770298,
      1.5413297733311326
    ],
    [
      2.3343244196493202,
      1.1956501906770294,
      1.565693392485847
    ],
    [
      2.334492118760983,
      1.1921304019926076,
      1.5686715464414187
    ],
    [
      2.332784811176999,
      1.2829300163509711,
      1.538351619375561
    ],
    [
      2.3329525102886617,
      1.279410227666549,
      1.5413297733311329
    ],
    [
      2.3365970413992585,
      1.1921304019926076,
      1.5784475016728463
    ],
    [
      2.3343244196493207,
      1.279410227666549,
      1.565693392485847
    ],
    [
      2.342936693950394,
      1.1956501906770303,
      1.540767566421844
    ],
    [
      2.3344921187609833,
      1.2829300163509711,
      1.5686715464414187
    ],
    [
      2.3365970413992585,
      1.2829300163509711,
      1.5784475016728463
    ],
    [
      2.347729261309013,
      1.1921304019926078,
      1.5351338354705852
    ],
    [
      2.34430860331105,
      1.1956501906770298,
      1.5651311855765586
    ],
    [
      2.342936693950391,
      1.279410227666549,
      1.5407675664218445
    ],
    [
      2.34430860331105,
      1.279410227666549,
      1.5651311855765586
    ],
    [
      2.347729261309013,
      1.2829300163509711,
      1.5351338354705852
    ],
    [
      2.3561489518621137,
      1.1921304019926078,
      1.5742376563962956
    ],
    [
      2.3561489518621137,
      1.2829300163509711,
      1.5742376563962956
    ],
    [
      2.562141020878805,
      0.39467950540389296,
      0.6661962997578272
    ],
    [
      2.562141020878805,
      0.39467950540389296,
      0.6811962997578058
    ],
    [
      2.562141020878805,
      0.48891699768400554,
      0.6661962997578272
    ],
    [
      2.562141020878805,
      0.48891699768400554,
      0.6811962997578058
    ],
    [
      2.5717556435793845,
      0.48891699768400554,
      0.6661962997578272
    ],
    [
      2.5717556435793845,
      0.5689169976840054,
      0.6661962997578272
    ],
    [
      2.943780409078457,
      0.39467950540389296,
      0.6661962997578272
    ],
    [
      2.943780409078457,
      0.39467950540389296,
      0.6811962997578058
    ],
    [
      2.9917556435793844,
      0.5689169976840054,
      0.5661962997578274
    ],
    [
      2.9917556435793844,
      0.6089169976840052,
      0.5661962997578274
    ],
    [
      2.9917556435793844,
      0.48891699768400554,
      0.6661962997578272
    ],
    [
      2.9917556435793844,
      0.48891699768400554,
      0.6811962997578058
    ],
    [
      2.9917556435793844,
      0.5689169976840054,
      0.6661962997578272
    ],
    [
      2.9917556435793844,
      0.6089169976840052,
      0.6661962997578272
    ],
    [
      2.9909696650935933,
      1.2295429176840034,
      0.5661962997578274
    ],
    [
      2.9909696650935933,
      1.2695429176840038,
      0.5661962997578274
    ],
    [
      3.023702532720749,
      0.6089169976840052,
      0.7300900780405564
    ],
    [
      2.9909696650935933,
      1.2295429176840034,
      0.6661962997578272
    ],
    [
      2.9909696650935933,
      1.2695429176840038,
      0.6661962997578272
    ],
    [
      3.0229165542349583,
      1.2295429176840034,
      0.7300900780405564
    ],
    [
      3.2899773332451936,
      0.6089169976840052,
      0.3061962997578279
    ],
    [
      3.2899773332451936,
      0.7116172079118604,
      0.3561962997578278
    ],
    [
      3.2899773332451936,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      3.2899773332451936,
      1.1268276897563814,
      0.3561962997578278
    ],
    [
      3.2899773332451936,
      1.2295429176840034,
      0.3061962997578279
    ],
    [
      3.2899773332451936,
      1.2295429176840034,
      0.5061962997578275
    ],
    [
      3.4660493516420012,
      0.6089169976840052,
      0.3061962997578279
    ],
    [
      3.4660493516420012,
      0.6089169976840052,
      0.40619629975782773
    ],
    [
      3.4660493516420012,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      3.4660493516420012,
      1.2295429176840034,
      0.3061962997578279
    ],
    [
      3.4660493516420012,
      1.2295429176840034,
      0.40619629975782773
    ],
    [
      3.4660493516420012,
      1.2295429176840034,
      0.5061962997578275
    ],
    [
      3.5965674049356275,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      3.5965674049356275,
      1.2295429176840034,
      0.5061962997578275
    ],
    [
      3.7271130137387587,
      0.4689169976840057,
      0.5061962997578275
    ],
    [
      3.6971130137387593,
      0.6089169976840052,
      0.7300900780405564
    ],
    [
      3.7270854582292543,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      3.7271130137387587,
      0.6089169976840052,
      0.5061962997578275
    ],
    [
      3.7271130137387587,
      0.4689169976840056,
      0.6661962997578272
    ],
    [
      3.7271130137387587,
      0.48891699768400554,
      0.6661962997578272
    ],
    [
      3.7271130137387587,
      0.6089169976840052,
      0.6661962997578272
    ],
    [
      3.727024380859834,
      0.9192299576840028,
      0.5061962997578275
    ],
    [
      3.7719827720341357,
      0.4689169976840057,
      0.5061962997578275
    ],
    [
      3.697024380859834,
      1.2295429176840034,
      0.7300900780405564
    ],
    [
      3.7269357479809093,
      1.2295429176840034,
      0.5061962997578275
    ],
    [
      3.7269357479809093,
      1.3695429176840046,
      0.5061962997578275
    ],
    [
      3.7269357479809093,
      1.2295429176840034,
      0.6661962997578272
    ],
    [
      3.7269357479809093,
      1.3495429176840044,
      0.6661962997578272
    ],
    [
      3.7269357479809093,
      1.3695429176840046,
      0.6661962997578272
    ],
    [
      3.7719827720341357,
      1.3695429176840046,
      0.5061962997578275
    ],
    [
      3.897151808878297,
      0.48891699768400554,
      0.6661962997578272
    ],
    [
      3.9171518088782964,
      0.4689169976840057,
      0.5564826155851481
    ],
    [
      3.9171518088782964,
      0.4689169976840056,
      0.6661962997578272
    ],
    [
      3.897151808878297,
      1.3495429176840044,
      0.6661962997578272
    ],
    [
      3.9171518088782964,
      1.3695429176840046,
      0.5564826155851481
    ],
    [
      3.9171518088782964,
      1.3695429176840046,
      0.6661962997578272
    ]
  ],
  "pointIndex": [
    53,
    66,
    64,
    0,
    66,
    53,
    58,
    0,
    66,
    58,
    59,
    0,
    47,
    31,
    42,
    0,
    31,
    47,
    34,
    0,
    34,
    47,
    37,
    0,
    52,
    51,
    49,
    0,
    51,
    52,
    58,
    0,
    51,
    58,
    56,
    0,
    56,
    58,
    54,
    0,
    49,
    50,
    53,
    0,
    50,
    49,
    51,
    0,
    53,
    50,
    54,
    0,
    53,
    54,
    58,
    0,
    65,
    59,
    55,
    0,
    59,
    65,
    66,
    0,
    59,
    52,
    55,
    0,
    52,
    59,
    58,
    0,
    34,
    33,
    31,
    0,
    33,
    34,
    40,
    0,
    33,
    40,
    38,
    0,
    38,
    40,
    36,
    0,
    31,
    32,
    35,
    0,
    32,
    31,
    33,
    0,
    35,
    32,
    36,
    0,
    35,
    36,
    40,
    0,
    47,
    41,
    37,
    0,
    41,
    47,
    48,
    0,
    41,
    34,
    37,
    0,
    34,
    41,
    40,
    0,
    64,
    49,
    53,
    0,
    49,
    64,
    60,
    0,
    65,
    49,
    60,
    0,
    49,
    65,
    52,
    0,
    52,
    65,
    55,
    0,
    46,
    31,
    35,
    0,
    31,
    46,
    42,
    0,
    35,
    48,
    46,
    0,
    48,
    35,
    40,
    0,
    48,
    40,
    41,
    0,
    32,
    43,
    39,
    0,
    43,
    32,
    33,
    0,
    38,
    43,
    33,
    0,
    43,
    38,
    45,
    0,
    45,
    36,
    44,
    0,
    36,
    45,
    38,
    0,
    32,
    44,
    36,
    0,
    44,
    32,
    39,
    0,
    50,
    61,
    57,
    0,
    61,
    50,
    51,
    0,
    56,
    61,
    51,
    0,
    61,
    56,
    63,
    0,
    63,
    54,
    62,
    0,
    54,
    63,
    56,
    0,
    50,
    62,
    54,
    0,
    62,
    50,
    57,
    0,
    30,
    82,
    28,
    0,
    82,
    30,
    85,
    0,
    82,
    26,
    28,
    0,
    26,
    82,
    81,
    0,
    30,
    26,
    29,
    0,
    26,
    30,
    28,
    0,
    118,
    101,
    109,
    0,
    101,
    118,
    105,
    0,
    105,
    118,
    119,
    0,
    115,
    116,
    112,
    0,
    116,
    115,
    121,
    0,
    121,
    115,
    122,
    0,
    118,
    122,
    119,
    0,
    122,
    118,
    121,
    0,
    119,
    106,
    105,
    0,
    106,
    119,
    117,
    0,
    117,
    119,
    120,
    0,
    120,
    115,
    114,
    0,
    115,
    120,
    122,
    0,
    122,
    120,
    119,
    0,
    116,
    108,
    112,
    0,
    108,
    116,
    104,
    0,
    104,
    116,
    101,
    0,
    101,
    116,
    109,
    0,
    101,
    103,
    104,
    0,
    121,
    109,
    116,
    0,
    109,
    121,
    118,
    0,
    82,
    84,
    81,
    0,
    84,
    82,
    85,
    0,
    76,
    20,
    21,
    0,
    20,
    76,
    75,
    0,
    104,
    103,
    108,
    0,
    1,
    21,
    5,
    0,
    21,
    1,
    76,
    0,
    5,
    21,
    24,
    0,
    107,
    103,
    104,
    0,
    103,
    107,
    99,
    0,
    99,
    107,
    95,
    0,
    95,
    107,
    89,
    0,
    89,
    107,
    76,
    0,
    89,
    76,
    1,
    0,
    76,
    107,
    80,
    0,
    80,
    107,
    102,
    0,
    80,
    102,
    83,
    0,
    94,
    87,
    93,
    0,
    87,
    94,
    89,
    0,
    89,
    94,
    95,
    0,
    114,
    111,
    113,
    0,
    111,
    114,
    112,
    0,
    112,
    114,
    115,
    0,
    106,
    101,
    105,
    0,
    101,
    106,
    104,
    0,
    104,
    106,
    107,
    0,
    111,
    99,
    100,
    0,
    99,
    111,
    103,
    0,
    103,
    111,
    108,
    0,
    96,
    87,
    91,
    0,
    87,
    96,
    93,
    0,
    96,
    94,
    93,
    0,
    94,
    96,
    97,
    0,
    88,
    87,
    89,
    0,
    87,
    88,
    91,
    0,
    91,
    88,
    90,
    0,
    91,
    90,
    92,
    0,
    100,
    95,
    98,
    0,
    95,
    100,
    99,
    0,
    97,
    95,
    94,
    0,
    95,
    97,
    98,
    0,
    100,
    94,
    97,
    0,
    94,
    100,
    99,
    0,
    23,
    88,
    19,
    0,
    88,
    23,
    90,
    0,
    89,
    19,
    88,
    0,
    19,
    89,
    1,
    0,
    17,
    90,
    23,
    0,
    90,
    17,
    92,
    0,
    2,
    19,
    1,
    0,
    19,
    2,
    23,
    0,
    23,
    2,
    8,
    0,
    23,
    8,
    17,
    0,
    24,
    20,
    22,
    0,
    20,
    24,
    21,
    0,
    24,
    18,
    5,
    0,
    18,
    24,
    25,
    0,
    18,
    25,
    29,
    0,
    29,
    25,
    27,
    0,
    92,
    96,
    91,
    0,
    96,
    92,
    97,
    0,
    97,
    92,
    98,
    0,
    17,
    26,
    92,
    0,
    26,
    17,
    18,
    0,
    92,
    26,
    98,
    0,
    98,
    26,
    100,
    0,
    100,
    26,
    111,
    0,
    26,
    18,
    29,
    0,
    111,
    81,
    113,
    0,
    81,
    111,
    26,
    0,
    113,
    81,
    84,
    0,
    113,
    84,
    86,
    0,
    113,
    86,
    110,
    0,
    5,
    11,
    1,
    0,
    11,
    5,
    18,
    0,
    1,
    11,
    9,
    0,
    1,
    9,
    7,
    0,
    1,
    7,
    6,
    0,
    1,
    6,
    4,
    0,
    1,
    4,
    3,
    0,
    11,
    18,
    13,
    0,
    13,
    18,
    15,
    0,
    15,
    18,
    16,
    0,
    16,
    18,
    14,
    0,
    14,
    18,
    12,
    0,
    12,
    18,
    10,
    0,
    10,
    18,
    8,
    0,
    8,
    18,
    17,
    0,
    2,
    1,
    3,
    0,
    79,
    20,
    75,
    0,
    20,
    79,
    22,
    0,
    22,
    79,
    72,
    0,
    79,
    71,
    72,
    0,
    71,
    79,
    73,
    0,
    73,
    79,
    77,
    0,
    71,
    67,
    69,
    0,
    67,
    71,
    73,
    0,
    74,
    67,
    73,
    0,
    67,
    74,
    68,
    0,
    76,
    79,
    75,
    0,
    79,
    76,
    80,
    0,
    70,
    67,
    68,
    0,
    67,
    70,
    69,
    0,
    74,
    70,
    68,
    0,
    70,
    74,
    78,
    0,
    77,
    74,
    73,
    0,
    74,
    77,
    78,
    0
  ],
  "tags": {
    "tagA": 0,
    "tagB": 0
  }
}
    `;
    const pf = IModelJson.Reader.parseIndexedMesh(JSON.parse(json)) as IndexedPolyface;
    expect(pf).not.to.be.undefined;
    expect(pf instanceof IndexedPolyface).to.be.true;
    PolyfaceQuery.buildAverageNormals(pf);
  });
  
  it("isConvex", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const dxB = 5.0;
    const y0 = 0;
    const strokeLength = 10.0;
    const options = StrokeOptions.createForFacets();
    const solids = Sample.createClosedSolidSampler(true);
    for (const solid of solids) {
      const builder = PolyfaceBuilder.create(options);
      builder.addGeometryQuery(solid);
      const meshA = builder.claimPolyface();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, x0, y0);
      const dihedralA = PolyfaceQuery.dihedralAngleSummary(meshA);
      // We don't really know what solids are in the sampler, but ....
      // These types are always convex
      if (solid instanceof Box || solid instanceof Cone || solid instanceof Sphere) {
        ck.testExactNumber(1, dihedralA, "dihedralA should be 1");
      }
      // These types are always mixed
      if (solid instanceof TorusPipe || solid instanceof RotationalSweep)
        ck.testExactNumber(-2, dihedralA, "dihedralA should be -2");
      ck.testBoolean(dihedralA > 0, PolyfaceQuery.isConvexByDihedralAngleCount(meshA), "Dihedral angle counts match closure");
      if (dihedralA !== 0)
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, [Point3d.create(0, 0, 0), Point3d.create(0, dihedralA * strokeLength, 0)], x0, y0,
        );
      else
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, [Point3d.create(0, dxB, 0), Point3d.create(strokeLength, dxB, 0)], x0, y0,
        );
      meshA.reverseIndices();
      const dihedralB = PolyfaceQuery.dihedralAngleSummary(meshA);
      if (dihedralB !== 0)
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, [Point3d.create(dxB, 0, 0), Point3d.create(dxB, dihedralB * strokeLength, 0)], x0, y0,
        );
      else
        GeometryCoreTestIO.captureCloneGeometry(
          allGeometry, [Point3d.create(0, -dxB, 0), Point3d.create(strokeLength, -dxB, 0)], x0, y0,
        );
      if (dihedralA === -2)
        ck.testExactNumber(dihedralA, dihedralB, "both dihedralA and dihedralB should be -2");
      else
        ck.testExactNumber(dihedralA, -dihedralB, "dihedralA should be equal to -dihedralB");
      ck.testBoolean(dihedralB > 0, PolyfaceQuery.isConvexByDihedralAngleCount(meshA), "Dihedral angle counts match closure in reversed mesh");
      x0 += 20;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "isConvex");

    expect(ck.getNumErrors()).equals(0);
  });

  it("isConvexWithBoundary", () => {
    const ck = new Checker();
    const options = StrokeOptions.createForFacets();
    const builder = PolyfaceBuilder.create(options);
    const point00 = Point3d.create(0, 0, 0);
    const point10 = Point3d.create(1, 0, 0);
    const point01 = Point3d.create(0, 1, 0);
    const point111 = Point3d.create(1, 1, -1);
    builder.addPolygon([point00, point10, point01]);
    builder.addPolygon([point01, point10, point111]);
    const polyface = builder.claimPolyface();
    ck.testExactNumber(1, PolyfaceQuery.dihedralAngleSummary(polyface, true), "dihedral with boundary");
    ck.testFalse(PolyfaceQuery.isConvexByDihedralAngleCount(polyface, false), "isConvexByDihedralPairing reject boundary");
    ck.testTrue(PolyfaceQuery.isConvexByDihedralAngleCount(polyface, true), "isConvexByDihedralPairing with boundary");

    expect(ck.getNumErrors()).equals(0);
  });

  it("isConvexWithAllPlanar", () => {
    const ck = new Checker();
    const options = StrokeOptions.createForFacets();
    const builder = PolyfaceBuilder.create(options);
    const point00 = Point3d.create(0, 0, 0);
    const point10 = Point3d.create(1, 0, 0);
    const point01 = Point3d.create(0, 1, 0);
    const point111 = Point3d.create(1, 1, 0);
    builder.addPolygon([point00, point10, point01]);
    builder.addPolygon([point01, point10, point111]);
    const polyface = builder.claimPolyface();
    ck.testExactNumber(0, PolyfaceQuery.dihedralAngleSummary(polyface, true), "dihedral with boundary and planar");
    ck.testFalse(PolyfaceQuery.isConvexByDihedralAngleCount(polyface, true), "isConvexByDihedralPairing with boundary and planar");

    expect(ck.getNumErrors()).equals(0);
  });

  it("dihedralAngleSummary", () => {
    const ck = new Checker();
    const polyface = IndexedPolyface.create(true);
    // facet1
    polyface.addPoint(Point3d.create(0, 0, 0));
    polyface.addPoint(Point3d.create(1, -1, 0));
    polyface.addPoint(Point3d.create(0, 2, 0));
    polyface.addPoint(Point3d.create(-1, -1, 0));
    // facet2
    polyface.addPoint(Point3d.create(0, 0, 0));
    polyface.addPoint(Point3d.create(-1, -1, 0));
    polyface.addPoint(Point3d.create(1, -1, 0));
    for (let i = 0; i < 7; ++i)
      polyface.addNormalXYZ(0, 0, 1);
    const addIndex = (idx: number) => {
      polyface.addPointIndex(idx);
      polyface.addNormalIndex(idx);
    };
    addIndex(0);
    addIndex(1);
    addIndex(2);
    addIndex(3);
    polyface.terminateFacet();
    addIndex(4);
    addIndex(5);
    addIndex(6);
    polyface.terminateFacet();
    polyface.data.compress();
    ck.testExactNumber(PolyfaceQuery.dihedralAngleSummary(polyface, false), -2);
    ck.testExactNumber(PolyfaceQuery.dihedralAngleSummary(polyface, true), 0);
  });

  it("ComputeSilhouettes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const solids = Sample.createClosedSolidSampler(true);
    const defaultOptions = new StrokeOptions();
    defaultOptions.shouldTriangulate = true;
    defaultOptions.angleTol = Angle.createDegrees(10);
    // REMARK: (EDL Oct 2020) What can be asserted about the silhouette output?
    //       We'll at least assert its not null  for the forward view cases ...
    for (const solid of solids) {
      for (const viewVector of [Vector3d.create(0, 0, 1), Vector3d.create(1, -1, 1)]) {
        const builder = PolyfaceBuilder.create(defaultOptions);
        builder.addGeometryQuery(solid);
        const mesh = builder.claimPolyface();
        let y0 = 0;
        if (ck.testType(mesh, IndexedPolyface)) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, 0);
          for (const selector of [0, 1, 2]) {
            const edges = PolyfaceQuery.boundaryOfVisibleSubset(mesh, selector as (0 | 1 | 2), viewVector);
            y0 += 40.0;
            if (edges) {
              const chains = RegionOps.collectChains([edges]);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, chains, x0, y0, 0);
            }
            if (selector < 2) {
              ck.testDefined(edges);
            } else {  // alternate silhouette method, often better results
              const silhouetteEdges = PolyfaceQuery.collectSilhouetteEdges(mesh, viewVector);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, silhouetteEdges, x0, y0, 20);
            }
          }
        }
        x0 += 20;
      }
      x0 += 20;
    }
    // test an open surface
    const surfMesh = Sample.createMeshFromFrankeSurface(50, defaultOptions);
    if (ck.testType(surfMesh, IndexedPolyface, "faceted a smooth surface")) {
      for (const viewVector of [Vector3d.create(0, 0, 1), Vector3d.create(1, -1, 1), Vector3d.create(-1, -1, 1)]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, surfMesh, x0, 0, 0);
        const boundary = PolyfaceQuery.collectBoundaryEdges(surfMesh);
        const silhouette = PolyfaceQuery.collectSilhouetteEdges(surfMesh, viewVector);
        const allEdges: AnyCurve[] = [];
        if (ck.testDefined(boundary, "boundary found")) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundary, x0, 20, 0);
          allEdges.push(boundary);
        }
        ck.testTrue(viewVector.isExactEqual(Vector3d.unitZ()) || undefined !== silhouette, "silhouette edges found in skew views");
        if (silhouette) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, silhouette, x0, 20, 0);
          allEdges.push(silhouette);
        }
        // find the xy-boundary in the view plane
        const localToWorld = Matrix3d.createRigidViewAxesZTowardsEye(viewVector.x, viewVector.y, viewVector.z);
        const toWorld = Transform.createOriginAndMatrix(undefined, localToWorld);
        const worldToLocal = localToWorld.transpose();
        const toPlane = Transform.createOriginAndMatrix(undefined, worldToLocal);
        allEdges.forEach((curve: AnyCurve) => { curve.tryTransformInPlace(toPlane); });
        const signedLoops = RegionOps.constructAllXYRegionLoops(allEdges);
        let largestRangeDiagonal = 0;
        let exteriorLoop: Loop | undefined;
        for (const component of signedLoops) {
          for (const negAreaLoop of component.negativeAreaLoops) {
            const rangeDiagonal = negAreaLoop.range().diagonal().magnitude();
            if (rangeDiagonal > largestRangeDiagonal) {
              largestRangeDiagonal = rangeDiagonal;
              exteriorLoop = negAreaLoop; // clockwise in the view plane
            }
          }
        }
        // verify that mesh points are in the xy-boundary in the view plane
        if (exteriorLoop) {
          const jointOptions = new JointOptions(Geometry.smallMetricDistance); // enlarge to catch boundary points
          const offsetChain = RegionOps.constructPolygonWireXYOffset(exteriorLoop.getPackedStrokes()!.getArray(), true, jointOptions);
          if (ck.testDefined(offsetChain, "offset computed")) {
            const offsetPolygon = offsetChain.getPackedStrokes()!;
            offsetPolygon.forceClosure();
            for (let i = 0; i < surfMesh.pointCount; ++i) {
              const pt = surfMesh.data.getPoint(i)!;
              const localPt = toPlane.multiplyPoint3d(pt);
              if (!ck.testTrue(-1 < PolygonOps.classifyPointInPolygonXY(localPt.x, localPt.y, offsetPolygon)!, `point (${pt.x},${pt.y}) is in/on the exterior loop`))
                GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineSegment3d.create(pt, pt), x0, 30, 0);
            }
          }
          exteriorLoop.tryTransformInPlace(toWorld);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, exteriorLoop, x0, 30, 0);
        }
        x0 += 20;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "ComputeSilhouettes");
    expect(ck.getNumErrors()).equals(0);
  });
});

type LoopOrParityLoops = Point3d[] | Point3d[][];
function exerciseMultiUnionDiff(ck: Checker, allGeometry: GeometryQuery[],
  data: LoopOrParityLoops[],
  dataB: LoopOrParityLoops[],
  x0: number, y0: number) {
  const rangeA = RegionOps.curveArrayRange(data);
  const dyA = -1.5 * rangeA.yLength();
  for (const g of data) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, g as Point3d[], x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, g as Point3d[], x0, y0 + 2 * dyA);
  }
  for (const g of dataB) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, g as Point3d[], x0, y0 + dyA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, g as Point3d[], x0, y0 + 2 * dyA);
  }
  y0 += 3 * dyA;
  GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(x0, y0, x0 + rangeA.xLength(), y0));
  const meshB = RegionOps.polygonBooleanXYToPolyface(data, RegionBinaryOpType.AMinusB, dataB, true);
  if (ck.testDefined(meshB)) {
    const yStep = dyA;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshB, x0, y0 += yStep);
    const boundaryB = PolyfaceQuery.boundaryEdges(meshB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundaryB, x0, y0 += 2 * yStep);
    const boundaryC = RegionOps.polygonBooleanXYToLoops(data, RegionBinaryOpType.AMinusB, dataB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundaryC, x0, y0 += yStep);
    const boundaryD = RegionOps.polygonBooleanXYToLoops(data, RegionBinaryOpType.Union, dataB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundaryD, x0, y0 += yStep);
    const boundaryE = RegionOps.polygonBooleanXYToLoops(data, RegionBinaryOpType.Intersection, dataB);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundaryE, x0, y0 += yStep);
  }

}
/**
 * * Restructure mesh data as a polyface.
 * * collectDuplicateFacetIndices
 * * check singleton and cluster counts
 * @param ck
 * @param meshData
 * @param numSingleton
 * @param numClusters total number of clusters
 * @param num2Cluster number of clusters with 2 facets
 * @param num3Cluster number of clusters with 3 facets
 */
function testDuplicateFacetCounts(ck: Checker, title: string, meshData: object, numSingleton: number, numCluster: number, num2Cluster: number, num3Cluster: number) {
  const mesh = IModelJson.Reader.parse(meshData) as IndexedPolyface | undefined;
  if (ck.testDefined(mesh, "mesh is valid")) {
    const dupData0 = PolyfaceQuery.collectDuplicateFacetIndices(mesh, false);
    const dupData1 = PolyfaceQuery.collectDuplicateFacetIndices(mesh, true);
    ck.testExactNumber(numSingleton, dupData1.length - dupData0.length, `${title} Singletons`);
    ck.testExactNumber(numCluster, dupData0.length, "Clusters");
    ck.testExactNumber(num2Cluster, countArraysBySize(dupData0, 2), `${title} num2Cluster`);
    ck.testExactNumber(num3Cluster, countArraysBySize(dupData0, 3), `${title} num3Cluster`);

    const singletons = PolyfaceQuery.cloneByFacetDuplication(mesh, true, DuplicateFacetClusterSelector.SelectNone) as IndexedPolyface;
    const oneOfEachCluster = PolyfaceQuery.cloneByFacetDuplication(mesh, false, DuplicateFacetClusterSelector.SelectAny) as IndexedPolyface;
    const allOfEachCluster = PolyfaceQuery.cloneByFacetDuplication(mesh, false, DuplicateFacetClusterSelector.SelectAll) as IndexedPolyface;
    ck.testExactNumber(numSingleton, singletons.facetCount, `${title} cloned singletons`);
    ck.testExactNumber(numCluster, oneOfEachCluster.facetCount, `${title} cloned one per cluster`);
    ck.testExactNumber(mesh.facetCount - numSingleton, allOfEachCluster.facetCount, `${title}  cloned all in clusters`);
  }
}
// return the number of arrays with target size.
function countArraysBySize(data: number[][], target: number): number {
  let result = 0;
  for (const entry of data) {
    if (entry.length === target)
      result++;
  }
  return result;
}

describe("Intersections", () => {
  it("IntersectRay3dClosedConvexMesh", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const mesh = ImportedSample.createPolyhedron62();
    if (ck.testPointer(mesh, "created mesh")) {
      // fire ray at some known locations from the origin. This symmetric mesh imposes symmetry on the intersections and ray params.
      const knownPoints = [
        { vec: Vector3d.create(0.22391898, 0.22391898, 0.94853602), numInts: 8, a: 1.0 }, // a vertex
        { vec: Vector3d.create(0.0, 0.22391898, 0.94853602), numInts: 4, a: 0.97460776 }, // an edge
      ];
      const opts = new FacetIntersectOptions();
      let ints: FacetLocationDetail[];
      opts.acceptIntersection = (detail: FacetLocationDetail): boolean => {
        ints.push(detail.clone()); return false;
      };
      for (const knownPoint of knownPoints) {
        const ray = Ray3d.create(Point3d.createZero(), knownPoint.vec.normalize()!);
        for (const paramTol of [Geometry.smallFraction, Geometry.smallFraction * 100]) {
          ints = [];
          opts.parameterTolerance = paramTol; // to trigger different snapLocationToEdge branches
          PolyfaceQuery.intersectRay3d(mesh, ray, opts);
          if (ck.testExactNumber(ints.length, knownPoint.numInts, "known point intersects expected number of facets")) {
            for (const detail of ints)
              ck.testCoordinate(Math.abs(detail.a), knownPoint.a, "known point intersects at expected ray parameters");
          }
        }
      }
      // create grid of unit rays on xy-plane, pointing down
      const range = Range3d.createFromVariantData(mesh.data.point);
      const diagonal = range.diagonal().magnitude();
      range.expandInPlace(diagonal / 3);
      const testRays: Ray3d[] = [];
      const delta = 0.1;
      for (let xCoord = range.low.x; xCoord < range.high.x; xCoord += delta)
        for (let yCoord = range.low.y; yCoord < range.high.y; yCoord += delta)
          testRays.push(Ray3d.createXYZUVW(xCoord, yCoord, 0, 0, 0, -1));
      // transform grid into place
      const normal = Vector3d.createNormalized(-1, 3, 4)!;
      const localToWorld = Matrix3d.createRigidHeadsUp(normal);
      const translate = normal.scaleToLength(diagonal * 3);
      const localToWorldTransform = Transform.createOriginAndMatrix(translate, localToWorld);
      for (const ray of testRays)
        ray.transformInPlace(localToWorldTransform);
      // fire rays into mesh; some will miss
      let x0 = 0;
      const options = new FacetIntersectOptions();
      options.needColor = options.needNormal = options.needParam = true;
      for (const filter of ["firstFound", "infiniteLine", "boundedSegment", "boundedRay"]) {
        let intersects: FacetLocationDetail[] = [];
        if (filter === "firstFound")
          options.acceptIntersection = undefined; // default behavior: accept first found intersection with infinite line
        else
          options.acceptIntersection = (detail: FacetLocationDetail): boolean => {
            let collect = false;
            if (filter === "infiniteLine")
              collect = true;
            else if (filter === "boundedSegment")
              collect = detail.a >= 0.0 && detail.a <= 1.0;
            else if (filter === "boundedRay")
              collect = detail.a >= 0.0;
            if (collect)
              intersects.push(detail.clone());
            return false; // keep processing
          };
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0);
        for (const ray of testRays) {
          intersects = [];
          let loc = PolyfaceQuery.intersectRay3d(mesh, ray, options);
          if (options.acceptIntersection !== undefined)
            ck.testUndefined(loc, "callbacks that accept no intersection result in intersectRay3d returning undefined");
          if (filter === "boundedSegment")
            ck.testExactNumber(intersects.length, 0, "no intersections expected within ray parameter [0,1]");
          let segment: LineSegment3d | undefined;
          if (loc !== undefined) {
            segment = LineSegment3d.create(ray.origin, loc.point);
          } else if (intersects.length > 0) {
            ck.testTrue(intersects.length <= 2, "expect 1 or 2 intersections of this closed convex mesh, if any");
            if (intersects.length === 2) {
              intersects.sort((d0, d1) => d0.a - d1.a);
              loc = intersects[0];  // closer to ray origin
              segment = LineSegment3d.create(intersects[0].point, intersects[1].point);
            } else {
              segment = LineSegment3d.create(ray.origin, intersects[0].point);
            }
          }
          if (undefined !== loc) {
            ck.testTrue(loc.isInsideOrOn, "intersection is real");
            ck.testTrue(loc.classify < PolygonLocation.OutsidePolygon, "intersection is real (via classify)");
            ck.testBoolean(options.needNormal, undefined !== loc.getNormal(), "normal computed as expected");
            ck.testBoolean(options.needParam, undefined !== loc.getParam(), "uv parameter computed as expected");
            ck.testBoolean(options.needColor, undefined !== loc.getColor(), "color computed as expected");
            ck.testBoolean(options.needBarycentricCoordinates || options.needNormal || options.needParam || options.needColor, undefined !== loc.getBarycentricCoordinates(), "barycentric coords computed as expected");
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, segment, x0);
          }
        }
        x0 += diagonal;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "IntersectRay3dClosedConvexMesh");
    expect(ck.getNumErrors()).equals(0);
  });

  it("IntersectRay3dSingleFaceMesh", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const vertices0 = [Point3d.create(0, 0), Point3d.create(4, 0), Point3d.create(4, 4), Point3d.create(0, 4)];
    const normals0: Vector3d[] = [];
    const params0: Point2d[] = [];
    const colors0 = [0xB435CA, 0x0CF316, 0xFB2B04, 0xF7EF08];
    const centroid = Point3dArray.centroid(vertices0);
    const up = Vector3d.unitZ();
    const strokeOptions = StrokeOptions.createForFacets();
    const builder0 = PolyfaceBuilder.create(strokeOptions);
    builder0.addPolygon(vertices0);
    const mesh0 = builder0.claimPolyface();
    for (let i = 0; i < vertices0.length; ++i) {
      const normal = Vector3d.createAdd3Scaled(vertices0[i], 1, centroid, -1, up, 2);
      normals0.push(normal.clone());
      let index = mesh0.addNormal(normal);
      mesh0.addNormalIndex(index);

      const param = Point2d.create(vertices0[i].x / 4, vertices0[i].y / 4);
      params0.push(param.clone());
      index = mesh0.addParam(param);
      mesh0.addParamIndex(index);

      index = mesh0.addColor(colors0[i]);
      mesh0.addColorIndex(index);
    }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh0);
    // fire rays to midpoints of edges
    const rays = [Ray3d.createXYZUVW(2, 0, 5, 0, 0, -1), Ray3d.createXYZUVW(4, 2, 5, 0, 0, -1), Ray3d.createXYZUVW(2, 4, 5, 0, 0, -1), Ray3d.createXYZUVW(0, 2, 5, 0, 0, -1)];
    const vertices1: Point3d[] = [];
    const normals1: Vector3d[] = [];
    const params1: Point2d[] = [];
    const colors1: number[] = [];
    for (const ray of rays) {
      const loc = PolyfaceQuery.intersectRay3d(mesh0, ray); // no aux data
      if (ck.testPointer(loc, "found intersection")) {
        ck.testExactNumber(loc.facetIndex, 0, "intersected expected facet index");
        ck.testExactNumber(loc.edgeCount, 4, "edge count as expected");
        ck.testTrue(loc.isConvex, "expected convexity");
        ck.testExactNumber(loc.closestEdge.edgeParam, 0.5, "closest edge param is midpoint");
        ck.testExactNumber(loc.classify, PolygonLocation.OnPolygonEdgeInterior, "expected location code");
        vertices1.push(loc.point.clone());
        ck.testUndefined(loc.getNormal(), "intersect with defaults computes no normal");
        ck.testUndefined(loc.getParam(), "intersect with defaults computes no param");
        ck.testUndefined(loc.getColor(), "intersect with defaults computes no color");
        ck.testUndefined(loc.getBarycentricCoordinates(), "intersect with defaults computes no barycentric coords");
        // compute aux data ex post facto
        const visitor = mesh0.createVisitor();
        visitor.moveToReadIndex(loc.facetIndex);
        let normal = loc.getNormal(visitor.normal);
        ck.testUndefined(normal, "normal can't be computed without vertices");
        normal = loc.getNormal(visitor.normal, visitor.point);
        const b = loc.getBarycentricCoordinates();
        if (ck.testPointer(b, "barycentric coords cached as side effect of computing aux data")) {
          ck.testPoint3d(loc.point, visitor.point.linearCombination(b) as Point3d, "roundtrip point through barycentric coords");
          if (ck.testPointer(normal, "computed normal") && ck.testPointer(visitor.normal, "visitor has normals")) {
            ck.testVector3d(normal, visitor.normal.linearCombination(b) as Vector3d, "roundtrip normal through barycentric coords");
            normals1.push(normal);
          }
          const param = loc.getParam(visitor.param);
          if (ck.testPointer(param, "computed param") && ck.testPointer(visitor.param, "visitor has params")) {
            ck.testPoint2d(param, visitor.param.linearCombination(b) as Point2d, "roundtrip uv parameter through barycentric coords");
            params1.push(param);
          }
          const color = loc.getColor(visitor.color);
          if (ck.testPointer(color, "computed color") && ck.testPointer(visitor.color, "visitor has colors")) {
            ck.testExactNumber(color, NumberArray.linearCombinationOfColors(visitor.color, b), "roundtrip color through barycentric coords");
            colors1.push(color);
          }
        }
      }
    }
    // create a new mesh interpolated from the original
    const builder1 = PolyfaceBuilder.create(strokeOptions);
    builder1.addPolygon(vertices1);
    const mesh1 = builder1.claimPolyface();
    for (let i = 0; i < vertices1.length; ++i) {
      ck.testPoint3d(vertices1[i], vertices0[i].interpolate(0.5, vertices0[(i + 1) % vertices0.length]), "interpolated point as expected");
      ck.testVector3d(normals1[i], normals0[i].interpolate(0.5, normals0[(i + 1) % normals0.length]), "interpolated normal as expected");
      ck.testPoint2d(params1[i], params0[i].interpolate(0.5, params0[(i + 1) % params0.length]), "interpolated uv parameter as expected");
      for (let j = 0; j < 4; ++j)
        ck.testExactNumber((colors1[i] >>> (j * 8)) & 0xFF, Math.floor(Geometry.interpolate((colors0[i] >>> (j * 8)) & 0xFF, 0.5, (colors0[(i + 1) % normals0.length] >>> (j * 8)) & 0xFF)), "interpolated color as expected");
      let index = mesh1.addNormal(normals1[i]);
      mesh1.addNormalIndex(index);
      index = mesh1.addParam(params1[i]);
      mesh1.addParamIndex(index);
      index = mesh1.addColor(colors1[i]);
      mesh1.addColorIndex(index);
    }
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, 6);

    // remaining coverage
    const intersectOptions = new FacetIntersectOptions();
    intersectOptions.needBarycentricCoordinates = true;
    const loc1 = PolyfaceQuery.intersectRay3d(mesh1, Ray3d.createXYZUVW(centroid.x, centroid.y, -5, 0, 0, 1), intersectOptions);
    if (ck.testPointer(loc1, "found intersection in new mesh")) {
      ck.testTrue(loc1.isValid, "intersection isValid");
      ck.testExactNumber(loc1.classify, PolygonLocation.InsidePolygonProjectsToEdgeInterior, "intersection has expected code");
      ck.testExactNumber(loc1.closestEdge.edgeParam, 0.5, "intersection projects to edge midpoint");
      ck.testExactNumber(loc1.a, 5.0, "intersection computed at expected ray parameter");
      const b1 = loc1.getBarycentricCoordinates();
      if (ck.testPointer(b1, "intersection returned with barycentric coordinates")) {
        for (const bCoord of b1)
          ck.testExactNumber(bCoord, 0.25, "expected barycentric coords at center");
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "IntersectRay3dSingleFaceMesh");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("FacetShape", () => {
  it("Convexity", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    const polyface = Sample.createMeshFromFrankeSurface(30, options)!;
    ck.testTrue(PolyfaceQuery.areFacetsConvex(polyface), "Franke surface (quads) has convex facets");
    ck.testTrue(PolyfaceQuery.isPolyfaceManifold(polyface, true), "Franke surface (quads) is manifold");

    options.shouldTriangulate = true;
    const polyface1 = Sample.createMeshFromFrankeSurface(30, options)!;
    const visitor1 = polyface1.createVisitor();
    ck.testTrue(PolyfaceQuery.areFacetsConvex(visitor1), "Franke surface (triangulated) has convex facets");
    ck.testTrue(PolyfaceQuery.isPolyfaceManifold(polyface1, true), "Franke surface (triangulated) is manifold");

    options.shouldTriangulate = false;
    const dartPoints = [Point3d.createZero(), Point3d.create(2, 1), Point3d.create(0.5, 0.5), Point3d.create(1, 2)];
    const sweptDart = LinearSweep.createZSweep(dartPoints, 0, 3, true);
    if (ck.testType(sweptDart, LinearSweep, "created swept dart solid")) {
      const builder = PolyfaceBuilder.create(options);
      builder.addLinearSweep(sweptDart);
      const polyface2 = builder.claimPolyface();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface2);
      ck.testTrue(PolyfaceQuery.areFacetsConvex(polyface2), "Swept dart (triangulated) has convex facets");
      ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface2), "Swept dart (triangulated) is closed");
      const polyface3 = PolyfaceQuery.cloneWithMaximalPlanarFacets(polyface2);
      if (ck.testType(polyface3, IndexedPolyface, "clone with max planar facets successful")) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface3, 5);
        ck.testFalse(PolyfaceQuery.areFacetsConvex(polyface3), "Swept dart (max planar facets) has at least one non-convex facet");
        ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface3), "Swept dart (max planar facets) is closed");
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "FacetShape", "Convexity");
    expect(ck.getNumErrors()).equals(0);
  });
});

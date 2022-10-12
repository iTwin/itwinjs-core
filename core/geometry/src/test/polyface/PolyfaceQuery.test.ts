/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYArray } from "../../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { TorusImplicit } from "../../numerics/Polynomials";
import { IndexedPolyface, Polyface, PolyfaceVisitor } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { DuplicateFacetClusterSelector, PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { ChainMergeContext } from "../../topology/ChainMerge";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { RegionBinaryOpType, RegionOps } from "../../curve/RegionOps";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Transform } from "../../geometry3d/Transform";
import { Range3d } from "../../geometry3d/Range";
import { SpacePolygonTriangulation } from "../../topology/SpaceTriangulation";
import { Arc3d } from "../../curve/Arc3d";
import { PolyfaceData } from "../../polyface/PolyfaceData";
import { SortableEdge, SortableEdgeCluster } from "../../polyface/IndexedEdgeMatcher";
import { ImportedSample } from "../testInputs/ImportedSamples";
it("ChainMergeVariants", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const e = 1;    // Really big blob tolerance !!!
  // line segments of a unit square with gap "e" at the beginning of each edge.
  const segments = [
    LineSegment3d.createXYXY(e, 0, 10, 0),
    LineSegment3d.createXYXY(10, e, 10, 10),
    LineSegment3d.createXYXY(10 - e, 10, 0, 10),
    LineSegment3d.createXYXY(0, 10 - e, 0, 0)];
  let dy = 20.0;
  for (const tol of [0.0001 * e, 2.0 * e]) {
    // Create the context with the worst possible sort direction -- trigger N^2 search
    const chainMergeContext = ChainMergeContext.create(
      {
        tolerance: tol,
        primarySortDirection: Vector3d.create(0, 0, 1),
      });
    chainMergeContext.addLineSegment3dArray(segments);
    chainMergeContext.clusterAndMergeVerticesXYZ();
    const chains = chainMergeContext.collectMaximalChains();
    let expectedChains = 4;
    if (tol > e)
      expectedChains = 1;
    ck.testExactNumber(chains.length, expectedChains, "Chain count with variant tolerance");
    GeometryCoreTestIO.captureGeometry(allGeometry, chains, 0, dy, 0);
    dy += 20.0;
  }
  GeometryCoreTestIO.captureGeometry(allGeometry, segments, 0, 0, 0);

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ChainMergeVariants");
  expect(ck.getNumErrors()).equals(0);
});

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
  const linestringA = LineString3d.create (
    [0,0,0],[1,0,0],[2,0,0], [3,0,1],[4,0,0]
  );
  const dx = 0;
  let dy = 1;
  const linestringB = linestringA.cloneTransformed (Transform.createTranslationXYZ (0,2,0));
  builder.addGreedyTriangulationBetweenLineStrings (linestringA, linestringB);
  const polyface = builder.claimPolyface (true);
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy, 0);

  const partitions1 = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent (polyface, false);
  PolyfaceQuery.markPairedEdgesInvisible (polyface, Angle.createDegrees (1.0));
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy += 3, 0);
  const partitions2 = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent (polyface, true);
  ck.testExactNumber (1, partitions1.length, "Simple partitions");
  ck.testExactNumber (3, partitions2.length, "Planar partitions");
  dy += 3;
  for (const partition of [partitions1, partitions2]) {
    const fragmentPolyfaces = PolyfaceQuery.clonePartitions(polyface, partition);
    const dzBoundary = 0.25;
    dy += 3;
    const ax = 0.0;
    for (const fragment of fragmentPolyfaces){
      GeometryCoreTestIO.captureCloneGeometry (allGeometry, fragment, ax, dy, 0);
      const boundary = PolyfaceQuery.boundaryEdges (fragment);
      GeometryCoreTestIO.captureCloneGeometry (allGeometry, boundary, dx, dy, dzBoundary);
      dy += 2;
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ExpandToMaximalPlanarFaces");
    expect(ck.getNumErrors()).equals(0);
});

/** Return whether all edges in the clusters are visible.
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

/** Flex dihedral edge filter, and verify various clustered edge counts and visibilities.
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
  const polyface = Sample.sweepXZLineStringToMeshWithHoles (
    [[0,0],[5,1], [7,1]],
    5,
    (x: number, y: number)=>{
      if (x === 1 && y === 1) return false;
      if (x === 3 && y === 2) return false;
      if (x === 5 && y === 2) return false;
      return true;
    }
  );
  let dx = 0;
  let dy = 0;
  const yStep = 10.0;
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy, 0);
  verifyEdgeCountsAndVisibilities(ck, polyface, undefined, 42, 4, 36);

  const maximalPolyface = PolyfaceQuery.cloneWithMaximalPlanarFacets (polyface);
  if (maximalPolyface){
    verifyEdgeCountsAndVisibilities(ck, maximalPolyface, undefined, 4, 4, 36, true);  // smooth edges are hidden because they are bridges
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, maximalPolyface, dx, dy += yStep, 0);
    dx += 20;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "ExpandToMaximalPlanarFacesWithHoles");
  expect(ck.getNumErrors()).equals(0);
});

// implement a do-nothing visitor NOT backed by a Polyface
class VisitorSansMesh extends PolyfaceData implements PolyfaceVisitor {
  private _index: number;
  private _numIndices: number;
  public constructor(numIndices: number) {
    super();
    this._numIndices = numIndices;
    this._index = -1;
  }
  public moveToReadIndex(index: number): boolean {
    if (index < 0 || index >= this._numIndices)
      return false;
    this._index = index;
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
  }
  public clientPolyface(): Polyface | undefined {
    return undefined; // highly unusual
  }
  public clientPointIndex(_i: number): number {
    return 0;
  }
  public clientParamIndex(_i: number): number {
    return 0;
  }
  public clientNormalIndex(_i: number): number {
    return 0;
  }
  public clientColorIndex(_i: number): number {
    return 0;
  }
  public clientAuxIndex(_i: number): number {
    return 0;
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
  if (ck.testDefined(mesh) && undefined !== mesh) {
    const visitor = mesh.createVisitor(0);
    ck.testExactNumber(60, PolyfaceQuery.visitorClientPointCount(visitor));
    ck.testExactNumber(62, PolyfaceQuery.visitorClientFacetCount(visitor));
  }
  // test a visitor without polyface backing
  const visitor0 = new VisitorSansMesh(5);
  ck.testExactNumber(0, PolyfaceQuery.visitorClientPointCount(visitor0));
  ck.testExactNumber(5, PolyfaceQuery.visitorClientFacetCount(visitor0));
  expect(ck.getNumErrors()).equals(0);
});

it("FillHoles", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const polyface = Sample.sweepXZLineStringToMeshWithHoles (
    [[0,0],[5,1], [7,1]],
    5,
    (x: number, y: number)=>{
      if (x === 1 && y === 1) return false;
      if (x === 3 && y === 2) return false;
      if (x === 3 && y === 3) return false;
      return true;
    }
  );

  const dx = 0;
  let dy = 0;
  const yStep = 10.0;
  const zShift = 5.0;
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy += yStep, 0);
  dy += yStep;
  let numChains = 0;
  PolyfaceQuery.announceBoundaryChainsAsLineString3d (polyface,
      (ls: LineString3d)=> {GeometryCoreTestIO.captureCloneGeometry (allGeometry, ls, dx, dy); numChains++;});
  ck.testExactNumber (3, numChains, "boundary chains");

  const options = {includeOriginalMesh: false, upVector: Vector3d.unitZ(), maxPerimeter: 5};
  const unfilledChains: LineString3d[] = [];

  const filledHoles = PolyfaceQuery.fillSimpleHoles (polyface, options, unfilledChains);
  ck.testExactNumber (2, unfilledChains.length, "outer and large hole via perimeter");
  dy += yStep;
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, filledHoles, dx, dy, 0);
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, unfilledChains, dx, dy, zShift);

  const optionsA = {includeOriginalMesh: true,  maxEdgesAroundHole: 9};
  const unfilledChainsA: LineString3d[] = [];
  const filledHolesA = PolyfaceQuery.fillSimpleHoles (polyface, optionsA, unfilledChainsA);
  ck.testExactNumber (1, unfilledChainsA.length, "outer via count");
  dy += yStep;
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, filledHolesA, dx, dy, 0);
  GeometryCoreTestIO.captureCloneGeometry (allGeometry, unfilledChainsA, dx, dy, zShift);

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "FillHoles");
  expect(ck.getNumErrors()).equals(0);
});

it("SimplestTriangulation", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const range = Range3d.createXYZXYZ (0,0,0, 3,1,1);
  const points = range.corners ();
  let dx = 0;
  const dy = 0;
  const dz = 0;
  const xStep = 5;
  const yStep = 4;

  const announceTriangles = (loop: Point3d[], triangles: Point3d[][])=>{
    const builder = PolyfaceBuilder.create ();
    for (const t of triangles)
      builder.addPolygon (t);
    const polyface = builder.claimPolyface (true);
    polyface.twoSided = true;
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, loop, dx, dy + yStep, dz);
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy + 2 * yStep, dz);
  };
  const doTest = (pointsA: Point3d[], expected: boolean, message: any) => {
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, pointsA, dx, dy, dz);
    // (  force the linestring branch selectively)
    if (pointsA.length !== 4)
      ck.testBoolean (expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop (
          LineString3d.create (pointsA), announceTriangles), message);
    else
      ck.testBoolean (expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop (pointsA, announceTriangles), message);
    dx += xStep;
    };

    const pointQ = points[0].interpolate (0.5, points[1]);
    const pointR = points[0].interpolate (0.75,points[1]);

  doTest ( [points[0], points[1], points[3]], true, [0,1,3]);
  doTest ( [points[0], points[1], points[3],points[2]], true, "0,1,3,2");
    // force both diagonal variants
  doTest ( [points[0], pointR, points[3],points[2]], true, "0,R,3,2");
  doTest ( [pointR, points[1], points[3],points[2]], true, "R,1,3,2");

  doTest ( [points[0], points[1], points[3],points[7]], true, "0,1,3,7");
  doTest ( [points[0], points[1], points[3],points[7].interpolate (0.5, points[4])], true, "0,1,3,<7,0.5,4>");
  dx += xStep;
  doTest ( [points[0], points[1], points[1]], false, [0,1,1]);
  doTest ( [points[0], points[1], points[1], points[2]], false, [0,1,1, 2]);
  doTest ( [points[0], pointQ, pointR, points[1]], false, "4 colinear");
  doTest ( [points[0], pointQ, points[1]], false, "3 colinear");
  ck.testFalse (SpacePolygonTriangulation.triangulateSimplestSpaceLoop ([points[0], points[1], points[3],points[2]], announceTriangles, 2.0), "perimeter trigger");

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "SimplestTriangulation");
  expect(ck.getNumErrors()).equals(0);
});
it("GreedyEarCutTriangulation", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const points = [
    Point3d.create (1, 0, 0),
    Point3d.create (1,1, 0),
    Point3d.create (-1,1,0),
    Point3d.create (-1,0,0),
  ];
  const arc = Arc3d.createXYEllipse (Point3d.create (0,0,0), 0.75, 0.25);
  let dx = 0;
  const dy = 0;
  const dz = 0;
  const xStep = 5;
  const yStep = 4;

  const announceTriangles = (loop: Point3d[], triangles: Point3d[][])=>{
    const builder = PolyfaceBuilder.create ();
    for (const t of triangles)
      builder.addPolygon (t);
    const polyface = builder.claimPolyface (true);
    polyface.twoSided = true;
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, loop, dx, dy + yStep, dz);
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, dx, dy + 2 * yStep, dz);
  };
  const doTest = (pointsA: Point3d[], pointB: Point3d, expected: boolean, message: any) => {
    pointsA.push(pointB);
    dx += xStep;
    GeometryCoreTestIO.captureCloneGeometry (allGeometry, pointsA, dx, dy, dz);
    if (ck.testBoolean (expected, SpacePolygonTriangulation.triangulateSimplestSpaceLoop (pointsA, announceTriangles), message)){

    }
    pointsA.pop ();
    };

    for (const yMove of [0, 3]){
      for (const zz of [0, 0.2, -0.4, 4.0]){
        for (const fraction of [0.75, 0.9, 0.0, 0.1, 0.4, 0.5, 0.6]){
        const pointB = arc.fractionToPoint (fraction);
        pointB.z = zz;
        pointB.y += yMove;
        // hmm.. zz values don't bother it alone.
        // shifting y does make it fail . . ..
        doTest (points, pointB, (yMove === 0), {fraction, zz, yMove});
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
describe("ReOrientFacets", () => {
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

  it("ComputeSilhouettes", () => {

    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const solids = Sample.createClosedSolidSampler(true);
    const defaultOptions = StrokeOptions.createForFacets();
    // REMARK: (EDL Oct 2020) Mutter and grumble.  The builder does not observe shouldTriangulate !!!
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
            if (selector < 2)
              ck.testDefined(edges);
            if (edges) {
              y0 += 40.0;
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, edges, x0, y0, 0);
              y0 += 20.0;
              const chains = RegionOps.collectChains([edges]);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, chains, x0, y0, 0);
            }
          }
        }
        x0 += 20;
      }
      x0 += 20;
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
  if (ck.testDefined(meshB) && meshB) {
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
  const mesh = IModelJson.Reader.parse(meshData) as IndexedPolyface;
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
// return the number of arrays with target size.
function countArraysBySize(data: number[][], target: number): number {
  let result = 0;
  for (const entry of data) {
    if (entry.length === target)
      result++;
  }
  return result;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { LineString3d } from "../../curve/LineString3d";
import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { ChainMergeContext } from "../../topology/ChainMerge";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { GrowableXYArray } from "../../geometry3d/GrowableXYArray";
import { Geometry } from "../../Geometry";

/* tslint:disable:no-console */
/** Functions useful for modifying test data. */
export class RFunctions {
  /** Return cos(theta), where theta is 0 at x0, 2Pi at x2Pi.
   * @param x position to be mapped
   * @param x0 x value for angle 0
   * @param x2Pi x value for angle 2*PI
   */
  public static cosineOfMappedAngle(x: number, x0: number, x2Pi: number): number {
    return Math.cos((x - x0) * Math.PI * 2.0 / (x2Pi - x0));
  }
  /** Return a function that is 1 in the (closed) interval `[x0,x1]` and 0 everywhere else.
   * * "inside" is determined by `(x-x0)*(x-x1)` so that the order of x0 and x1 is not important.
   */
  public static hat(x: number, x0: number, x1: number): number {
    return (x - x0) * (x - x1) <= 0.0 ? 1.0 : 0.0;
  }
}
it("DrapeLinestringAsPanels", () => {
  const ck = new Checker();
  let dy = 0.0;
  const allGeometry: GeometryQuery[] = [];
  const wanderingPoints = [[-1, 1, 1], [1.5, 1, 1], [2, 3, -1], [3.5, 3, -2], [3.5, 6, 1], [4, 8, -2], [6, 3, 5], [8, 3, -2]];
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);
  const wandering = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandering.emitStrokes(strokes);
  for (const linestring of [
    LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    LineString3d.create(wanderingPoints),
    strokes]) {
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1.0324, 0, 0.1), Vector3d.create(0, 1.123, 0.5), 8, 8);
    mesh.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
      });

    const panels = PolyfaceQuery.sweepLinestringToFacetsXYreturnSweptFacets(linestring.packedPoints, mesh);
    GeometryCoreTestIO.captureGeometry(allGeometry, [mesh, linestring, panels], 0, dy, 0);
    dy += 20.0;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestringAsPanels");
  expect(ck.getNumErrors()).equals(0);
});

it("DrapeLinestringAsLines", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];

  const wanderingPoints = [[-1, 1, 1],
  [1.5, 1, 1],
  [2, 3, -1],
  [3.5, 3, -2],
  [3.5, 6, 1],
  [4, 8, -2],
  [6, 3, 5],
  [8, 3, -2]];
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);

  const loopWithHandle = [
    [3, 1, 5],
    [5, 3, 5],
    [3, 6, 5],
    [1, 3, 5],
    [3, 1, 5],
    [0, -1, 5]];

  const wandering = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandering.emitStrokes(strokes);
  let dx = 0.0;
  const dy = 20.0;
  let numTest = 0;
  for (const linestring of [
    LineString3d.create([[4.2, 3, 0], [4.9, 3, 0]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    LineString3d.create(loopWithHandle),
    LineString3d.create(wanderingPoints),
    strokes]) {
    numTest++;
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1, 0, 0.1), Vector3d.create(0, 2, 0.5), 8, 4);
    if (numTest > 3)
      mesh.data.point.mapComponent(2,
        (x: number, y: number, _z: number) => {
          return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
        });
    const lines = PolyfaceQuery.sweepLinestringToFacetsXYReturnLines(linestring.packedPoints, mesh);
    const chains = PolyfaceQuery.sweepLinestringToFacetsXYReturnChains(linestring.packedPoints, mesh);
    let lineSum = 0;
    let chainSum = 0;
    for (const g of lines) lineSum += g.curveLength();
    for (const g of chains) chainSum += g.curveLength();
    ck.testCoordinate(lineSum, chainSum, "Line and chain sums match");
    GeometryCoreTestIO.captureGeometry(allGeometry, [mesh, linestring], dx, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, lines, dx, dy, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, chains, dx, 2 * dy, 0);
    dx += 50.0;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestringAsLines");
  expect(ck.getNumErrors()).equals(0);
});

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
    const partitionArray = [PolyfaceQuery.partitionFacetIndicesByVertexConnectedComponent(polyface),
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

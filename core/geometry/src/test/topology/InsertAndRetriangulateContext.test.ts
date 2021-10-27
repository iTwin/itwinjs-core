/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Angle } from "../../geometry3d/Angle";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Point3dArray } from "../../geometry3d/PointHelpers";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgePositionDetail, HalfEdgeTopo } from "../../topology/HalfEdgePositionDetail";
import { InsertAndRetriangulateContext } from "../../topology/InsertAndRetriangulateContext";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { Triangulator } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { lisajouePoint3d } from "../geometry3d/PointHelper.test";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GraphChecker } from "./Graph.test";

/**
 * Output for HalfEdgePositionDetail:
 * * If oldDetail is given, line from old to new.
 * * For newDetail:
 *   * HalfEdgeTopo.Face: circle
 *   * Vertex: tick mark from vertex into its sector.
 *   * Edge: tick mark from edge position into its face.
 * * At end, copy all data fro newDetail to oldDetail.
 */
function showPosition(allGeometry: GeometryQuery[], oldDetail: HalfEdgePositionDetail, newDetail: HalfEdgePositionDetail, markerSize: number,
  x0: number, y0: number, z0: number = 0) {
  if (!oldDetail.isUnclassified && !newDetail.isUnclassified) {
    const point0 = oldDetail.clonePoint();
    const point1 = newDetail.clonePoint();
    if (!point0.isAlmostEqualMetric(point1))
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createCapture(point0, point1), x0, y0, z0);
  }
  if (newDetail.getTopo() === HalfEdgeTopo.Face) {
    GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, newDetail.clonePoint(), markerSize, x0, y0, z0);
  } else if (newDetail.getTopo() === HalfEdgeTopo.Vertex) {
    const nodeB = newDetail.node!;
    const nodeC = nodeB.faceSuccessor;
    const nodeA = nodeB.facePredecessor;
    const pointB = nodeB.fractionToPoint3d(0.0);
    const vectorBC = Vector3d.createStartEnd(nodeB, nodeC);
    const vectorBA = Vector3d.createStartEnd(nodeB, nodeA);
    const theta = vectorBC.angleToXY(vectorBA);
    const bisector = vectorBC.rotateXY(Angle.createRadians(0.5 * theta.radians));
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointB, pointB.plusScaled(bisector, markerSize)), x0, y0, z0);
  } else if (newDetail.getTopo() === HalfEdgeTopo.Edge) {
    const node0 = newDetail.node!;
    const point0 = node0.fractionToPoint3d(0.0);
    const point1 = node0.fractionToPoint3d(1.0);
    const pointB = point0.interpolate(newDetail.edgeFraction!, point1);
    const vector01 = Vector3d.createStartEnd(point0, point1);
    vector01.normalizeInPlace();
    vector01.rotate90CCWXY(vector01);
    const pointC = pointB.plusScaled(vector01, markerSize);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointB, pointC), x0, y0, z0);
  } else {
    console.log(" unknown topo type", newDetail.getTopo());
  }
  oldDetail.setFrom(newDetail);
}

describe("InsertAndRetriangulateContext", () => {

  it("MoveInGrid", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const graph = new HalfEdgeGraph();
    const numX = 5;
    const numY = 4;
    const x0 = 0;
    let y0 = 0;
    const yStep = numY + 1;
    const aa = 0.06;
    // make horizontal edges
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i + 1 < numX; i++)
        graph.addEdgeXY(i, j, i + 1, j);
    }
    // make horizontal edges
    for (let i = 0; i < numX; i++) {
      for (let j = 0; j + 1 < numY; j++)
        graph.addEdgeXY(i, j, i, j + 1);
    }
    const z1 = 0.05;   // draw linework a little above the polyface.
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
    const context = InsertAndRetriangulateContext.create(graph);
    const position = HalfEdgePositionDetail.create();
    const oldPosition = HalfEdgePositionDetail.create();
    GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0);

    for (const point of [
      Point3d.create(0.5, 1.0),     // jump onto an edge
      Point3d.create(1.5, 1.0),     // move along a grid line, through a vertex to middle of next edge
      Point3d.create(3.5, 1.0),     // further along the grid line, jumping along an entire edge
      Point3d.create(1.5, 0.5),     // back cross some edges into a face
      Point3d.create(0.5, 1.5),
      Point3d.create(1.2, 2.8),
      Point3d.create(1.8, 2.0),
      Point3d.create(1.8, 1.0),
      Point3d.create(2.0, 2.0),
      Point3d.create(2.5, 0.5),
      Point3d.create(0.2, 0.6),
      Point3d.create(0.3, 0.4),
      Point3d.create(1.2, 0.4),
      Point3d.create(0.5, 1.0),
      Point3d.create(2.5, 1.0)]) {
      y0 += yStep;
      const polyface = PolyfaceBuilder.graphToPolyface(graph);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0);
      context.moveToPoint(position, point,
        (positionA: HalfEdgePositionDetail) => {
          showPosition(allGeometry, oldPosition, positionA, aa * 0.5, x0, y0, z1);
          return true;
        });
      // GraphChecker.captureAnnotatedGraph(allGeometry, graph, x0, y0);
      showPosition(allGeometry, oldPosition, position, aa, x0, y0, z1);
    }
    oldPosition.resetAsUnknown();
    context.resetSearch(Point3d.create(1.5, 0.5), 0);
    ck.testExactNumber(HalfEdgeTopo.Vertex, context.currentPosition.getTopo(), "Reset to vertex");
    context.resetSearch(Point3d.create(1.5, 0.5), 1);
    ck.testExactNumber(HalfEdgeTopo.Edge, context.currentPosition.getTopo(), "Reset to edge search");
    // hit the "vertex sector" case. ..
    context.resetSearch(Point3d.create(-0.5, -0.5), 1);
    ck.testExactNumber(HalfEdgeTopo.Vertex, context.currentPosition.getTopo(), "Reset to edge search");

    GeometryCoreTestIO.saveGeometry(allGeometry, "InsertAndRetriangulateContext", "moveTo");
    expect(ck.getNumErrors()).equals(0);
  });

  it("insertAndRetriangulate", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const graph1 = new HalfEdgeGraph();
    const numX = 4;
    const numY = 4;
    let x0 = 10;    // keep right to allow side by side with "just move"
    let y0 = 0;
    const yStep = numY + 5;
    const xStep = numX + 5;
    // make horizontal edges
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i + 1 < numX; i++)
        graph1.addEdgeXY(i, j, i + 1, j);
    }
    // make horizontal edges
    for (let i = 0; i < numX; i++) {
      for (let j = 0; j + 1 < numY; j++)
        graph1.addEdgeXY(i, j, i, j + 1);
    }
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph1);
    GraphChecker.captureAnnotatedGraph(allGeometry, graph1, x0, y0);
    const context1 = InsertAndRetriangulateContext.create(graph1);
    const graph2 = new HalfEdgeGraph();
    const points = [];
    for (let degrees = 0; degrees < 359; degrees += 25) {
      points.push(Point3d.create(2 + 3.5 * Math.cos(Angle.degreesToRadians(degrees)), 2 + 3 * Math.sin(Angle.degreesToRadians(degrees))));
    }
    // points.push(points[0].clone());
    Triangulator.createFaceLoopFromCoordinates(graph2, points, true, true);
    GraphChecker.captureAnnotatedGraph(allGeometry, graph2, x0 + 20, y0);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph2);
    GraphChecker.captureAnnotatedGraph(allGeometry, graph2, x0 + 30, y0);

    const context2 = InsertAndRetriangulateContext.create(graph2);
    for (const context of [context1, context2]) {
      y0 = 0;
      let numPointsInserted = 0;
      for (const point of [
        Point3d.create(0.5, 0.6),  // in face
        Point3d.create(1.0, 0.6),  // move to edge
        Point3d.create(1.5, 0.6),  // cross one edge into a face
        Point3d.create(0.5, 0.7),  // back to first face
        Point3d.create(0.5, 1.0),  // up to an edge
        Point3d.create(1, 1), // directly to a vertex
        Point3d.create(0.5, 1.0),  // back to edge
        Point3d.create(1.5, 1.0),  // through vertex to mid edge
        Point3d.create(0.5, 2.0), // up to a higher edge
        Point3d.create(2.5, 2.0),  // along edge, through 2 vertices

        Point3d.create(2, 2),   // back up to a vertex
        Point3d.create(2, 1), // move to another
        Point3d.create(1, 1), // and another
        Point3d.create(0.5, 1.5), // face interior
        Point3d.create(1, 1), // back to vertex
        Point3d.create(0.5, 2), // mid edge
        Point3d.create(0.5, 2), // sit there again
        Point3d.create(0.2, 2), // same edge
        Point3d.create(0.5, 1.5), // in face
        Point3d.create(0.5, 1.5), // stay
        Point3d.create(1.0, 1.0), // at vertex
        Point3d.create(1.0, 1.0), // stay
      ]) {
        //        console.log("insertAndRetriangulate", point);
        context.insertAndRetriangulate(point, true);
        numPointsInserted++;
        if (numPointsInserted < 4) {
          y0 += yStep;
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, point, 0.03, x0, y0);
          GraphChecker.captureAnnotatedGraph(allGeometry, context.graph, x0, y0);
          const polyfaceA = PolyfaceBuilder.graphToPolyface(context.graph);
          GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceA, x0 + xStep, y0);
        }
        // GraphChecker.dumpGraph (graph);
      }
      y0 += 2 * yStep;
      const polyfaceC = PolyfaceBuilder.graphToPolyface(context.graph);
      GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceC, x0 + xStep, y0);
      for (let flip = 0; flip < 1; flip++) {
        const numFlip = Triangulator.flipTriangles(context.graph);
        ck.testExactNumber(0, numFlip, "Expect no flips from global sweep after incremental flips during insert.");
        // console.log("numFlip " + numFlip);
        const polyfaceB = PolyfaceBuilder.graphToPolyface(context.graph);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceB, x0 + (2 + flip) * xStep, y0);
      }
      x0 += 10 * xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "InsertAndRetriangulateContext", "insertAndRetriangulate");
    expect(ck.getNumErrors()).equals(0);
  });
  // cspell:word lisajoue
  it("TriangulateInHull", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const a = 3.29;
    const dTheta = 0.34;
    let x0 = 0;
    // lisajouePoint3d makes points smeared within distance 1 of the origin.
    // nonzero yShift gradually makes points move upward
    // (nb the hull process makes points mostly move left to right)
    for (const yShiftStep of [0.0, 0.01, 0.05]) {
      for (const numPoints of [9, 25, 1024, 4096 /* , 16982, 16982, 16982 */]) {
        let y0 = 0;
        // console.log("Triangulate", numPoints);
        const points: Point3d[] = [];
        let yShift = 0.0;
        for (let theta = 0.01 * (numPoints - 8); points.length < numPoints; theta += dTheta) {
          const point = lisajouePoint3d(theta * theta, a, 0);
          point.y += yShift;
          yShift += yShiftStep;
          points.push(point);
        }
        const yShiftDisplay = yShift + 3;
        /*
              const graph = new HalfEdgeGraph();
              const context = InsertAndRetriangulateContext.create(graph);
              Triangulator.createFaceLoopFromCoordinates(graph, hull, true, true);
              HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph);
              GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(hull), x0, y0);
              GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(interior), x0, y0);
              // let k = 0;
              let numInsert = 0;
              for (const p of interior) {
                context.insertAndRetriangulate(p, true);
                numInsert++;
                if (numInsert > 16) {
                  context.reset();
                  Triangulator.flipTriangles(context.graph);
                  // console.log (" intermediate flips " + numFlip);
                  numInsert = 0;
                }
              }
              GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(context.graph!), x0, y0 + 5);
              // console.log("Begin flips");
              for (let i = 0; i < 15; i++) {
                const numFlip = Triangulator.flipTriangles(graph);
                if (numFlip === 0)
                  break;
                // console.log("     flip " + numFlip);
                GeometryCoreTestIO.captureGeometry(allGeometry, PolyfaceBuilder.graphToPolyface(context.graph!), x0, y0 + 10 + i * 4);
              }
        */
        const hull: Point3d[] = [];
        const interior: Point3d[] = [];
        Point3dArray.computeConvexHullXY(points, hull, interior, true);
        // GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, interior, 0.001, x0, y0);
        // GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(hull), x0, y0);
        // y0 += yShiftDisplay;
        if (numPoints < 100) {
          const r = 0.002;
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, points, r, x0, y0);
          y0 += yShiftDisplay;
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(hull), x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, interior, r, x0, y0);
          y0 += yShiftDisplay;

        }

        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(hull), x0, y0);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(interior), x0, y0);
        // GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(interior), x0, y0);
        const timerName = `before pointsToTriangulatedPolyface ${numPoints}`;
        console.time(timerName);
        const polyface = PolyfaceBuilder.pointsToTriangulatedPolyface(points);
        console.timeEnd(timerName);
        y0 += yShiftDisplay;
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, y0);
        if (ck.testDefined(polyface, "polyface triangulation") && polyface) {
          const polyfaceArea = PolyfaceQuery.sumFacetAreas(polyface);
          const hullArea = PolygonOps.areaXY(hull);
          ck.testCoordinate(polyfaceArea, hullArea, `mesh, hull area match for ${numPoints}point triangulation`);
        }
        x0 += 5;
      }
    }
    // console.log ("write file");
    GeometryCoreTestIO.saveGeometry(allGeometry, "InsertAndRetriangulateContext", "TriangulateInHull");
    expect(ck.getNumErrors()).equals(0);
  });

});

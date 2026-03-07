/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { describe, expect, it } from "vitest";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Arc3d } from "../../curve/Arc3d";
import { CurveCollection } from "../../curve/CurveCollection";
import { CreateFilletsInLineStringOptions, CurveFactory, MiteredSweepOutputSelect } from "../../curve/CurveFactory";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { RegionOps } from "../../curve/RegionOps";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { AxisOrder, Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3dArrayCarrier } from "../../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { Point4d } from "../../geometry4d/Point4d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { RuledSweep } from "../../solid/RuledSweep";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("CurveFactory", () => {
  it("CreateFilletsOnLineString", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();

    const points0 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(3, 7),
    ];

    const points1 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(8, 3),
      Point3d.create(13, 5),
      Point3d.create(12, 8),
      Point3d.create(5, 8)];

    const points2 = [
      Point3d.create(1, 1),
      Point3d.create(5, 1),
      Point3d.create(14, 3),
      Point3d.create(14, 11),
      Point3d.create(5, 11),
      Point3d.create(-1, 1),
      Point3d.create(-1, 8),
      Point3d.create(4, 12),
      Point3d.create(8, 14)];
    let x0 = 0.0;
    const xStep = 30;
    const yStep = 20;
    for (const points of [points0, points1, points2]) {
      for (const allowBackup of [true, false]) {
        let y0 = 0.0;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.create(points), x0, y0);
        for (const radius of [0.5, 1.0, 2.0, 4.0, 6.0]) {
          y0 += yStep;
          const path = CurveFactory.createFilletsInLineString(points, radius, allowBackup);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
        }
        x0 += xStep;
      }
      x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "FilletsOnLineString");

    expect(ck.getNumErrors()).toBe(0);
  });
  it("FilletArcDegenerate", () => {
    const ck = new Checker();

    const point0 = Point3d.create(1, 2, 3);
    const point2 = Point3d.create(4, 2, -1);
    const radius = 2.0;
    for (const lambda of [0.0, -0.52, 0.45, 1.2, 1.0]) {
      const point1 = point0.interpolate(lambda, point2);
      const data = Arc3d.createFilletArc(point0, point1, point2, radius);
      ck.testDefined(data, "Degenerated arc data");
      ck.testUndefined(data.arc, "Degenerate arc -- expect no arc in data");
    }
    expect(ck.getNumErrors()).toBe(0);
  });
  it("appendToArcInPlace", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const xStep = 3.0;
    const yStep = 3.0;
    for (const arcA0 of [
      Arc3d.createXYZXYZXYZ(0, 0, 0, 2, 0, 0, 0, 2, 0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.createCircularStartMiddleEnd(
        Point3d.create(1, 0, 0), Point3d.create(1.5, 1, 0), Point3d.create(1, 2, 0),
      ) as Arc3d,
      Arc3d.createXYZXYZXYZ(0, 0, 0, 2, 0, 0, 0.5, 1, 0, AngleSweep.createStartEndDegrees(-10, 50))]) {
      for (const reverse of [false, true]) {
        const arcA = arcA0.clone();
        if (reverse)
          arcA.sweep.reverseInPlace();
        for (const segment of [Segment1d.create(1, 1.5), Segment1d.create(1.1, 1.5), Segment1d.create(1, 0.5)]) {
          let y0 = 0.0;
          for (const rotationAngleB of [0.0, 25.0]) {
            const arcA1 = arcA.clone();
            const arcA2 = arcA.clone();
            const arcB1 = arcA.cloneInRotatedBasis(Angle.createDegrees(rotationAngleB));
            arcB1.sweep = AngleSweep.createStartEnd(
              arcB1.sweep.fractionToAngle(segment.x0), arcB1.sweep.fractionToAngle(segment.x1),
            );
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA1, arcB1], x0, y0);
            markArcData(allGeometry, arcA1, 0.9, 0.05, x0, y0);
            markArcData(allGeometry, arcB1, 0.9, 0.05, x0, y0);
            const append1 = CurveFactory.appendToArcInPlace(arcA1, arcB1, true);
            if (append1) {
              markArcData(allGeometry, arcA1, 1.1, 0.05, x0, y0 + yStep);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcA1, x0, y0 + yStep);
            }
            const append2 = CurveFactory.appendToArcInPlace(arcA2, arcB1, false);
            if (append2) {
              markArcData(allGeometry, arcA2, 1.1, 0.05, x0, y0 + 2 * yStep);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcA1, x0, y0 + 2 * yStep);
            }
            y0 += 4 * yStep;
          }
          x0 += xStep;
        }
        x0 += 2.0 * xStep;
      }
      x0 += 3.0 * xStep;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "appendToArcInPlace");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("FilletsInLinestring", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const points = [
      Point3d.create(0, 0, 0),
      Point3d.create(2, 0, 0),
      Point3d.create(2, 5, 1),
      Point3d.create(4, 5, 1),
      Point3d.create(6, 2, 1),
      Point3d.create(6, 5, 1),
    ];
    const lineString0 = LineString3d.create(points);
    points.reverse();
    const lineString1 = LineString3d.create(points);
    for (const filletRadius of [0, 0.2, 0.4, 0.6, 0.8, 1.2, 2.0, 4.0, 6.0]) {
      let y0 = 0.0;
      for (const lineString of [lineString0, lineString1]) {
        const chain0 = CurveFactory.createFilletsInLineString(lineString, filletRadius, false)!;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0, y0);
        y0 += 8.0;
        const chain1 = CurveFactory.createFilletsInLineString(lineString, filletRadius, true)!;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain1, x0, y0);
        y0 += 20.0;
      }
      x0 += 20.0;
    }

    const radii = [0, 2, 1, 0.8, 0.6, 0.4];
    const chain2 = CurveFactory.createFilletsInLineString(lineString0, radii, true)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain2, x0, 0.0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "FilletsInLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("FilletsInPolygon", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const points = [ // non-planar
      Point3d.create(2, 0, 0),
      Point3d.create(2, 5, 1),
      Point3d.create(4, 5, 1),
      Point3d.create(6, 2, 1),
      Point3d.create(2, 0, 0),
    ];
    // largest cusp-less seam fillet radius depends on the 3 nearby line string angles
    ck.testPoint3d(points[0], points[points.length - 1], "points array has closure point");
    const angle0 = Vector3d.createStartEnd(points[0], points[1]).radiansTo(Vector3d.createStartEnd(points[points.length - 1], points[points.length - 2]));
    const angle1 = Vector3d.createStartEnd(points[1], points[0]).radiansTo(Vector3d.createStartEnd(points[1], points[2]));
    const angleN = Vector3d.createStartEnd(points[points.length - 2], points[points.length - 1]).radiansTo(Vector3d.createStartEnd(points[points.length - 2], points[points.length - 3]));
    const len0 = points[0].distance(points[1]);
    const lenN = points[points.length - 2].distance(points[points.length - 1]);
    const maxRadius0 = len0 / ((1 / Math.tan(angle0 / 2)) + (1 / Math.tan(angle1 / 2)));
    const maxRadiusN = lenN / ((1 / Math.tan(angle0 / 2)) + (1 / Math.tan(angleN / 2)));
    const maxRadiusAtSeam = Math.min(maxRadius0, maxRadiusN);

    const lineString0 = LineString3d.create(points);
    points.reverse();
    const lineString1 = LineString3d.create(points);

    const verifyFilletedPolygon = (chain0: Path, options: CreateFilletsInLineStringOptions, radius0: number) => {
      ck.testPoint3d(chain0.startPoint()!, chain0.endPoint()!, "fillet polygon should be closed");
      ck.testBoolean(radius0 > 0 && (options.filletClosure ?? false) && ((options.allowCusp ?? true) || radius0 <= maxRadiusAtSeam), chain0.getChild(0) instanceof Arc3d, "necessary and sufficient condition for output to start with fillet");
      for (const child of chain0.children) {
        if (child instanceof Arc3d) {
          ck.testTrue(child.isCircular, "expect fillet to be circular");
          ck.testCoordinate(child.circularRadius()!, radius0, "expect fillet radius === radius");
        }
      }
    }

    // single radius, all combinations of allowCusp and filletClosure
    for (const radius0 of [0, 0.2, 0.4, 0.6, 0.8, 1.2, 2, 4, 6]) {
      y0 = 0;
      for (const lineString of [lineString0, lineString1]) {
        for (const allowCusp of [true, false]) {
          for (const filletClosure of [true, false]) {
            const filletOptions: CreateFilletsInLineStringOptions = { allowCusp, filletClosure };
            const chain0 = CurveFactory.createFilletsInLineString(lineString, radius0, filletOptions)!;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0, y0);
            verifyFilletedPolygon(chain0, filletOptions, radius0);
            y0 += 8;
          }
          y0 += 8;
        }
      }
      x0 += 20;
    }

    // array of radii
    const radii = [0, 2, 1, 0.8, 0.6, 0.4];
    y0 = 0;
    for (const filletClosure of [true, false]) {
      const chain2 = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: true, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain2, x0, y0);
      y0 += 8;
    }

    // square
    x0 += 20;
    y0 = 0;
    const s = 5;
    const square = LineString3d.create([0, 0], [s, 0], [s, s], [0, s]);
    let radius = s / 2;
    for (const allowCusp of [true, false]) {
      const filletedSquare = CurveFactory.createFilletsInLineString(square, radius, { allowCusp, filletClosure: true })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, filletedSquare, x0, y0);
      RegionOps.consolidateAdjacentPrimitives(filletedSquare);
      ck.testCoordinate(filletedSquare.children.length, 1, "expect one child after consolidateAdjacentPrimitives");
      const circle = filletedSquare.children[0];
      if (ck.testType(circle, Arc3d, "expect a single arc after call to consolidateAdjacentPrimitives")) {
        ck.testTrue(circle.isCircular, "expect arc to be circular");
        ck.testTrue(circle.sweep.isFullCircle, "expect arc to be full circle");
        ck.testTrue(circle.circularRadius() === radius, "expect arc radius to match fillet radius");
        ck.testPoint3d(circle.center, Point3d.create(s / 2, s / 2, 0), "expect arc center to match (s/2,s/2)");
      }
      y0 += 8;
    }

    // open linestring
    x0 += 20;
    y0 = 0;
    radius = 0.2;
    for (const filletClosure of [true, false]) {
      const openLineString = LineString3d.create([0, 0, 0], [2, 5, 1], [4, 5, 1], [6, 2, 1]);
      const chain0 = CurveFactory.createFilletsInLineString(openLineString, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0, y0);
      if (filletClosure)
        ck.testPoint3d(chain0.startPoint()!, chain0.endPoint()!, "chain for an open linestring with true filletClosure must be closed");
      y0 += 8;
    }

    // special case with 2 points
    x0 += 20;
    y0 = 0;
    let specialLineString = LineString3d.create([0, 0], [5, 0]);
    for (const filletClosure of [true, false]) {
      const chain0 = CurveFactory.createFilletsInLineString(specialLineString, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0, y0);
      for (const c of chain0.children)
        ck.testTrue(c instanceof LineSegment3d, "expect only line segments in the linestring chain with 2 points");
      y0 += 8;
    }

    // special case with 3 points
    x0 += 20;
    specialLineString = LineString3d.create([0, 0], [5, 0], [10, 5]);
    let chain = CurveFactory.createFilletsInLineString(specialLineString, radius, { allowCusp: false, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0);
    ck.testPoint3d(chain.startPoint()!, chain.endPoint()!, "chain for the open linestring with true filletClosure must be closed");
    let numArcChildren = 0;
    for (const c of chain.children)
      if (c instanceof Arc3d)
        numArcChildren++;
    ck.testExactNumber(numArcChildren, 3, "expect 3 arcs in the linestring chain with 3 points and filletClosure true");
    ck.testTrue(chain.children[0] instanceof Arc3d, "expect child 0 to be arc");
    ck.testTrue(chain.children[2] instanceof Arc3d, "expect child 2 to be arc");
    ck.testTrue(chain.children[4] instanceof Arc3d, "expect child 4 to be arc");
    chain = CurveFactory.createFilletsInLineString(specialLineString, radius, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, 8);
    ck.testTrue(chain.getChild(0) instanceof LineSegment3d, "expect line segment at start of the linestring chain");
    numArcChildren = 0;
    for (const c of chain.children)
      if (c instanceof Arc3d)
        numArcChildren++;
    ck.testExactNumber(numArcChildren, 1, "expect 1 arc in the linestring chain with 3 points and filletClosure false");
    ck.testTrue(chain.children[1] instanceof Arc3d, "expect child 1 to be arc");

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "FilletsInPolygon");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("fromFilletedLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;

    const verifyPointsAndRadii = (
      pointsAndRadii0: Array<[Point3d, number]>, lineStr: LineSegment3d | LineString3d, radius0: number | number[], isClosed: boolean,
    ) => {
      const len = isClosed ? lineStr.points.length - 1 : lineStr.points.length; // ignore duplicate point at end of closed linestring
      ck.testNearNumber(
        pointsAndRadii0.length, len, Geometry.smallMetricDistance,
        "expect pointsAndRadii to match linestring point count",
      );
      for (let i = 0; i < pointsAndRadii0.length; i++) {
        const [pt, r] = pointsAndRadii0[i];
        ck.testPoint3d(pt, lineStr.points[i], "expect point match");
        if (r !== 0) {
          if (typeof radius0 === "number")
            ck.testNearNumber(r, radius0, Geometry.smallMetricDistance, "expect radius match");
          else
            ck.testNearNumber(r, radius0[i], Geometry.smallMetricDistance, "expect radius match");
        }
      }
    }
    const testFilletedLineString = (lineStr0: LineString3d, lineStr1: LineString3d, isClosed: boolean) => {
      // single radius; no cusp
      for (const radius0 of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        y0 = 0;
        for (const lineStr of [lineStr0, lineStr1]) {
          for (const filletClosure of [true, false]) {
            const filletOptions: CreateFilletsInLineStringOptions = { allowCusp: false, filletClosure };
            const chain0 = CurveFactory.createFilletsInLineString(lineStr, radius0, filletOptions)!;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0, y0);
            const pointsAndRadii0 = CurveFactory.fromFilletedLineString(chain0);
            ck.testDefined(pointsAndRadii0, "expect to be able to extract points and radii from filleted linestring");
            verifyPointsAndRadii(pointsAndRadii0!, lineStr, radius0, isClosed);
            y0 += 8;
          }
          y0 += 8;
        }
        x0 += 10;
      }
    }
    let points = [ // non-planar
      Point3d.create(2, 0, 0),
      Point3d.create(2, 5, 1),
      Point3d.create(4, 5, 1),
      Point3d.create(6, 2, 1),
      Point3d.create(2, 0, 0),
    ];
    // open line string
    let lineString0 = LineString3d.create(points.slice(0, -1));
    points.reverse();
    let lineString1 = LineString3d.create(points.slice(0, -1));
    testFilletedLineString(lineString0, lineString1, false);
    x0 += 5;
    // closed line string
    lineString0 = LineString3d.create(points);
    points.reverse();
    lineString1 = LineString3d.create(points);
    testFilletedLineString(lineString0, lineString1, true);

    // single radius with cusp
    x0 += 5;
    y0 = 0;
    let radius = 2;
    let chain = CurveFactory.createFilletsInLineString(lineString0, radius, { allowCusp: true, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    let pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with cusp");
    y0 += 10;
    radius = 4;
    chain = CurveFactory.createFilletsInLineString(lineString0, radius, { allowCusp: true, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with cusp");
    y0 += 10;

    // closed chain; array of radii
    x0 += 10;
    y0 = 0;
    let radii = [0, 0.2, 0.8, 0.4, 0.6, 0.2];
    points = [ // non-planar
      Point3d.create(2, 0, 0),
      Point3d.create(2, 5, 1),
      Point3d.create(4, 5, 1),
      Point3d.create(6, 2, 1),
      Point3d.create(6, 0, 0),
      Point3d.create(4, -2, 1),
      Point3d.create(2, 0, 0),
    ];
    lineString0 = LineString3d.create(points);
    chain = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii, true);

    // open chain; array of radii
    y0 += 10;
    radii = [0, 0.2, 0.8, 0.4, 0.6];
    lineString0 = LineString3d.create(points.slice(0, -1));
    chain = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii, false);

    // closed chain that starts with a line segment
    x0 += 10;
    y0 = 0;
    radius = 0.6;
    lineString0 = LineString3d.create(points);
    chain = CurveFactory.createFilletsInLineString(lineString0, radius, { allowCusp: false, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    const closedChainStartsLineSegment = new Path();
    for (let i = 1; i <= chain.children.length - 1; i++)
      closedChainStartsLineSegment.tryAddChild(chain.children[i]);
    closedChainStartsLineSegment.tryAddChild(chain.children[0]);
    pointsAndRadii = CurveFactory.fromFilletedLineString(closedChainStartsLineSegment);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    const reorderedLineString = LineString3d.create(points[1], points[2], points[3], points[4], points[5], points[0]);
    verifyPointsAndRadii(pointsAndRadii!, reorderedLineString, radius, false);

    // chain is a linestring
    x0 += 10;
    y0 = 0;
    radius = 0;
    lineString0 = LineString3d.create(points);
    chain = Path.create(lineString0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radius, true);

    // closed chain that includes linestring
    y0 += 10;
    radii = [0, 0.2, 0.8, 0.4, 0, 0];
    lineString0 = LineString3d.create(points);
    chain = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    const closedChainWithLineString = new Path();
    for (let i = 0; i <= 5; i++)
      closedChainWithLineString.tryAddChild(chain.children[i]);
    let lineString = LineString3d.create(
      chain.children[6].startPoint(),
      chain.children[7].startPoint(),
      chain.children[8].startPoint(),
      chain.children[8].endPoint(),
    );
    closedChainWithLineString.tryAddChild(lineString);
    pointsAndRadii = CurveFactory.fromFilletedLineString(closedChainWithLineString);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii, true);

    // open chain that includes linestring
    y0 += 10;
    radii = [0, 0.2, 0.8, 0.4, 0];
    lineString0 = LineString3d.create(points.slice(0, -1));
    chain = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    const openChainWithLineString = new Path();
    for (let i = 0; i <= 5; i++)
      openChainWithLineString.tryAddChild(chain.children[i]);
    lineString = LineString3d.create(
      chain.children[6].startPoint(),
      chain.children[7].startPoint(),
      chain.children[7].endPoint(),
    );
    openChainWithLineString.tryAddChild(lineString);
    pointsAndRadii = CurveFactory.fromFilletedLineString(openChainWithLineString);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii, false);

    // special case with 2 points
    x0 += 10;
    y0 = 0;
    radius = 0.2;
    let line: LineSegment3d | LineString3d = LineSegment3d.createXYXY(0, 0, 5, 0);
    chain = Path.create(line);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, line, radius, false);
    y0 += 10;
    line = LineString3d.create([0, 0], [5, 0]);
    chain = Path.create(line);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, line, radius, false);

    // special case with 3 points
    x0 += 10;
    y0 = 0;
    line = LineString3d.create([0, 0], [5, 0], [7, 5]);
    for (const filletClosure of [true, false]) {
      chain = CurveFactory.createFilletsInLineString(line, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, line, radius, false);
      y0 += 10;
    }

    // adjacent lines
    x0 += 10;
    y0 = 0;
    let line0: LineSegment3d | LineString3d = LineSegment3d.createXYXY(0, 0, 5, 0);
    let line1: LineSegment3d | LineString3d = LineSegment3d.createXYXY(5, 0, 7, 0);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [5, 0], [7, 0]), radius, false);
    y0 += 10;
    line0 = LineString3d.create([0, 0], [2, 0], [3, 0]);
    line1 = LineString3d.create([3, 0], [5, 0], [7, 0]);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [2, 0], [3, 0], [5, 0], [7, 0]), radius, false);
    y0 += 10;
    line0 = LineSegment3d.createXYXY(0, 0, 3, 0);
    line1 = LineString3d.create([3, 0], [5, 0], [7, 0]);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [3, 0], [5, 0], [7, 0]), radius, false);

    // chain with B-Spline curve child
    const degree = 3;
    const poleArray = [Point3d.create(0, 0), Point3d.create(1, 2), Point3d.create(3, 2), Point3d.create(4, 0)];
    const knotArray = [0, 1 / 5, 2 / 5, 3 / 5, 4 / 5, 1];
    const bspline = BSplineCurve3d.create(poleArray, knotArray, degree + 1)!;
    chain = Path.create(bspline);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with a bspline child");

    // chain with anti-parallel adjacent children
    x0 += 20;
    y0 = 0;
    line = LineSegment3d.createXYXY(-5, 5, 0, 5);
    const arc0 = Arc3d.createXY(Point3d.create(0, 0), 5, AngleSweep.createStartEndDegrees(90, 180));
    chain = Path.create(line, arc0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with anti-parallel adjacent children");
    y0 += 10;
    const arc1 = Arc3d.createXY(Point3d.create(0, 10), 5, AngleSweep.createStartEndDegrees(180, 270));
    chain = Path.create(arc1, arc0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with anti-parallel adjacent children");

    // special degenerate cases where a fillet takes up the entire edge
    for (const filletClosure of [true, false]) {
      // case 1
      x0 += 10;
      y0 = 0;
      const s = 5;
      const square = LineString3d.create([0, 0], [s, 0], [s, s], [0, s]);
      radius = s / 2;
      chain = CurveFactory.createFilletsInLineString(square, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with fillet takes up the entire edge");
      // call with relaxed validation
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);
      // insert 0-length segments between arcs to make the chain valid
      y0 += 10;
      let validChain = new Path();
      for (let i = 0; i < chain.children.length; i += 1) {
        validChain.tryAddChild(chain.children[i]);
        if (filletClosure || i === 1)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].endPoint(), chain.children[i].endPoint()));
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, validChain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(validChain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);

      // case 2
      y0 += 10;
      radius = s;
      chain = CurveFactory.createFilletsInLineString(square, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with fillet takes up the entire edge");
      // call with relaxed validation
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);
      // insert 0-length segments where arc tangent is not parallel to line segment tangent to make the chain valid
      y0 += 10;
      validChain = new Path();
      for (let i = 0; i < chain.children.length; i += 1) {
        const insertIndex = filletClosure ? 2 : 1;
        if (i === insertIndex)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].startPoint(), chain.children[i].startPoint()));
        validChain.tryAddChild(chain.children[i]);
        if (i === insertIndex && filletClosure)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].endPoint(), chain.children[i].endPoint()));
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, validChain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(validChain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);

      // case 3
      y0 += 10;
      radii = [0, s, 0, s];
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with fillet takes up the entire edge");
      // call with relaxed validation
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);
      // insert 0-length segments where arc tangent is not parallel to line segment tangent to make the chain valid
      y0 += 10;
      validChain = new Path();
      for (let i = 0; i < chain.children.length; i += 1) {
        if (i === 0 && filletClosure)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].startPoint(), chain.children[i].startPoint()));
        validChain.tryAddChild(chain.children[i]);
        if (i === 0)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].endPoint(), chain.children[i].endPoint()));
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, validChain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(validChain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radius, false);

      // case 4
      y0 += 10;
      radii = [0, s / 2, 0, s / 2];
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radii, false);
      y0 += 10;
      radii = [0, s / 2, s / 2, 0];

      // case 5
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring with fillet takes up the entire edge");
      // call with relaxed validation
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
      verifyPointsAndRadii(pointsAndRadii!, square, radii, false);
      // insert 0-length segments between arcs to make the chain valid
      y0 += 10;
      validChain = new Path();
      for (let i = 0; i < chain.children.length; i += 1) {
        validChain.tryAddChild(chain.children[i]);
        if (i === 1)
          validChain.tryAddChild(LineSegment3d.create(chain.children[i].endPoint(), chain.children[i].endPoint()));
      }
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, validChain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(validChain);
      ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring with fillet takes up the entire edge");
      verifyPointsAndRadii(pointsAndRadii!, square, radii, false);
    }

    // more special degenerate cases
    x0 += 10;
    y0 = 0;
    // case 1
    lineString = LineString3d.create([0, 0], [0, 5], [5, 5], [0, 8]);
    radii = [0, 5, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring");
    // call with relaxed validation
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii, false);
    // case 2
    y0 += 10;
    lineString = LineString3d.create([0, 0], [0, 5], [5, 5], [8, 0]);
    radii = [0, 5, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring");
    // call with relaxed validation
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii, false);
    // case 3
    y0 += 10;
    lineString = LineString3d.create([0, 0], [2, 2], [4, 2], [4, 0], [6, 0], [6, 2], [8, 3]);
    radii = [0, 0, 2, 0, 2, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring");
    // call with relaxed validation
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii, false);
    // case 4
    y0 += 10;
    lineString = LineString3d.create([0, 0], [2, 2], [4, 2], [6, -2], [8, -2], [8, 2]);
    radii = [0, 0, 2, 2, 2, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(pointsAndRadii, "expect fromFilletedLineString to return undefined for filleted linestring");
    // call with relaxed validation
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    ck.testDefined(pointsAndRadii, "expect to be able to extract points and radii from filleted linestring");
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii, false);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "fromFilletedLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
});
/**
 *
 * @param allGeometry
 * @param arc
 * @param radialFraction draw arc at this fraction of radius
 * @param tickFraction draw start tic delta this radial fraction
 * @param x0
 * @param y0
 */
function markArcData(
  allGeometry: GeometryQuery[], arc: Arc3d, radialFraction: number, tickFraction: number, x0: number, y0: number,
) {
  const arc1 = arc.clone();
  const center = arc.center;
  const start = arc.startPoint();
  const point0 = arc.angleToPointAndDerivative(Angle.createDegrees(0));
  const point90 = arc.angleToPointAndDerivative(Angle.createDegrees(90));
  arc1.matrixRef.scaleColumnsInPlace(radialFraction, radialFraction, 1.0);
  GeometryCoreTestIO.captureGeometry(allGeometry, [arc1,
    LineSegment3d.create(
      center.interpolate(radialFraction, start), center.interpolate(radialFraction + tickFraction, start),
    ),
    LineString3d.create(point0.origin, center, point90.origin)], x0, y0);
}
const ppePathInputDirector = "./src/test/data/pipeConnections/";
describe("PipeConnections", () => {
  it("ChainCollector", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let refPoint: Point3d | undefined;
    let x0 = 0;
    let y0 = 0;
    let z0 = 0;
    const dx = 400.0;
    const dy = 600.0;
    const pipeRadius = 0.20;
    const bendRadius = 0.50;
    for (const filename of ["pipeLinesApril2020"]) {
      const stringData = fs.readFileSync(`${ppePathInputDirector}${filename}.imjs`, "utf8");
      if (stringData) {
        const jsonData = JSON.parse(stringData);
        const fragments = IModelJson.Reader.parse(jsonData);
        if (Array.isArray(fragments)) {
          for (const g of fragments) {
            if (g instanceof LineString3d) {
              if (refPoint === undefined) {
                refPoint = g.packedPoints.getPoint3dAtCheckedPointIndex(0);
                if (refPoint) {
                  x0 = -refPoint.x;
                  y0 = -refPoint.y;
                  z0 = -refPoint.z;
                }
              }
              const chain0 = CurveFactory.createFilletsInLineString(g, bendRadius, false)!;
              const pipe0 = CurveFactory.createPipeSegments(chain0, pipeRadius);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain0, x0 + dx, y0 + dy, z0);
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, pipe0, x0, y0, z0);
            }
          }
        }
      }
      GeometryCoreTestIO.saveGeometry(allGeometry, "PipeConnections", filename);
    }
    expect(ck.getNumErrors()).toBe(0);
  });
  it("createArcFromSectionData", () => {
    const ck = new Checker();

    let centerline = Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90));
    let sectionData: Arc3d | number = Arc3d.create(Point3d.create(1), Vector3d.create(1), Vector3d.create(0, 2));
    let arc = CurveFactory.createArcFromSectionData(centerline, sectionData)!;
    ck.testDefined(arc);
    ck.testPoint3d(arc.center, centerline.startPoint());
    ck.testVector3d(arc.vector0, sectionData.vector0);
    ck.testVector3d(arc.vector90, sectionData.vector90);

    centerline = Arc3d.create(
      undefined, Vector3d.create(0.5), Vector3d.create(0, 0, 1), AngleSweep.createStartEndDegrees(0, 90),
    );
    sectionData = 0.2;
    arc = CurveFactory.createArcFromSectionData(centerline, sectionData)!;
    ck.testDefined(arc);
    ck.testPoint3d(arc.center, centerline.startPoint());
    ck.testVector3d(arc.matrixClone().columnZ(), centerline.fractionToPointAndUnitTangent(0).direction);
    ck.testCoordinate(arc.vector0.magnitude(), sectionData);
    ck.testCoordinate(arc.vector90.magnitude(), sectionData);

    expect(ck.getNumErrors()).toBe(0);
  });

  it("createMiteredPipeSections", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    let y0 = 0.0;
    let z0 = 0.0;
    const radius = 0.25;
    const eccentricity = 0.75;
    const minorFraction = Math.sqrt(1 - eccentricity * eccentricity);
    const v0Angle = Angle.createRadians(0.7);
    const allPaths: Array<Point3dArrayCarrier | CurvePrimitive> = [];

    for (const numPoints of [8, 20, 40]) {
      const path = new Point3dArrayCarrier(
        Sample.createPointSineWave(
          undefined, numPoints, 10.0 / numPoints,
          5.0, AngleSweep.createStartEndDegrees(0, 520),
          3.0, AngleSweep.createStartEndDegrees(0, 100),
        ),
      );
      allPaths.push(path);
    }

    const bsplines = Sample.createBsplineCurves(false);
    for (const b of bsplines)
      allPaths.push(b);

    const helices = Sample.createBsplineCurveHelices(3, 6, 3, 7);
    for (const h of helices)
      allPaths.push(h);

    for (const path of allPaths) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
      const isPoints = path instanceof Point3dArrayCarrier;
      const isLinear = isPoints || ((path instanceof BSplineCurve3d) && (path.order === 2));
      // create elliptical cross section perpendicular to path start
      const startPoint = Point3d.create();
      const startTangent = Vector3d.create();
      if (isPoints) {
        path.front(startPoint);
        startPoint.unitVectorTo(path.getPoint3dAtUncheckedPointIndex(1), startTangent);
      } else {
        const startRay = path.fractionToPointAndUnitTangent(0.0);
        startPoint.setFrom(startRay.origin);
        startTangent.setFrom(startRay.direction);
      }
      const startFrame = Matrix3d.createRotationAroundVector(startTangent, v0Angle)!.multiplyMatrixMatrix(
        Matrix3d.createRigidHeadsUp(startTangent, AxisOrder.ZXY),
      );
      const v0 = startFrame.columnX().scaleToLength(radius)!;
      const v90 = startFrame.columnY().scaleToLength(radius * minorFraction)!;

      for (const angleTol of [Angle.createDegrees(22), Angle.createDegrees(15), Angle.createDegrees(5)]) {
        for (const sectionData of
          [radius, { x: radius, y: radius * minorFraction }, Arc3d.create(startPoint, v0, v90, AngleSweep.create360())]
        ) {
          y0 += 10.0;
          const builder = PolyfaceBuilder.create();
          builder.options.angleTol = angleTol;
          builder.addMiteredPipes(path, sectionData);
          const mesh = builder.claimPolyface();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0, z0);
        }
        y0 = 0;
        z0 += 10;
        if (isLinear)
          break; // no need to re-stroke centerline
      }
      x0 += 10;
      y0 = z0 = 0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createMiteredPipeSections");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("addMiteredPipesWithCaps", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    const numFacetAround = 8;
    const sectionSweeps: AngleSweep[] = [
      AngleSweep.create360(),
      AngleSweep.createStartEndDegrees(360, 0),
      AngleSweep.createStartEndDegrees(0, 90),
      AngleSweep.createStartEndDegrees(180, 90),
    ]
    const centerline = [
      Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.create(undefined, Vector3d.create(0.5), Vector3d.create(0, 0, 1), AngleSweep.createStartEndDegrees(0, 90)),
      BSplineCurve3dH.createUniformKnots([
        Point4d.create(-1.5, -1, 0, 1),
        Point4d.create(-0.25, -0.5, 0, 0.5),
        Point4d.create(-0.5, 0, 0, 1),
        Point4d.create(-0.25, 0.5, 0, 0.5),
        Point4d.create(0.5, 1, 0, 1),
        Point4d.create(0.75, 0.5, 0, 0.5),
        Point4d.create(1.5, 1, 1, 1),
      ], 3,
      )!,
      [Point3d.create(-1, -1), Point3d.create(-1), Point3d.create(0, 1), Point3d.create(1, 1)],
    ];
    for (const sweep of sectionSweeps) {
      dx = 0;
      const sectionData = [
        Arc3d.create(undefined, Vector3d.create(0, 0, 0.3), Vector3d.create(0.5), sweep),
        Arc3d.create(undefined, Vector3d.create(0, 0, 0.3), Vector3d.create(0.5, 0.5), sweep),
        Arc3d.create(undefined, Vector3d.create(0, 0.2), Vector3d.create(0.1), sweep),
        0.2,
        0.1,
      ];
      ck.testExactNumber(sectionData.length, centerline.length, "test case arrays have same size");
      let builder: PolyfaceBuilder;
      for (const capped of [true, false]) {
        for (let i = 0; i < sectionData.length; ++i) {
          builder = PolyfaceBuilder.create();
          builder.addMiteredPipes(centerline[i], sectionData[i], numFacetAround, capped);
          const mesh = builder.claimPolyface();
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, dx, dy);
          dx += 3;
          if (capped) {
            if (Number.isFinite(sectionData[i]) || sweep.isFullCircle)
              ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is expected (closed section)");
            else
              ck.testFalse(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is not expected (open section)");
          } else {
            ck.testFalse(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is not expected (capped=false)");
          }
          if (!capped && sweep.isFullCircle)
            ck.testExactNumber(
              PolyfaceQuery.boundaryEdges(mesh)!.children.length,
              2 * numFacetAround,
              "number of cap edges is a double of numFacetAround",
            );
        }
      }
      dy += 3;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "addMiteredPipesWithCaps");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("createArcPointTangentPoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pointA = Point3d.create(0.5, 0.2, 0.4);
    let x0 = 0;

    for (const tangentA of [Vector3d.create(1, 0, 0), Vector3d.create(-2, 3, 6), Vector3d.create(-1, -2, -5)]) {
      let y0 = 0.0;
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pointA, 0.1, x0, y0);
      GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA, pointA.plus(tangentA)), x0, y0);
      for (const pointB of [pointA.plus(Vector3d.create(3, 2, 0)), Point3d.create(0, 5, 2), Point3d.create(-2, -1, 5)]) {
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA, pointA.plus(tangentA)), x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pointB, 0.1, x0, y0);
        const arc = CurveFactory.createArcPointTangentPoint(pointA, tangentA, pointB);
        ck.testDefined(arc, "Expect arc Point Tangent Point", pointA, tangentA, pointB);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
        if (arc) {
          const point90 = arc.radiansToPointAndDerivative(0.5 * Math.PI);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, point90.origin, 0.05, x0, y0);
          GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create([pointA, arc.center, point90.origin]), x0, y0);
          ck.testPoint3d(pointA, arc.startPoint(), "arc start");
          ck.testPoint3d(pointB, arc.endPoint(), "arc end");
          const tangentRay = arc.fractionToPointAndDerivative(0.0);
          ck.testParallel(tangentA, tangentRay.direction, "arc tangent");
        }
        y0 += 20;
      }
      x0 += 20.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createArcPointTangentPoint");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("createRectangleXY", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 1.5;
    const y0 = 2.0;
    const x1 = 6;
    const y1 = 7;
    const radiusA = 3.0;
    const rectangleA = CurveFactory.createRectangleXY(x0, y0, x1, y1, 0, radiusA);
    const rectangleB1 = CurveFactory.createRectangleXY(x0, y0, x1, y1, 0, undefined);
    const rectangleB0 = CurveFactory.createRectangleXY(x0, y0, x1, y1, 0, 0.0);
    ck.testType(rectangleA, Loop);
    ck.testType(rectangleB0, Loop);
    ck.testType(rectangleB1, Loop);
    const radii: (number | undefined)[] = [undefined, 0, 1, 2, 3];
    let yOut = 0.0;
    for (const yB of [4, -4]) {
      let xOut = 0.0;
      for (const xB of [6, -6]) {
        for (const radiusD of radii) {
          const rectangleD = CurveFactory.createRectangleXY(0, 0, xB, yB, 0, radiusD);
          ck.testType(rectangleD, Loop, "CurveFactory always returns a loop");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, rectangleD, xOut, yOut);
          xOut += 10.0;
        }
        xOut += 20.0;
      }
      yOut += 20;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createRectangleXY");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("createMiteredSweep", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const x0 = -1;
    const x1 = 2;
    const y0 = -2;
    const y1 = 3;
    const centerlines: Point3d[][] = [];
    const a = 10;
    // just 2 edges with a 90 degree turn
    centerlines.push([Point3d.create(0, 0, 0), Point3d.create(0, 0, 10), Point3d.create(0, 12, 10)]);
    // closed planar
    centerlines.push([
      Point3d.create(0, 0, 0),
      Point3d.create(0, 0, a),
      Point3d.create(0, a, a),
      Point3d.create(0, a, 0),
      Point3d.create(0, 0, 0),
    ]);
    // closed non-planar
    centerlines.push([
      Point3d.create(0, 0, 0),
      Point3d.create(0, 0, a),
      Point3d.create(0, a, a),
      Point3d.create(4, a, 0),
      Point3d.create(0, 0, 0),
    ]);
    // with duplicate points.
    centerlines.push([
      Point3d.create(0, 0, 0),
      Point3d.create(0, 0, a), Point3d.create(0, 0, a),
      Point3d.create(0, a, a),
      Point3d.create(4, a, 0),
      Point3d.create(0, 0, 0), Point3d.create(0, 0, 0),
    ]);
    const numDuplicates: number[] = [];
    for (const centerline of centerlines) {
      let n = 0;
      for (let i = 0; i + 1 < centerline.length; i++) {
        if (Geometry.isSamePoint3d(centerline[i], centerline[i + 1]))
          n++;
      }
      numDuplicates.push(n);
    }
    const wrapIfClosed = [false, false, true, false];
    let x0Out = 0.0;
    const outDelta = 20.0;
    // sections with various corner conditions
    for (const radiusA of [undefined, 0.0, 3.0]) {
      let y0Out = 0.0;
      for (let centerlineIndex = 0; centerlineIndex < centerlines.length; centerlineIndex++) {
        const centerline = centerlines[centerlineIndex];
        const wrap = wrapIfClosed[centerlineIndex];
        const rectangleA = CurveFactory.createRectangleXY(x0, y0, x1, y1, 0, radiusA);
        const sweeps = CurveFactory.createMiteredSweepSections(centerline, rectangleA, { wrapIfPhysicallyClosed: wrap });
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, centerline, x0Out, y0Out);
        if (sweeps !== undefined) {
          if (ck.testDefined(sweeps.sections) && ck.testDefined(sweeps.planes) &&
            ck.testExactNumber(sweeps.planes.length, sweeps.sections.length, "Same number of planes and sections")) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweeps.sections, x0Out, y0Out);
            ck.testExactNumber(
              centerline.length - numDuplicates[centerlineIndex], sweeps.sections.length, "confirm section count",
            );
            for (const plane of sweeps.planes) {
              GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, plane.getAnyPointOnPlane(), 0.25, x0Out, y0Out);
              GeometryCoreTestIO.captureCloneGeometry(
                allGeometry, [plane.getOriginRef(), plane.getOriginRef().plus(plane.getNormalRef())], x0Out, y0Out,
              );
            }
            for (let i = 0; i < sweeps.sections.length; i++)
              ck.testTrue(isGeometryInPlane(sweeps.sections[i], sweeps.planes[i]), "geometry in plane");
          }
        }
        y0Out += outDelta;
      }
      x0Out += outDelta;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createMiteredSweep");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("createMiteredSweepStadiumExample", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    // make a filleted rectangle for the ground path; the middle of the y=ay edge goes through the origin
    const ax = 60;
    const ay = 80;
    let x0 = 0;
    const y0 = 0;
    const y1 = -200;
    const y2 = -400;
    const ySurface = 200;
    const yMesh = 400;
    // quirky order for making the rectangle with intended edge on y=ay edge axis; createRectangleXY starts at upper right arc
    const path = CurveFactory.createRectangleXY(-ax, 0, ax, ay, 0, 30);
    const arc = path.children.shift()!;
    path.children.push(arc);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y2);
    // build stair cross section in YZ plane with positive Y
    const sweepOrigin = Point3d.create(0, ay, 0);
    const stepSize = 10;
    const numZigZagEdge = 5;
    const zigZag = Sample.createZigZag(
      sweepOrigin, [Vector3d.create(0, stepSize, 0), Vector3d.create(0, 0, stepSize)], numZigZagEdge,
    );
    const sectionA = LineString3d.create(zigZag);
    const sectionB = CurveFactory.createFilletsInLineString(zigZag, stepSize / 6.0, false)!;
    const ovalSection = CurveFactory.createRectangleXY(-5, -2, 5, 2, 0, 2);
    const yzTransform = Transform.createOriginAndMatrixColumns(
      sweepOrigin, Vector3d.unitY(), Vector3d.unitZ(), Vector3d.unitX(),
    );
    ovalSection.tryTransformInPlace(yzTransform); // transform to put it on yz plane

    const options = new StrokeOptions();
    options.angleTol = Angle.createDegrees(30.0);
    const strokedLoop = path.cloneStroked(options);
    if (strokedLoop instanceof Loop && strokedLoop.children[0] instanceof LineString3d) {
      const strokePoints = strokedLoop.children[0].points;
      const sweepLength = strokedLoop.sumLengths();
      for (const section of [sectionA, sectionB, ovalSection]) {
        x0 += 200;
        let sweptGeometryLength = 0;
        if (section instanceof CurvePrimitive) {
          sweptGeometryLength = section.curveLength();
        } else if (section instanceof CurveCollection) {
          sweptGeometryLength = section.sumLengths();
        } else {
          ck.announceError("expect primitive or collection for section ", section);
          break;
        }
        const sections = CurveFactory.createMiteredSweepSections(
          strokePoints,
          section,
          { wrapIfPhysicallyClosed: true, outputSelect: MiteredSweepOutputSelect.AlsoMesh },
        )!;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokePoints, x0, y1);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y1);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokePoints, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, sections.sections, x0, y0);
        if (ck.testType(sections.ruledSweep, RuledSweep, "output ruled sweep") &&
          ck.testType(sections.mesh, IndexedPolyface, "output mesh")) {
          const sweptSurface = sections.ruledSweep;
          const mesh = sections.mesh;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweptSurface, x0, ySurface);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, ySurface);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, yMesh);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, yMesh);
          // How to detect correctness for a complex operation
          // In these examples,
          // (a) the length of intermediate sections is larger than that of the original
          // (b) the sweep path lengths at various places along the sections are not too different from the centerline length.
          // Check that the mesh area is fairly close to the product of those two
          const meshArea = PolyfaceQuery.sumFacetAreas(mesh);
          const referenceArea = sweptGeometryLength * sweepLength;
          ck.testNumberInRange1d(
            meshArea, Range1d.createXX(0.9 * referenceArea, 1.3 * referenceArea), "mesh area close to quick estimate",
          );
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createMiteredSweepStadiumExample");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("createMiteredSweepSections", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0, dy = 0;
    const sectionSweeps: AngleSweep[] = [
      AngleSweep.create360(),
      AngleSweep.createStartEndDegrees(360, 0),
      AngleSweep.createStartEndDegrees(0, 90),
      AngleSweep.createStartEndDegrees(180, 90),
    ]
    const centerline = [
      Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.create(undefined, Vector3d.create(0.5), Vector3d.create(0, 0, 1), AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.create(undefined, Vector3d.create(0.5), Vector3d.create(0, 0, 1), AngleSweep.createStartEndDegrees(0, -90)),
      BSplineCurve3dH.createUniformKnots([
        Point4d.create(-1.5, -1, 0, 1),
        Point4d.create(-0.25, -0.5, 0, 0.5),
        Point4d.create(-0.5, 0, 0, 1),
        Point4d.create(-0.25, 0.5, 0, 0.5),
        Point4d.create(0.5, 1, 0, 1),
        Point4d.create(0.75, 0.5, 0, 0.5),
        Point4d.create(1.5, 1, 1, 1),
      ], 3,
      )!,
    ];
    for (const sweep of sectionSweeps) {
      dx = 0;
      const sectionData = [
        Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(0, 0, 1), Vector3d.create(0.5), sweep),
        Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(0, 0, 1), Vector3d.create(0.5, 0.5), sweep),
        Arc3d.create(Point3d.create(0.5), Vector3d.create(0, 0.2), Vector3d.create(0.1), sweep),
        Arc3d.create(Point3d.create(0.5), Vector3d.create(0, 0.2), Vector3d.create(0.1), sweep),
        Arc3d.create(Point3d.create(-1.5, -1, 0), Vector3d.create(0, 0.2), Vector3d.create(0, 0, 0.2), sweep),
      ];
      ck.testExactNumber(sectionData.length, centerline.length, "test case arrays have same size");
      for (const capped of [true, false]) {
        for (let i = 0; i < sectionData.length; ++i) {
          const sections = CurveFactory.createMiteredSweepSections(
            centerline[i],
            sectionData[i],
            { outputSelect: MiteredSweepOutputSelect.AlsoMesh, capped },
          )!;

          if (ck.testType(sections.ruledSweep, RuledSweep, "output ruled sweep") &&
            ck.testType(sections.mesh, IndexedPolyface, "output mesh")) {
            const sweptSurface = sections.ruledSweep;
            const mesh = sections.mesh;
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweptSurface, dx, dy);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, dx + 3, dy);

            dx += 6;
            if (capped) {
              if (sweep.isFullCircle)
                ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is expected (closed section)");
              else
                ck.testFalse(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is not expected (open section)");
            } else {
              ck.testFalse(PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "cap is not expected (capped=false)");
            }
          }
        }
      }
      dy += 3;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createMiteredSweepSections");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("createMiteredSweepSectionsTangentOption", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;
    const centerline = [
      Arc3d.createXY(Point3d.createZero(), 1.0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.create(undefined, Vector3d.create(0.5), Vector3d.create(0, 0, 1), AngleSweep.createStartEndDegrees(0, 90)),
    ];
    dx = 0;
    const sectionData = [
      Arc3d.create(Point3d.create(1, 0, 0), Vector3d.create(0, 0, 1), Vector3d.create(0.5)),
      Arc3d.create(Point3d.create(0.5, 0, 0), Vector3d.create(0, 0.2), Vector3d.create(0.1)),
    ];
    const startTangents = [
      Vector3d.create(0, -1, 0),
      Vector3d.create(0, 0, -2),
    ]
    const endTangents = [
      Vector3d.create(-1, 0, 0),
      Vector3d.create(-2, 0, 0),
    ]
    ck.testExactNumber(sectionData.length, centerline.length, "test case arrays have same size");
    ck.testExactNumber(sectionData.length, startTangents.length, "test case arrays have same size");
    ck.testExactNumber(sectionData.length, endTangents.length, "test case arrays have same size");
    for (const capped of [true, false]) {
      for (let i = 0; i < sectionData.length; ++i) {
        const options = new StrokeOptions();
        options.angleTol = Angle.createDegrees(15);
        const linestring = LineString3d.create();
        centerline[i].emitStrokes(linestring, options);
        const sections = CurveFactory.createMiteredSweepSections(
          linestring.points,
          sectionData[i],
          {
            outputSelect: MiteredSweepOutputSelect.AlsoMesh,
            capped,
            startTangent: startTangents[i],
            endTangent: endTangents[i],
          },
        )!;

        if (ck.testType(sections.ruledSweep, RuledSweep, "output ruled sweep") &&
          ck.testType(sections.mesh, IndexedPolyface, "output mesh")) {
          const sweptSurface = sections.ruledSweep;
          const mesh = sections.mesh;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, sweptSurface, dx);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, dx + 3);

          ck.testTrue(sections.planes[0].getNormalRef().isExactEqual(startTangents[i]));
          ck.testTrue(sections.planes[sections.planes.length - 1].getNormalRef().isExactEqual(endTangents[i]));

          dx += 6;
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "createMiteredSweepSectionsTangentOption");
    expect(ck.getNumErrors()).toBe(0);
  });
});

function isGeometryInPlane(geometry: GeometryQuery, plane: Plane3dByOriginAndUnitNormal): boolean {
  const localToWOrld = plane.getLocalToWorld();
  const worldToLocal = localToWOrld.inverse();
  const range = geometry.range(worldToLocal);
  return Geometry.isSameCoordinate(0, range.low.z) && Geometry.isSameCoordinate(0, range.high.z);
}

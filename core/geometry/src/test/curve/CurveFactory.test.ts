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
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { RuledSweep } from "../../solid/RuledSweep";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Sample } from "../GeometrySamples";

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
      pointsAndRadii0: Array<[Point3d, number]>, lineStr: LineSegment3d | LineString3d, radius0: number | number[],
    ) => {
      const len = lineStr.points.length;
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
    };
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
            ck.testDefined(
              pointsAndRadii0,
              "expect to be able to extract points and radii from filleted linestring for single radius with no cusp"
            );
            const expectedLineStr = (filletClosure && !isClosed)
              ? LineString3d.create([...lineStr.points, lineStr.pointAt(0)!])
              : lineStr;
            verifyPointsAndRadii(pointsAndRadii0!, expectedLineStr, radius0);
            y0 += 8;
          }
          y0 += 8;
        }
        x0 += 10;
      }
    };
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
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for filleted linestring with cusp for single radius with cusp"
    );
    y0 += 10;
    radius = 4;
    chain = CurveFactory.createFilletsInLineString(lineString0, radius, { allowCusp: true, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for filleted linestring with cusp for single radius with cusp"
    );
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
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for closed chain with array of radii"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii);

    // open chain; array of radii
    y0 += 10;
    radii = [0, 0.2, 0.8, 0.4, 0.6];
    lineString0 = LineString3d.create(points.slice(0, -1));
    chain = CurveFactory.createFilletsInLineString(lineString0, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for open chain with array of radii"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii);

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
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for closed chain that starts with a line segment"
    );
    const reorderedLineString = LineString3d.create(points[1], points[2], points[3], points[4], points[5], points[0], points[1]);
    verifyPointsAndRadii(pointsAndRadii!, reorderedLineString, radius);

    // chain is a linestring
    x0 += 10;
    y0 = 0;
    radius = 0;
    lineString0 = LineString3d.create(points);
    chain = Path.create(lineString0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for a chain that is a linestring"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radius);

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
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for closed chain that includes linestring"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii);

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
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for open chain that includes linestring"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString0, radii);

    // special case with 2 points
    x0 += 10;
    y0 = 0;
    radius = 0;
    let line: LineSegment3d | LineString3d = LineSegment3d.createXYXY(0, 0, 5, 0);
    chain = Path.create(line);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for special case with 2 points"
    );
    verifyPointsAndRadii(pointsAndRadii!, line, radius);
    y0 += 10;
    line = LineString3d.create([0, 0], [5, 0]);
    chain = Path.create(line);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for special case with 2 points"
    );
    verifyPointsAndRadii(pointsAndRadii!, line, radius);

    // special case with 3 points
    x0 += 10;
    y0 = 0;
    line = LineString3d.create([0, 0], [5, 0], [7, 5]);
    for (const filletClosure of [true, false]) {
      chain = CurveFactory.createFilletsInLineString(line, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for special case with 3 points"
      );
      let expectedLine: LineSegment3d | LineString3d;
      if (filletClosure)
        expectedLine = LineString3d.create([0, 0], [5, 0], [7, 5], [0, 0]);
      else
        expectedLine = line;
      verifyPointsAndRadii(pointsAndRadii!, expectedLine, radius);
      y0 += 10;
    }

    // adjacent lines
    x0 += 10;
    y0 = 0;
    // case 1
    let line0: LineSegment3d | LineString3d = LineSegment3d.createXYXY(0, 0, 5, 0);
    let line1: LineSegment3d | LineString3d = LineSegment3d.createXYXY(5, 0, 7, 0);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for adjacent lines case 1"
    );
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [5, 0], [7, 0]), radius);
    // case 2
    y0 += 10;
    line0 = LineString3d.create([0, 0], [2, 0], [3, 0]);
    line1 = LineString3d.create([3, 0], [5, 0], [7, 0]);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for adjacent lines case 2"
    );
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [2, 0], [3, 0], [5, 0], [7, 0]), radius);
    // case 3
    y0 += 10;
    line0 = LineSegment3d.createXYXY(0, 0, 3, 0);
    line1 = LineString3d.create([3, 0], [5, 0], [7, 0]);
    chain = Path.create(line0, line1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for adjacent lines case 3"
    );
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([0, 0], [3, 0], [5, 0], [7, 0]), radius);

    // chain with a bspline child
    x0 += 10;
    y0 = 0;
    const degree = 3;
    const poleArray = [Point3d.create(0, 0), Point3d.create(1, 2), Point3d.create(3, 2), Point3d.create(4, 0)];
    const knotArray = [0, 1 / 5, 2 / 5, 3 / 5, 4 / 5, 1];
    const bspline = BSplineCurve3d.create(poleArray, knotArray, degree + 1)!;
    chain = Path.create(bspline);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for filleted linestring with a bspline child"
    );

    // chain with anti-parallel adjacent children
    x0 += 20;
    y0 = 0;
    // case 1
    line = LineSegment3d.createXYXY(-5, 5, 0, 5);
    let arc0 = Arc3d.createXY(Point3d.create(0, 0), 5, AngleSweep.createStartEndDegrees(90, 180));
    chain = Path.create(line, arc0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for anti-parallel case 1"
    );
    // call with relaxed validation
    let childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    let childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for anti-parallel case 1 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for anti-parallel case 1 with relaxed validation"
    );
    verifyPointsAndRadii(pointsAndRadii!, LineString3d.create([-5, 5], [0, 5], [-5, 5], [-5, 0]), [0, 0, 5, 0]);
    // case 2
    y0 += 10;
    let arc1 = Arc3d.createXY(Point3d.create(0, 10), 5, AngleSweep.createStartEndDegrees(180, 270));
    chain = Path.create(arc1, arc0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for anti-parallel case 2"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for anti-parallel case 2 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for anti-parallel case 2 with relaxed validation"
    );
    verifyPointsAndRadii(
      pointsAndRadii!,
      LineString3d.create([-5, 10], [-5, 5], [0, 5], [-5, 5], [-5, 0]),
      [0, 5, 0, 5, 0]
    );

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
      ck.testUndefined(
        pointsAndRadii,
        "expect fromFilletedLineString to return undefined for special degenerate case 1"
      );
      // call with relaxed validation
      childCountBefore = chain.children.length;
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      childCountAfter = chain.children.length;
      ck.testExactNumber(
        childCountBefore, childCountAfter,
        "fromFilletedLineString must not mutate the input path for special degenerate case 1 with relaxed validation",
      );
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for special degenerate case 1 with relaxed validation"
      );
      let expectedLineString0: LineString3d;
      let expectedRadii0: number[] | number;
      // joints between arcs are added to the output
      if (filletClosure) {
        expectedLineString0 = LineString3d.create([0, s / 2], [0, 0], [s / 2, 0], [s, 0], [s, s / 2], [s, s], [s / 2, s], [0, s], [0, s / 2]);
        expectedRadii0 = [0, s / 2, 0, s / 2, 0, s / 2, 0, s / 2, 0];
      } else {
        expectedLineString0 = LineString3d.create([0, 0], [s, 0], [s, s / 2], [s, s], [0, s]);
        expectedRadii0 = [0, s / 2, 0, s / 2, 0];
      }
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, expectedRadii0);
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
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for " +
        "special degenerate case 1 with zero length segments added to make chain valid"
      );
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, expectedRadii0);

      // case 2
      y0 += 10;
      radius = s;
      chain = CurveFactory.createFilletsInLineString(square, radius, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(
        pointsAndRadii,
        "expect fromFilletedLineString to return undefined for special degenerate case 2"
      );
      // call with relaxed validation
      childCountBefore = chain.children.length;
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      childCountAfter = chain.children.length;
      ck.testExactNumber(
        childCountBefore, childCountAfter,
        "fromFilletedLineString must not mutate the input path for special degenerate case 2 with relaxed validation",
      );
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for special degenerate case 2 with relaxed validation"
      );
      if (filletClosure)
        expectedLineString0 = LineString3d.create([0, 0], [s, 0], [s, s], [0, s], [0, 0]);
      else
        expectedLineString0 = square;
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, radius);
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
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for " +
        "special degenerate case 2 with zero length segments added to make chain valid"
      );
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, radius);

      // case 3
      y0 += 10;
      radii = [0, s, 0, s];
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(
        pointsAndRadii,
        "expect fromFilletedLineString to return undefined for special degenerate case 3"
      );
      // call with relaxed validation
      childCountBefore = chain.children.length;
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      childCountAfter = chain.children.length;
      ck.testExactNumber(
        childCountBefore, childCountAfter,
        "fromFilletedLineString must not mutate the input path for special degenerate case 3 with relaxed validation",
      );
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for special degenerate case 3 with relaxed validation"
      );
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, radius);
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
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for " +
        "special degenerate case 3 with zero length segments added to make chain valid"
      );
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, radius);

      // case 4
      y0 += 10;
      radii = [0, s / 2, 0, s / 2];
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii for special degenerate case 4"
      );
      if (filletClosure)
        expectedRadii0 = [0, s / 2, 0, s / 2, 0];
      else
        expectedRadii0 = radii;
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, expectedRadii0);
      y0 += 10;
      radii = [0, s / 2, s / 2, 0];

      // case 5
      chain = CurveFactory.createFilletsInLineString(square, radii, { allowCusp: false, filletClosure })!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
      ck.testUndefined(
        pointsAndRadii,
        "expect fromFilletedLineString to return undefined for special degenerate case 5"
      );
      // call with relaxed validation
      childCountBefore = chain.children.length;
      pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
      childCountAfter = chain.children.length;
      ck.testExactNumber(
        childCountBefore, childCountAfter,
        "fromFilletedLineString must not mutate the input path for special degenerate case 5 with relaxed validation",
      );
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for special degenerate case 5 with relaxed validation"
      );
      // joints between arcs are added to the output
      if (filletClosure) {
        expectedLineString0 = LineString3d.create([0, 0], [s, 0], [s, s / 2], [s, s], [0, s], [0, 0]);
        expectedRadii0 = [0, s / 2, 0, s / 2, 0, 0];
      } else {
        expectedLineString0 = LineString3d.create([0, 0], [s, 0], [s, s / 2], [s, s], [0, s]);
        expectedRadii0 = [0, s / 2, 0, s / 2, 0];
      }

      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, expectedRadii0);
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
      ck.testDefined(
        pointsAndRadii,
        "expect to be able to extract points and radii from filleted linestring for " +
        "special degenerate case 5 with zero length segments added to make chain valid"
      );
      verifyPointsAndRadii(pointsAndRadii!, expectedLineString0, expectedRadii0);
    }

    // extra special degenerate cases
    x0 += 10;
    y0 = 0;
    // case 1
    lineString = LineString3d.create([0, 0], [0, 5], [5, 5], [0, 8]);
    radii = [0, 5, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 1"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 1 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 1 with relaxed validation"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii);

    // case 2
    y0 += 10;
    lineString = LineString3d.create([0, 0], [0, 5], [5, 5], [8, 0]);
    radii = [0, 5, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 2"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 2 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 2 with relaxed validation"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii);

    // case 3
    y0 += 10;
    lineString = LineString3d.create([0, 0], [2, 2], [4, 2], [4, 0], [6, 0], [6, 2], [8, 3]);
    radii = [0, 0, 2, 0, 2, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 3"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 3 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 3 with relaxed validation"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii);

    // case 4
    y0 += 10;
    lineString = LineString3d.create([0, 0], [2, 2], [4, 2], [6, -2], [8, -2], [8, 2]);
    radii = [0, 0, 2, 2, 2, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 4"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 4 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 4 with relaxed validation"
    );
    verifyPointsAndRadii(pointsAndRadii!, lineString, radii);

    // case 5
    y0 += 10;
    lineString = LineString3d.create([0, -4], [4, 0], [4, -1], [6, -1], [6, 0], [10, -4]);
    radii = [0, 0, 1, 1, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 5"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 5 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 5 with relaxed validation"
    );
    let expectedLineString = LineString3d.create([0, -4], [4, 0], [4, -1], [5, -1], [6, -1], [6, 0], [10, -4]);
    let expectedRadii = [0, 0, 1, 0, 1, 0, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 6
    y0 += 10;
    lineString = LineString3d.create([0, 0], [4, 0], [4, 2], [8, 2], [8, 0], [6, -2]);
    radii = [0, 0, 2, 2, 0, 0];
    chain = CurveFactory.createFilletsInLineString(lineString, radii, { allowCusp: false, filletClosure: false })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for extra special degenerate case 6"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for extra special degenerate case 6 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for extra special degenerate case 6 with relaxed validation"
    );
    expectedLineString = LineString3d.create([0, 0], [4, 0], [4, 2], [6, 2], [8, 2], [8, 0], [6, -2]);
    expectedRadii = [0, 0, 2, 0, 2, 0, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // 180+ degree sweeps
    x0 += 20;
    y0 = 0;
    // case 1: 180 degree sweep
    chain = Path.create(Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(0, 180)));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for 180+ degree sweeps case 1"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for 180+ degree sweeps case 1 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 180+ degree sweeps case 1 with relaxed validation"
    );
    expectedLineString = LineString3d.create([3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0]);
    expectedRadii = [0, 3, 0, 3, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 2: 270 degree sweep with anti-parallel line segments on either side
    y0 += 10;
    chain = Path.create(
      LineSegment3d.createXYXY(3, 8, 3, 0),
      Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(0, 270)),
      LineSegment3d.createXYXY(0, -3, -8, -3)
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for 180+ degree sweeps case 2"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for 180+ degree sweeps case 2 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 180+ degree sweeps case 2 with relaxed validation"
    );
    expectedLineString = LineString3d.create(
      [3, 8], [3, 0], [3, 7.24264069], [-2.12132034, 2.12132034], [-7.24264069, -3], [0, -3], [-8, -3]
    );
    expectedRadii = [0, 0, 3, 0, 3, 0, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 3: 270 degree sweep with non-parallel line segments on either side
    y0 += 10;
    chain = Path.create(
      LineSegment3d.createXYXY(10, 8, 3, 0),
      Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(0, 270)),
      LineSegment3d.createXYXY(0, -3, -8, -10)
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for 180+ degree sweeps case 3"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for 180+ degree sweeps case 3 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 180+ degree sweeps case 3 with relaxed validation"
    );
    expectedLineString = LineString3d.create(
      [10, 8], [3, 0], [3, 7.24264069], [-2.12132034, 2.12132034], [-7.24264069, -3], [0, -3], [-8, -10]
    );
    expectedRadii = [0, 0, 3, 0, 3, 0, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 4: 3 neighbor arcs; middle one with 270 degree sweep
    y0 += 10;
    chain = Path.create(
      Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(0, 30)),
      Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(30, 300)),
      Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(300, 330))
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for 180+ degree sweeps case 4"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for 180+ degree sweeps case 4 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 180+ degree sweeps case 4 with relaxed validation"
    );
    expectedLineString = LineString3d.create(
      [3, 0], [3, 0.80384758], [2.59807621, 1.5], [-1.02324413, 7.77231083], [-2.89777748, 0.77645713],
      [-4.77231083, -6.21939656], [1.5, -2.59807621], [2.19615242, -2.19615242], [2.59807621, -1.5]
    );
    expectedRadii = [0, 3, 0, 3, 0, 3, 0, 3, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 5: 1 large arcs broken to 3 smaller arcs by the caller with zero-length segments in between
    y0 += 10;
    arc0 = Arc3d.createXY(Point3d.create(), 1, AngleSweep.createStartEndDegrees(0, 90));
    const zeroLengthSegment0 = LineSegment3d.create(Point3d.create(0, 1), Point3d.create(0, 1));
    arc1 = Arc3d.createXY(Point3d.create(), 1, AngleSweep.createStartEndDegrees(90, 180));
    const zeroLengthSegment1 = LineSegment3d.create(Point3d.create(-1, 0), Point3d.create(-1, 0));
    const arc2 = Arc3d.createXY(Point3d.create(), 1, AngleSweep.createStartEndDegrees(180, 270));
    chain = Path.create(arc0, zeroLengthSegment0, arc1, zeroLengthSegment1, arc2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 180+ degree sweeps case 5"
    );
    expectedLineString = LineString3d.create([1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]);
    expectedRadii = [0, 1, 0, 1, 0, 1, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // case 6: full circle (360 degree sweep)
    y0 += 10;
    chain = Path.create(Arc3d.createXY(Point3d.create(0, 0), 3, AngleSweep.createStartEndDegrees(0, 360)));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain);
    ck.testUndefined(
      pointsAndRadii,
      "expect fromFilletedLineString to return undefined for 360 degree sweeps case 6"
    );
    // call with relaxed validation
    childCountBefore = chain.children.length;
    pointsAndRadii = CurveFactory.fromFilletedLineString(chain, { relaxedValidation: true });
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path for 360 degree sweeps case 6 with relaxed validation",
    );
    ck.testDefined(
      pointsAndRadii,
      "expect to be able to extract points and radii from filleted linestring for 360 degree sweeps case 6 with relaxed validation"
    );
    expectedLineString = LineString3d.create(
      [3, 0], [3, 5.19615242], [-1.5, 2.59807621], [-6, 0], [-1.5, -2.59807621], [3, -5.19615242], [3, 0]
    );
    expectedRadii = [0, 3, 0, 3, 0, 3, 0];
    verifyPointsAndRadii(pointsAndRadii!, expectedLineString, expectedRadii);

    // Loop input
    x0 += 10;
    y0 = 0;
    radius = 0.5;
    lineString = LineString3d.create(
      Point3d.create(0, 0, 0),
      Point3d.create(4, 0, 0),
      Point3d.create(4, 4, 0),
      Point3d.create(0, 4, 0),
      Point3d.create(0, 0, 0),
    );
    const path = CurveFactory.createFilletsInLineString(lineString, radius, { allowCusp: false, filletClosure: true })!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path, x0, y0);
    const loop = Loop.create(...path.children);

    pointsAndRadii = CurveFactory.fromFilletedLineString(loop);
    ck.testDefined(pointsAndRadii, "expect fromFilletedLineString to work on Loop");
    verifyPointsAndRadii(pointsAndRadii!, lineString, radius);

    // fromFilletedLineString should not mutate the input path
    x0 += 10;
    y0 = 0;
    // case 1
    let seg = LineSegment3d.create(Point3d.create(), Point3d.create(1, 0));
    let arc = Arc3d.createXY(Point3d.create(1, 1), 1, AngleSweep.createStartEndDegrees(270, 360));
    chain = Path.create(seg, arc);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    childCountBefore = chain.children.length;
    CurveFactory.fromFilletedLineString(chain);
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path (case 1)",
    );
    // case 2
    y0 += 10;
    arc = Arc3d.createXY(Point3d.create(1, 1), 1, AngleSweep.createStartEndDegrees(270, 360));
    seg = LineSegment3d.create(Point3d.create(2, 1), Point3d.create(2, 2));
    chain = Path.create(arc, seg);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    childCountBefore = chain.children.length;
    CurveFactory.fromFilletedLineString(chain);
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path (case 2)",
    );
    // case 3
    y0 += 10;
    arc0 = Arc3d.createXY(Point3d.create(1, 1), 1, AngleSweep.createStartEndDegrees(180, 270));
    arc1 = Arc3d.createXY(Point3d.create(1, 1), 1, AngleSweep.createStartEndDegrees(270, 360));
    chain = Path.create(arc0, arc1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, chain, x0, y0);
    childCountBefore = chain.children.length;
    CurveFactory.fromFilletedLineString(chain);
    childCountAfter = chain.children.length;
    ck.testExactNumber(
      childCountBefore, childCountAfter,
      "fromFilletedLineString must not mutate the input path (case 3)",
    );

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "fromFilletedLineString");
    expect(ck.getNumErrors()).toBe(0);
  });

  it("filletedLineStringRoundTrip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    // data from ADO bug 1998982; this particular data survives a roundtrip because data
    // has lots of near-duplicate points and also because we allow cusps in the path
    let pointsAndRadii1: [Point3d, number][] = [
      [Point3d.create(0, 0, 0), 0],
      [Point3d.create(-2.6918023365851695e-10, -1.8883916652612243e-10, 0), 0],
      [Point3d.create(9.141128167813974, -10.15376746232603, 0), 13.716000000000008],
      [Point3d.create(19.33065738750156, -1.0525196278467774, 0), 0],
      [Point3d.create(19.33065738726873, -1.0525196278467774, 0), 0],
      [Point3d.create(24.07056010211818, 3.1811430249363184, 0), 0],
      [Point3d.create(24.07056010209622, 3.181143025033985, 0), 0],
      [Point3d.create(26.34379524301602, 5.211587803744564, 0), 3.048],
      [Point3d.create(24.313350463751704, 7.484822943806648, 0), 0],
      [Point3d.create(24.313350463169627, 7.484822944737971, 0), 0],
      [Point3d.create(20.81286366446875, 11.403880324214697, 0), 0],
      [Point3d.create(20.812863664481313, 11.403880324369268, 0), 0],
      [Point3d.create(20.203730231220618, 12.085850865715315, 0), 0.914399999999997],
      [Point3d.create(19.521759689436294, 11.476717432960868, 0), 0],
      [Point3d.create(19.521759689436294, 11.476717432960868, 0), 0],
      [Point3d.create(16.111906983307563, 8.431050271727145, 0), 0],
      [Point3d.create(6.974905477487482, 18.660608398728073, 0), 0],
      [Point3d.create(10.384770585806109, 21.706261687912047, 0), 0],
      [Point3d.create(10.384770585759457, 21.706261688185414, 0), 0],
      [Point3d.create(11.066739784620795, 22.315393921982235, 0), 0.9143999999999965],
      [Point3d.create(10.457608894095756, 22.997364320792258, 0), 0],
      [Point3d.create(10.457608893862925, 22.997364320792258, 0), 0],
      [Point3d.create(2.207813488901593, 32.23366532754153, 0), 0],
      [Point3d.create(2.207813489073398, 32.23366532792781, 0), 0],
      [Point3d.create(1.5986800559286676, 32.9156358705522, 0), 0.9144000000000077],
      [Point3d.create(0.9167095134034753, 32.306502437219024, 0), 0],
      [Point3d.create(0.9167095135198906, 32.306502437219024, 0), 0],
      [Point3d.create(-2.4931613869266585, 29.260819028131664, 0), 0],
      [Point3d.create(-18.939764092792757, 47.67402366083115, 0), 0],
      [Point3d.create(-15.529911386198364, 50.719690824858844, 0), 0],
      [Point3d.create(-15.529911386152255, 50.71969082511107, 0), 0],
      [Point3d.create(-14.847940843086377, 51.32882425950362, 0), 0.9144000000000048],
      [Point3d.create(-15.457074278499931, 52.01079480163753, 0), 0],
      [Point3d.create(-15.457074278499931, 52.01079480163753, 0), 0],
      [Point3d.create(-16.06620771123562, 52.69276534020901, 0), 0],
      [Point3d.create(-16.066207711451632, 52.6927653402095, 0), 0],
      [Point3d.create(-16.6753411439156, 53.374735879099134, 0), 0.9143999999999919],
      [Point3d.create(-17.357311684754677, 52.76560244895518, 0), 0],
      [Point3d.create(-17.357311684987508, 52.76560244895518, 0), 0],
      [Point3d.create(-20.767164392978884, 49.71993528865278, 0), 0],
      [Point3d.create(-39.04116739775054, 70.17905154824257, 0), 0],
      [Point3d.create(-35.631314691272564, 73.22471871599555, 0), 0],
      [Point3d.create(-35.63131469130913, 73.22471871565855, 0), 0],
      [Point3d.create(-34.94934415100758, 73.83385214827057, 0), 0.9143999999999939],
      [Point3d.create(-35.55847758217715, 74.51582268998027, 0), 0],
      [Point3d.create(-35.55847758229356, 74.51582268998027, 0), 0],
      [Point3d.create(-36.1676110123517, 75.19779323041439, 0), 0],
      [Point3d.create(-36.16761101222522, 75.1977932303301, 0), 0],
      [Point3d.create(-36.776744446202905, 75.87976377483422, 0), 0.9144000000000252],
      [Point3d.create(-37.4587149892468, 75.27063033916056, 0), 0],
      [Point3d.create(-37.458714989130385, 75.27063033916056, 0), 0],
      [Point3d.create(-40.86856769386213, 72.22496317513287, 0), 0],
      [Point3d.create(-51.83296950510703, 84.5004329290241, 0), 0],
      [Point3d.create(-47.803578049410135, 88.09946968220174, 0), 0],
      [Point3d.create(-47.803578049449236, 88.09946968258132, 0), 0],
      [Point3d.create(-47.30371955327791, 88.54594134440035, 0), 0.9144000000000031],
      [Point3d.create(-47.57900350773707, 89.1570176128298, 0), 0],
      [Point3d.create(-47.579003507853486, 89.1570176128298, 0), 0],
      [Point3d.create(-47.82938843744341, 89.71282293926924, 0), 0],
      [Point3d.create(-41.66404071659781, 91.76120727881789, 0), 0],
      [Point3d.create(-40.16707298916299, 90.08516914770007, 0), 0],
      [Point3d.create(-40.167072989162506, 90.08516914805963, 0), 0],
      [Point3d.create(-38.338428725437595, 88.03792535281393, 0), 2.7432000000000256],
      [Point3d.create(-36.29239968955517, 89.86792868189514, 0), 0],
      [Point3d.create(-36.29239968955517, 89.86792868189514, 0), 0],
      [Point3d.create(-35.02016006386839, 91.00584154110402, 0), 0],
      [Point3d.create(-35.020160063886514, 91.00584154080927, 0), 0],
      [Point3d.create(-33.294162271050546, 92.5496034577201, 0), 3.0479999999999836],
      [Point3d.create(-34.31871583103202, 94.62627368699759, 0), 0],
      [Point3d.create(-34.31871583114844, 94.62627368699759, 0), 0],
      [Point3d.create(-18.512114439276047, 105.7709195734933, 0), 0],
      [Point3d.create(-16.58410938747693, 107.4953602347523, 0), 0],
      [Point3d.create(-16.584109387602695, 107.49536023516826, 0), 0],
    ];
    let points1 = pointsAndRadii1.map(([point, _]) => point);
    let radii1 = pointsAndRadii1.map(([_, radius]) => radius);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, points1);
    ck.testExactNumber(points1.length, radii1.length, "expect points and radii arrays to be the same length");

    let path1 = CurveFactory.createFilletsInLineString(points1, radii1)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path1);
    let pointsAndRadii2 = CurveFactory.fromFilletedLineString(path1);
    ck.testDefined(pointsAndRadii2, "expect to be able to extract points and radii from filleted linestring");

    if (pointsAndRadii2) {
      ck.testExactNumber(pointsAndRadii1.length, pointsAndRadii2.length, "expect same number of points and radii after round trip");
      for (let i = 0; i < pointsAndRadii1.length; i++) {
        const [p1, r1] = pointsAndRadii1[i];
        const [p2, r2] = pointsAndRadii2[i];
        ck.testPoint3d(p1, p2, `expect point ${i} to match after round trip`);
        ck.testCoordinate(r1, r2, `expect radius ${i} to match after round trip`);
      }
    }

    // clean data (removed near-duplicate points and unnecessary collinear points)
    pointsAndRadii1 = [
      [Point3d.create(0, 0, 0), 0],
      [Point3d.create(-2.6918023365851695e-10, -1.8883916652612243e-10, 0), 0],
      [Point3d.create(9.141128167813974, -10.15376746232603, 0), 13.716000000000008],
      [Point3d.create(19.33065738750156, -1.0525196278467774, 0), 0],
      [Point3d.create(19.33065738726873, -1.0525196278467774, 0), 0],
      [Point3d.create(24.07056010211818, 3.1811430249363184, 0), 0],
      [Point3d.create(24.07056010209622, 3.181143025033985, 0), 0],
      [Point3d.create(26.34379524301602, 5.211587803744564, 0), 3.048],
      [Point3d.create(24.313350463751704, 7.484822943806648, 0), 0],
      [Point3d.create(24.313350463169627, 7.484822944737971, 0), 0],
      [Point3d.create(20.81286366446875, 11.403880324214697, 0), 0],
      [Point3d.create(20.812863664481313, 11.403880324369268, 0), 0],
      [Point3d.create(20.203730231220618, 12.085850865715315, 0), 0.914399999999997],
      [Point3d.create(19.521759689436294, 11.476717432960868, 0), 0],
      [Point3d.create(19.521759689436294, 11.476717432960868, 0), 0],
      [Point3d.create(16.111906983307563, 8.431050271727145, 0), 0],
      [Point3d.create(6.974905477487482, 18.660608398728073, 0), 0],
      [Point3d.create(10.384770585806109, 21.706261687912047, 0), 0],
      [Point3d.create(10.384770585759457, 21.706261688185414, 0), 0],
      [Point3d.create(11.066739784620795, 22.315393921982235, 0), 0.9143999999999965],
      [Point3d.create(10.457608894095756, 22.997364320792258, 0), 0],
      [Point3d.create(10.457608893862925, 22.997364320792258, 0), 0],
      [Point3d.create(2.207813488901593, 32.23366532754153, 0), 0],
      [Point3d.create(2.207813489073398, 32.23366532792781, 0), 0],
      [Point3d.create(1.5986800559286676, 32.9156358705522, 0), 0.9144000000000077],
      [Point3d.create(0.9167095134034753, 32.306502437219024, 0), 0],
      [Point3d.create(0.9167095135198906, 32.306502437219024, 0), 0],
      [Point3d.create(-2.4931613869266585, 29.260819028131664, 0), 0],
      [Point3d.create(-18.939764092792757, 47.67402366083115, 0), 0],
      [Point3d.create(-15.529911386198364, 50.719690824858844, 0), 0],
      [Point3d.create(-15.529911386152255, 50.71969082511107, 0), 0],
      [Point3d.create(-14.847940843086377, 51.32882425950362, 0), 0.9144000000000048],
      [Point3d.create(-15.457074278499931, 52.01079480163753, 0), 0],
      [Point3d.create(-15.457074278499931, 52.01079480163753, 0), 0],
      [Point3d.create(-16.06620771123562, 52.69276534020901, 0), 0],
      [Point3d.create(-16.066207711451632, 52.6927653402095, 0), 0],
      [Point3d.create(-16.6753411439156, 53.374735879099134, 0), 0.9143999999999919],
      [Point3d.create(-17.357311684754677, 52.76560244895518, 0), 0],
      [Point3d.create(-17.357311684987508, 52.76560244895518, 0), 0],
      [Point3d.create(-20.767164392978884, 49.71993528865278, 0), 0],
      [Point3d.create(-39.04116739775054, 70.17905154824257, 0), 0],
      [Point3d.create(-35.631314691272564, 73.22471871599555, 0), 0],
      [Point3d.create(-35.63131469130913, 73.22471871565855, 0), 0],
      [Point3d.create(-34.94934415100758, 73.83385214827057, 0), 0.9143999999999939],
      [Point3d.create(-35.55847758217715, 74.51582268998027, 0), 0],
      [Point3d.create(-35.55847758229356, 74.51582268998027, 0), 0],
      [Point3d.create(-36.1676110123517, 75.19779323041439, 0), 0],
      [Point3d.create(-36.16761101222522, 75.1977932303301, 0), 0],
      [Point3d.create(-36.776744446202905, 75.87976377483422, 0), 0.9144000000000252],
      [Point3d.create(-37.4587149892468, 75.27063033916056, 0), 0],
      [Point3d.create(-37.458714989130385, 75.27063033916056, 0), 0],
      [Point3d.create(-40.86856769386213, 72.22496317513287, 0), 0],
      [Point3d.create(-51.83296950510703, 84.5004329290241, 0), 0],
      [Point3d.create(-47.803578049410135, 88.09946968220174, 0), 0],
      [Point3d.create(-47.803578049449236, 88.09946968258132, 0), 0],
      [Point3d.create(-47.30371955327791, 88.54594134440035, 0), 0.9144000000000031],
      [Point3d.create(-47.57900350773707, 89.1570176128298, 0), 0],
      [Point3d.create(-47.579003507853486, 89.1570176128298, 0), 0],
      [Point3d.create(-47.82938843744341, 89.71282293926924, 0), 0],
      [Point3d.create(-41.66404071659781, 91.76120727881789, 0), 0],
      [Point3d.create(-40.16707298916299, 90.08516914770007, 0), 0],
      [Point3d.create(-40.167072989162506, 90.08516914805963, 0), 0],
      [Point3d.create(-38.338428725437595, 88.03792535281393, 0), 2.7432000000000256],
      [Point3d.create(-36.29239968955517, 89.86792868189514, 0), 0],
      [Point3d.create(-36.29239968955517, 89.86792868189514, 0), 0],
      [Point3d.create(-35.02016006386839, 91.00584154110402, 0), 0],
      [Point3d.create(-35.020160063886514, 91.00584154080927, 0), 0],
      [Point3d.create(-33.294162271050546, 92.5496034577201, 0), 3.0479999999999836],
      [Point3d.create(-34.31871583103202, 94.62627368699759, 0), 0],
      [Point3d.create(-34.31871583114844, 94.62627368699759, 0), 0],
      [Point3d.create(-18.512114439276047, 105.7709195734933, 0), 0],
      [Point3d.create(-16.58410938747693, 107.4953602347523, 0), 0],
      [Point3d.create(-16.584109387602695, 107.49536023516826, 0), 0],
    ];
    points1 = pointsAndRadii1.map(([point, _]) => point);
    radii1 = pointsAndRadii1.map(([_, radius]) => radius);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, points1);
    ck.testExactNumber(points1.length, radii1.length, "expect points and radii arrays to be the same length");

    path1 = CurveFactory.createFilletsInLineString(points1, radii1)!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, path1);
    pointsAndRadii2 = CurveFactory.fromFilletedLineString(path1);
    ck.testDefined(pointsAndRadii2, "expect to be able to extract points and radii from filleted linestring");

    if (pointsAndRadii2) {
      ck.testExactNumber(pointsAndRadii1.length, pointsAndRadii2.length, "expect same number of points and radii after round trip");
      for (let i = 0; i < pointsAndRadii1.length; i++) {
        const [p1, r1] = pointsAndRadii1[i];
        const [p2, r2] = pointsAndRadii2[i];
        ck.testPoint3d(p1, p2, `expect point ${i} to match after round trip`);
        ck.testCoordinate(r1, r2, `expect radius ${i} to match after round trip`);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveFactory", "filletedLineStringRoundTrip");
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

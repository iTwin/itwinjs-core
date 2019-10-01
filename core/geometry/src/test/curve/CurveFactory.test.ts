/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { expect } from "chai";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { CurveFactory } from "../../curve/CurveFactory";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Angle } from "../../geometry3d/Angle";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Arc3d } from "../../curve/Arc3d";
import { LineSegment3d } from "../../curve/LineSegment3d";
/* tslint:disable:no-console */

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

    expect(ck.getNumErrors()).equals(0);
  });
  it("FilletArcDegenerate", () => {
    const ck = new Checker();

    const point0 = Point3d.create(1, 2, 3);
    const point2 = Point3d.create(4, 2, -1);
    const radius = 2.0;
    for (const lambda of [0.0, -0.52, 0.45, 1.2, 1.0]) {
      const point1 = point0.interpolate(lambda, point2);
      const data = Arc3d.createFilletArc(point0, point1, point2, radius);
      ck.testDefined (data, "Degenerated arc data");
      ck.testUndefined(data.arc, "Degenerate arc -- expect no arc in data");
      }
    expect(ck.getNumErrors()).equals(0);
  });
  it("appendToArcInPlace", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const xStep = 3.0;
    const yStep = 3.0;
    for (const arcA0 of [
      Arc3d.createXYZXYZXYZ(0, 0, 0, 2, 0, 0, 0, 2, 0, AngleSweep.createStartEndDegrees(0, 90)),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 0, 0), Point3d.create(1.5, 1, 0), Point3d.create(1, 2, 0)) as Arc3d,
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
            arcB1.sweep = AngleSweep.createStartEnd(arcB1.sweep.fractionToAngle(segment.x0), arcB1.sweep.fractionToAngle(segment.x1));
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
    expect(ck.getNumErrors()).equals(0);
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
function markArcData(allGeometry: GeometryQuery[], arc: Arc3d, radialFraction: number, tickFraction: number, x0: number, y0: number) {
  const arc1 = arc.clone();
  const center = arc.center;
  const start = arc.startPoint();
  const point0 = arc.angleToPointAndDerivative(Angle.createDegrees(0));
  const point90 = arc.angleToPointAndDerivative(Angle.createDegrees(90));
  arc1.matrixRef.scaleColumnsInPlace(radialFraction, radialFraction, 1.0);
  GeometryCoreTestIO.captureGeometry(allGeometry, [arc1,
    LineSegment3d.create(center.interpolate(radialFraction, start), center.interpolate(radialFraction + tickFraction, start)),
    LineString3d.create(point0.origin, center, point90.origin)], x0, y0);
}

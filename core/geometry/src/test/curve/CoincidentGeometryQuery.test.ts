/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { CoincidentGeometryQuery } from "../../geometry3d/CoincidentGeometryOps";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";

describe("CoincidentGeometryQuery", () => {

  it("SegmentSegment", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const context = CoincidentGeometryQuery.create();
    const pointA0 = Point3d.create(0, 0, 0);
    const pointA1 = Point3d.create(1, 0, 0);
    const fractionsOnA = [-2, -1.5, 0, 0.25, 0.75, 1.0, 1.5, 2];
    let x0 = 0.0;
    const xStep = 10.0;
    const yStep = 1.0;
    const dy0 = 0;
    const dy1 = 0.05;
    const dy2 = 0.1;
    const dy3 = dy2 + dy1 - dy0;
    const endMarkerSize = 0.075;
    const range01 = Range1d.createXX(0, 1);
    for (const fA0 of fractionsOnA) {
      let y0 = 0.0;
      for (const fA1 of fractionsOnA) {
        if (fA1 === fA0)   // only do non trivial
          continue;
        const rangeA = Range1d.createXX(fA0, fA1);
        const rangeA01 = rangeA.intersect(range01);
        const pointB0 = pointA0.interpolate(fA0, pointA1);
        const pointB1 = pointA0.interpolate(fA1, pointA1);
        const pair = context.coincidentSegmentRangeXY(pointA0, pointA1, pointB0, pointB1, true);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA0, pointA1), x0, y0 + dy0);
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointB0, pointB1), x0, y0 + dy1);
        const qB = pointB0;
        qB.y += dy1;
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pointA0, qB), x0, y0);

        const expectPair = !rangeA01.isNull;
        if (pair) {
          const pA = pair.detailA.point.clone();
          const pB = pair.detailB.point.clone();
          pA.y += y0 + dy2;
          pB.y += y0 + dy3;
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(pA, pB), x0, 0);
          GeometryCoreTestIO.captureCurveLocationDetails(allGeometry, pair, 0.01, x0, y0);
          if (pair.detailA.point1 && !ck.testCoordinate(rangeA01.length(), pair.detailA.point.distance(pair.detailA.point1), "length A", fA0, fA1))
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointA0.interpolate(2.0, pointA1), endMarkerSize, x0, y0);
          if (pair.detailB.point1 && !ck.testCoordinate(rangeA01.length(), pair.detailB.point.distance(pair.detailB.point1), "length B", fA0, fA1))
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointB0.interpolate(2.0, pointB1), endMarkerSize, x0, y0 + dy1);
        } else {
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, pointA0, 0.2, x0, y0);
        }
        ck.testBoolean(expectPair, pair !== undefined, prettyPrint([[pointA0, pointA1], [pointB0, pointB1]]), pair, fA0, fA1);
        context.coincidentSegmentRangeXY(pointA0, pointA1, pointB0, pointB1, true);
        y0 += yStep;
      }
      x0 += xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CoincidentGeometryQuery", "SegmentSegment");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DetailSwap", () => {
    const ck = new Checker();
    const detailA = CurveLocationDetail.create();
    const detailB = CurveLocationDetail.create();
    const f0 = 0.25;
    const f1 = 0.90;
    const pointA = Point3d.create(1, 2, 3);
    const pointB = Point3d.create(5, 9, 7);
    CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(detailA, f0, f1, pointA, pointB);
    CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(detailB, f1, f0, pointA, pointB, true);
    ck.testExactNumber(detailA.fraction, detailB.fraction);
    ck.testExactNumber(detailA.fraction1!, detailB.fraction1!);
    ck.testPoint3d(detailA.point, detailB.point);
    ck.testPoint3d(detailA.point1!, detailB.point1!);
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const context = CoincidentGeometryQuery.create();
    const arcs = [];
    arcs.push(Arc3d.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, AngleSweep.createStartEndDegrees(45, 180)));
    arcs.push(Arc3d.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, AngleSweep.createStartEndDegrees(90, -20)));
    arcs.push(Arc3d.createXYZXYZXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, AngleSweep.createStartSweepDegrees(90, 310)));
    // const fractionsOnA = [-2, -1.5, 0, 0.25, 0.75, 1.0, 1.5, 2];
    const fractionsOnA = [-0.25, 0, 0.25, 0.75, 1, 1.25];
    const markerSize = 0.01;
    let x0 = 0.0;
    const xStep = 5.0;
    const yStep = 5.0;
    for (const arcA of arcs) {
      for (const fA0 of fractionsOnA) {
        let y0 = 0.0;
        for (const fA1 of fractionsOnA) {
          if (fA1 === fA0)   // only do non trivial
            continue;
          const arcB = arcA.clone();
          arcB.sweep.setStartEndRadians(arcA.sweep.fractionToRadians(fA0), arcA.sweep.fractionToRadians(fA1));
          const pairs = context.coincidentArcIntersectionXY(arcA, arcB, true);
          if (pairs !== undefined) {
            for (const p of pairs) {
              if (p.detailA.fraction1 !== undefined) {
                const fragmentA = arcA.clonePartialCurve(p.detailA.fraction, p.detailA.fraction1);
                if (fragmentA instanceof Arc3d) {
                  fragmentA.scaleAboutCenterInPlace(0.96);
                  GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, fragmentA.startPoint(), markerSize, x0, y0);
                  GeometryCoreTestIO.captureGeometry(allGeometry, fragmentA, x0, y0);
                }
              }
              if (p.detailB.fraction1 !== undefined) {
                const fragmentB = arcB.clonePartialCurve(p.detailB.fraction, p.detailB.fraction1);
                if (fragmentB instanceof Arc3d) {
                  fragmentB.scaleAboutCenterInPlace(1.04);
                  GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, fragmentB.startPoint(), markerSize, x0, y0);
                  GeometryCoreTestIO.captureGeometry(allGeometry, fragmentB, x0, y0);
                }
              }
            }
          }
          arcA.scaleAboutCenterInPlace(0.98);
          arcB.scaleAboutCenterInPlace(1.02);
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, arcA.startPoint(), markerSize, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, arcB.startPoint(), markerSize, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcA, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcB, x0, y0);

          y0 += yStep;
        }
        x0 += xStep;
      }
      x0 += 2 * xStep;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CoincidentGeometryQuery", "ArcArc");
    expect(ck.getNumErrors()).equals(0);
  });

});

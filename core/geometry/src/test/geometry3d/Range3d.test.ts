/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Geometry } from "../../Geometry";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range1d, Range2d, Range3d, RangeBase } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { prettyPrint } from "../testFunctions";

/* eslint-disable no-console */
// (assume points are distinct ...)
function exerciseWithTransformedPoints(ck: Checker, frame: Transform, points: Point3d[]) {
  const rangeA = Range3d.createTransformedArray(frame, points);
  const transformedPoints = frame.multiplyPoint3dArray(points)!;
  const inverseFrame = frame.inverse();
  if (inverseFrame) {
    const rangeQ = Range3d.createArray(points);
    const rangeQRoundTrip = Range3d.create();
    rangeQRoundTrip.extendInverseTransformedArray(transformedPoints, frame);
    ck.testRange3d(rangeQ, rangeQRoundTrip, prettyPrint(frame),
      prettyPrint(points.slice(0, 3)),
      prettyPrint(
        transformedPoints.slice(0, 3)));
    // const gPoints = GrowableXYZArray.create(points);
    const hPoints = GrowableXYZArray.create(transformedPoints);
    const gRangeRoundTrip = Range3d.createInverseTransformedArray(frame, hPoints);
    const gRangeInverse = Range3d.createTransformedArray(inverseFrame, hPoints);
    ck.testRange3d(rangeQ, gRangeRoundTrip);
    ck.testRange3d(rangeQ, gRangeInverse);

  }
  const rangeA1 = Range3d.create();
  const rangeB = Range3d.create();
  rangeB.extendArray(points, frame);
  ck.testTrue(rangeA.isAlmostEqual(rangeB));
  const q = Point3d.create();
  for (const p of points) {
    frame.multiplyPoint3d(p, q);
    // ck.testTrue(rangeA.containsPoint(p));
    ck.testTrue(rangeA.containsPoint(q));
    ck.testCoordinate(0, rangeA.distanceToPoint(q));
    ck.testTrue(rangeA.containsPointXY(q));
    ck.testTrue(rangeA.containsPointXY(q.plusXYZ(0, 0, 2.0 * rangeA.zLength() + 1)));
    rangeA1.extendTransformedPoint(frame, p);
  }
  ck.testPoint3d(rangeA.low, rangeB.low);
  ck.testPoint3d(rangeA.high, rangeB.high);

  const rangeC = Range3d.create();
  ck.testFalse(rangeC.isSinglePoint, "Empty range is not single point");
  if (points.length > 0) {
    rangeC.extend(points[0]);
    ck.testTrue(rangeC.isSinglePoint, "Single point range");
    rangeC.extend(points[0]);
    ck.testTrue(rangeC.isSinglePoint, "Single point range");
    ck.testTrue(rangeC.isAlmostZeroX, "single point range has zero xLength");
    ck.testTrue(rangeC.isAlmostZeroY, "single point range has zero yLength");
    ck.testTrue(rangeC.isAlmostZeroY, "single point range has zero zLength");
    // This definitely extends all directions . . .
    rangeC.extendXYZ(points[0].x + 3, points[0].y + 1, points[0].z - 4);
    ck.testFalse(rangeC.isSinglePoint, "not single point after expand");
    ck.testFalse(rangeC.isAlmostZeroX, "2 point range has nonzero xLength");
    ck.testFalse(rangeC.isAlmostZeroY, "2 range has nonzero yLength");
    ck.testFalse(rangeC.isAlmostZeroZ, "2 point range has nonzero zLength");
  }
  const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
  const testLattice = Sample.createPoint3dLattice(-0.1, 0.30, 1.1);
  const bigDist = 2.0 * rangeA.maxAbs() + 1;
  for (const uvw of testLattice) {
    const xyz = rangeA.fractionToPoint(uvw.x, uvw.y, uvw.z);
    ck.testBoolean(unitRange.containsPoint(uvw), rangeA.containsPoint(xyz));
    ck.testFalse(rangeA.containsXYZ(xyz.x + bigDist, xyz.y, xyz.z));
    ck.testFalse(rangeA.containsXYZ(xyz.x - bigDist, xyz.y, xyz.z));
    ck.testFalse(rangeA.containsXYZ(xyz.x, xyz.y + bigDist, xyz.z));
    ck.testFalse(rangeA.containsXYZ(xyz.x, xyz.y - bigDist, xyz.z));
    ck.testFalse(rangeA.containsXYZ(xyz.x, xyz.y, xyz.z + bigDist));
    ck.testFalse(rangeA.containsXYZ(xyz.x, xyz.y, xyz.z - bigDist));
  }
  const r01 = Range1d.createXX(0, 1);
  for (const f of [-0.25, 0.0011, 0.4, 0.998, 1.03, 9]) {
    ck.testBoolean(r01.containsX(f),
      rangeA.containsPoint(rangeA.diagonalFractionToPoint(f)), "points along diagonal");
  }
  const diagonal = rangeA.diagonal();
  ck.testCoordinate(
    rangeA.diagonal().magnitude(),
    rangeA.fractionToPoint(0, 0, 0).distance(rangeA.fractionToPoint(1, 1, 1)));

  ck.testCoordinate(rangeA.xLength(), diagonal.x);
  ck.testCoordinate(rangeA.yLength(), diagonal.y);
  ck.testCoordinate(rangeA.zLength(), diagonal.z);
}

function exerciseWithPoints(ck: Checker, points: Point3d[]) {
  const range = Range3d.createArray(points);
  const range1 = range.clone();
  const range2 = range.clone(Range3d.createNull());
  ck.testTrue(range1.isAlmostEqual(range));
  ck.testTrue(range2.isAlmostEqual(range));

  const range4 = Range3d.createNull();
  range4.extendArray(points);
  ck.testTrue(range.isAlmostEqual(range4), "create vs createAndExtend");

  const range5 = Range3d.createNull();
  // "extend" i blocks of 4 to exercise variable arg list ..
  for (let i = 0; i < points.length;) {
    if (i + 4 < points.length) {
      range5.extend(points[i], points[i + 1], points[i + 2], points[i + 3]);
      i += 4;
    } else {
      range5.extendPoint(points[i]);
      i++;
    }
  }
  ck.testTrue(range.isAlmostEqual(range5), "create vs createAndExtend");

  const range6 = Range3d.createNull();
  ck.testTrue(RangeBase.isExtremePoint3d(range6.low), "null range low is extreme");
  ck.testTrue(RangeBase.isExtremePoint3d(range6.high), "null range low is extreme");
  // "create" i blocks of 3 to exercise variable arg list ..
  for (let i = 0; i < points.length;) {
    if (i + 3 < points.length) {
      range6.extendRange(
        Range3d.create(points[i], points[i + 1], points[i + 2]));
      i += 3;
    } else {
      range6.extendRange(Range3d.createXYZ(points[i].x, points[i].y, points[i].z));
      i++;
    }
  }

  ck.testFalse(RangeBase.isExtremePoint3d(range6.low), "Live range low is not extreme");
  ck.testFalse(RangeBase.isExtremePoint3d(range6.high), "live range high is not extreme");

}
describe("Range3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const lattice1 = Sample.createPoint3dLattice(-1, 1.3, 4);
    const frames = Sample.createRigidTransforms();
    exerciseWithPoints(ck, lattice1);
    for (const frame of frames) {
      exerciseWithTransformedPoints(ck, frame, lattice1);
    }

    for (let i = 0; i + 1 < frames.length; i++) {
      const rangeAB = Range3d.createNull();
      const lattice2 = frames[i + 1].multiplyPoint3dArray(lattice1);
      for (const xyz of lattice1) {
        rangeAB.extendTransformTransformedXYZ(frames[i], frames[i + 1], xyz.x, xyz.y, xyz.z);
      }
      const rangeA = Range3d.createTransformedArray(frames[i], lattice2);
      ck.testRange3d(rangeA, rangeAB, "multistage transform");

    }

    const rangeQ = Range3d.createNull();
    const pointQ = Point3d.create(2, 3, 1);
    rangeQ.setXYZ(pointQ.x, pointQ.y, pointQ.z);
    ck.testTrue(rangeQ.containsPoint(pointQ));
    ck.testCoordinate(0, rangeQ.diagonal().magnitude(), "single point diagonal is 000");

    ck.checkpoint("Range3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
    rangeQ.extend(new Point3d(20, 22, 54));
    const expected = new Float64Array(6);
    expected[0] = rangeQ.low.x;
    expected[1] = rangeQ.low.y;
    expected[2] = rangeQ.low.z;
    expected[3] = rangeQ.high.x;
    expected[4] = rangeQ.high.y;
    expected[5] = rangeQ.high.z;
    const floatArray = Range3d.toFloat64Array(rangeQ);
    const floatArrayB = rangeQ.toFloat64Array();
    assert.deepEqual(floatArray, expected);
    assert.deepEqual(floatArrayB, expected);
    assert.instanceOf(floatArray, Float64Array);
    const roundtrip = new Range3d(...floatArray);
    assert.deepEqual(rangeQ, roundtrip);
  });

  it("With2d", () => {
    const ck = new Checker();
    const lattice1 = Sample.createPoint2dLattice(-1, 1.3, 4);
    const rangeA2d = Range2d.createArray(lattice1);
    const rangeA3d = Range3d.createRange2d(rangeA2d);
    ck.testFalse(RangeBase.isExtremePoint2d(rangeA2d.low), "null range low is extreme");
    ck.testFalse(RangeBase.isExtremePoint2d(rangeA2d.high), "null range low is extreme");
    ck.testTrue(rangeA2d.low.isAlmostEqual(rangeA3d.low), "2d 3d range");
    ck.testTrue(rangeA2d.high.isAlmostEqual(rangeA3d.high), "2d 3d range");

    const f64A = Range2d.toFloat64Array(rangeA2d);
    const f64B = rangeA2d.toFloat64Array();

    ck.testExactNumber(f64A[0], rangeA2d.low.x);
    ck.testExactNumber(f64A[1], rangeA2d.low.y);
    ck.testExactNumber(f64A[2], rangeA2d.high.x);
    ck.testExactNumber(f64A[3], rangeA2d.high.y);

    ck.testExactNumber(f64B[0], rangeA2d.low.x);
    ck.testExactNumber(f64B[1], rangeA2d.low.y);
    ck.testExactNumber(f64B[2], rangeA2d.high.x);
    ck.testExactNumber(f64B[3], rangeA2d.high.y);

    ck.checkpoint("Range3d.With2d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("VariableArgs", () => {
    const ck = new Checker();
    const frames = Sample.createRigidTransforms();
    // number of points here is limited -- need to enumerate them in VariableArgs tests.
    const points = [
      Point3d.create(1, 2, 3),
      Point3d.create(4, 2, 9),
      Point3d.create(2, 8, 3),
      Point3d.create(-1, 4, -2)];
    for (const frame of frames) {
      const rangeA = Range3d.createTransformedArray(frame, points);
      const rangeB = Range3d.createTransformed(frame,
        points[0], points[1], points[2], points[3]);
      ck.testRange3d(rangeA, rangeB);
    }

    ck.checkpoint("Range3d.VariableArgs");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Distance", () => {
    const ck = new Checker();
    const lattice1 = Sample.createPoint3dLattice(-1, 1.3, 4);
    const range = Range3d.createArray(lattice1)!;
    range.scaleAboutCenterInPlace(0.45);
    const rangeX = Range1d.createXX(range.low.x, range.high.x);
    const rangeY = Range1d.createXX(range.low.y, range.high.y);
    const rangeZ = Range1d.createXX(range.low.z, range.high.z);
    for (const xyz of lattice1) {
      const d = range.distanceToPoint(xyz);
      ck.testBoolean(range.containsPoint(xyz), d === 0.0, "distanceToRange agrees with containment");
      ck.testCoordinate(d,
        Geometry.hypotenuseXYZ(rangeX.distanceToX(xyz.x),
          rangeY.distanceToX(xyz.y),
          rangeZ.distanceToX(xyz.z)), "distance to range 3d, 1d");
    }

    ck.checkpoint("Range3d.Distance");
    expect(ck.getNumErrors()).equals(0);
  });
  // overlapping interval combinations
  //  ---------------------10-----------------20-----------------
  //         0======5      10======15
  //                          11===15         20=======30
  //         0=============10        15=======20       30=====40
  //         0================================20
  //         0=========================================30
  //
  const intervalA = Range1d.createXX(10, 20);
  const intervalBArray = [
    Range1d.createNull(),
    Range1d.createXX(-3, 5),
    Range1d.createXX(-3, 10),
    Range1d.createXX(-3, 15),
    Range1d.createXX(-3, 20),
    Range1d.createXX(10, 15),
    Range1d.createXX(11, 15),
    Range1d.createXX(15, 20),
    Range1d.createXX(20, 30),
    Range1d.createXX(30, 40),
    Range1d.createX(0),
    Range1d.createX(10),
    Range1d.createX(15),
    Range1d.createX(20),
    Range1d.createX(30)];

  it("ScalarQueries", () => {
    const ck = new Checker();
    for (const rangeB of intervalBArray) {
      const rangeX = rangeB.clone();
      const rangeY = rangeB.clone();
      const rangeZ = rangeB.clone();
      rangeX.scaleAboutCenterInPlace(1.2);
      rangeY.scaleAboutCenterInPlace(0.4);
      rangeZ.scaleAboutCenterInPlace(0.9);
      const r1 = rangeX.clone();
      const r2 = Range2d.createXYXY(rangeX.low, rangeY.low, rangeX.high, rangeY.high);
      const r3 = Range3d.createXYZXYZ(rangeX.low, rangeY.low, rangeZ.low, rangeX.high, rangeY.high, rangeZ.high);
      if (!rangeB.isNull) {
        ck.testTrue(r1.containsX(rangeX.fractionToPoint(0.5)));
        ck.testTrue(r2.containsXY(rangeX.fractionToPoint(0.5), rangeY.fractionToPoint(0.5)));
        ck.testTrue(r3.containsXYZ(rangeX.fractionToPoint(0.5), rangeY.fractionToPoint(0.5), rangeZ.fractionToPoint(0.5)));

        ck.testTrue(r2.containsPoint(r2.diagonalFractionToPoint(0.2)), "diagonal point in");
        ck.testTrue(r3.containsPoint(r3.diagonalFractionToPoint(0.2)), "diagonal point in");
        const a = 3.2;      // greater than 1 expands in all directions
        const r1A = r1.clone(); r1A.scaleAboutCenterInPlace(a);
        const r2A = r2.clone(); r2A.scaleAboutCenterInPlace(a);
        const r3A = r3.clone(); r3A.scaleAboutCenterInPlace(a);
        const bx = 0.99;
        const by = 0.95;
        const bz = 0.92;
        const p1 = r1A.fractionToPoint(bx);
        const p2 = r2A.fractionToPoint(bx, by);
        const p3 = r3A.fractionToPoint(bx, by, bz);
        ck.testTrue(r1A.containsX(p1));
        ck.testTrue(r2A.containsXY(p2.x, p2.y));
        ck.testTrue(r3A.containsXYZ(p3.x, p3.y, p3.z));

        ck.testTrue(r2A.containsPoint(p2));
        ck.testTrue(r3A.containsPoint(p3));

        const isSingle = rangeB.isSinglePoint;
        ck.testBoolean(isSingle, r1.containsX(p1));
        ck.testBoolean(isSingle, r2.containsXY(p2.x, p2.y));
        ck.testBoolean(isSingle, r3.containsXYZ(p3.x, p3.y, p3.z));

        ck.testCoordinate(0, r2A.distanceToPoint(p2), "0 distance to contained point 2d");
        ck.testCoordinate(0, r3A.distanceToPoint(p3), "0 distance to contained point 2d");

        if (!isSingle) {
          ck.testLT(0, r2.distanceToPoint(p2), "nonzero distance to contained point 2d");
          ck.testLT(0, r3.distanceToPoint(p3), "nonzero distance to contained point 2d");
        }

        const diagonal2 = r2.diagonal();
        const diagonal3 = r3.diagonal();
        ck.testBoolean(diagonal2.isAlmostZero, r2.isAlmostZeroX && r2.isAlmostZeroY, "2d almostZero");
        ck.testBoolean(diagonal3.isAlmostZero, r3.isAlmostZeroX && r3.isAlmostZeroY && r3.isAlmostZeroZ, "2d almostZero");
      }
    }
    ck.checkpoint("Range3d.Containment1d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Containment1d", () => {
    const ck = new Checker();
    for (const rangeB of intervalBArray) {
      const rangeAB = intervalA.intersect(rangeB);
      const d1 = intervalA.distanceToRange(rangeB);
      const d2 = rangeB.distanceToRange(intervalA);

      const rangeQ = rangeAB.clone();
      rangeQ.extendRange(rangeB);
      ck.testTrue(rangeQ.containsRange(rangeB), "extend acts as union");

      ck.testBoolean(
        intervalA.containsRange(rangeB), rangeAB.isAlmostEqual(rangeB), "contained range matches operand");
      ck.testCoordinate(d1, d2, "distance between ranges is symmetric");
      if (rangeAB.isNull)
        ck.testLT(0, d1, "Empty intersection must have nonzero distance");
      else
        ck.testCoordinate(0, d1, "nonempty intersection must have zero distance");
      const rangeC = intervalA.union(rangeB);
      ck.testTrue(rangeC.containsRange(intervalA), "Union contains operand");
      ck.testTrue(rangeC.containsRange(rangeB), "Union contains operand");
      ck.testExactNumber(rangeC.maxAbs(), Math.max(intervalA.maxAbs(), rangeB.maxAbs()), "maxAbs of union");

      const rangeM = Range1d.createNull();
      rangeM.setFrom(rangeB);
      const rangeN = Range1d.createFrom(rangeB);
      ck.testTrue(rangeM.isAlmostEqual(rangeB), "setFrom");
      ck.testTrue(rangeN.isAlmostEqual(rangeB), "createFrom");

    }
    ck.checkpoint("Range3d.Containment1d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DiagonalContainment3d", () => {
    const ck = new Checker();
    const rangeA = Range3d.createXYZXYZ(
      intervalA.low, intervalA.low, intervalA.low,
      intervalA.high, intervalA.high, intervalA.high);
    // console.log("rangeA:", JSON.stringify(rangeA));
    for (const intervalB of intervalBArray) {
      const rangeB = Range3d.createXYZXYZOrCorrectToNull(
        intervalB.low, intervalB.low, intervalB.low,
        intervalB.high, intervalB.high, intervalB.high);
      const rangeAB = rangeA.intersect(rangeB);

      const rangeQ = rangeAB.clone();
      rangeQ.extendRange(rangeB);
      ck.testTrue(rangeQ.containsRange(rangeB), "extend acts as union");

      const d1 = rangeA.distanceToRange(rangeB);
      const d2 = rangeB.distanceToRange(rangeA);
      ck.testCoordinate(d1, d2, "distance between ranges is symmetric");
      ck.testBoolean(
        rangeA.containsRange(rangeB), rangeAB.isAlmostEqual(rangeB), "contained range matches operand");
      if (rangeAB.isNull)
        ck.testLT(0, d1, "Empty intersection must have nonzero distance");
      else
        ck.testCoordinate(0, d1, "nonempty intersection must have zero distance");

      const rangeC = rangeA.union(rangeB);
      ck.testTrue(rangeC.containsRange(rangeA), "Union contains operand");
      ck.testTrue(rangeC.containsRange(rangeB), "Union contains operand");
      ck.testExactNumber(rangeC.maxAbs(), Math.max(rangeA.maxAbs(), rangeB.maxAbs()), "maxAbs of union");

      const rangeM = Range3d.createNull();
      rangeM.setFrom(rangeB);
      const rangeN = Range3d.createFrom(rangeB);
      ck.testTrue(rangeM.isAlmostEqual(rangeB), "setFrom");
      ck.testTrue(rangeN.isAlmostEqual(rangeB), "createFrom");
    }
    ck.checkpoint("Range3d.DiagonalContainment3d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DiagonalContainment2d", () => {
    const ck = new Checker();
    const rangeA = Range2d.createXYXY(
      intervalA.low, intervalA.low,
      intervalA.high, intervalA.high);
    // console.log("rangeA:", JSON.stringify(rangeA));
    for (const intervalB of intervalBArray) {
      const rangeB = Range2d.createXYXYOrCorrectToNull(
        intervalB.low, intervalB.low,
        intervalB.high, intervalB.high);
      const rangeAB = rangeA.intersect(rangeB);
      const rangeQ = rangeAB.clone();
      rangeQ.extendRange(rangeB);
      ck.testTrue(rangeQ.containsRange(rangeB), "extend acts as union");

      let d1 = rangeA.distanceToRange(rangeB);
      let d2 = rangeB.distanceToRange(rangeA);
      ck.testCoordinate(d1, d2, "distance between ranges is symmetric");
      d1 = rangeA.distanceToRange(rangeB);
      d2 = rangeB.distanceToRange(rangeA);
      ck.testBoolean(
        rangeA.containsRange(rangeB), rangeAB.isAlmostEqual(rangeB), "contained range matches operand");

      if (rangeAB.isNull)
        ck.testLT(0, d1, "Empty intersection must have nonzero distance");
      else
        ck.testCoordinate(0, d1, "nonempty intersection must have zero distance");

      const rangeC = rangeA.union(rangeB);
      ck.testTrue(rangeC.containsRange(rangeA), "Union contains operand");
      ck.testTrue(rangeC.containsRange(rangeB), "Union contains operand");
      ck.testExactNumber(rangeC.maxAbs(), Math.max(rangeA.maxAbs(), rangeB.maxAbs()), "maxAbs of union");

      const rangeM = Range2d.createNull();
      rangeM.setFrom(rangeB);
      const rangeN = Range2d.createFrom(rangeB);
      ck.testTrue(rangeM.isAlmostEqual(rangeB), "setFrom");
      ck.testTrue(rangeN.isAlmostEqual(rangeB), "createFrom");
    }
    ck.checkpoint("Range3d.DiagonalContainment2d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("MiscRange1d", () => {
    const ck = new Checker();
    const dataA = [4, 5, -1];
    const dataB = [-10, 20, 30];  // ALL are outside range of A
    const rangeA = Range1d.createArray(dataA);
    const rangeAB = rangeA.clone();
    ck.testFalse(rangeA.isSinglePoint, "A not single point");
    rangeAB.extendArray(dataB);
    for (const d of dataA) {
      ck.testTrue(rangeA.containsX(d), "A data in A");
    }

    for (const d of dataB) {
      ck.testTrue(rangeAB.containsX(d), "extended range contains B data");
      ck.testFalse(rangeA.containsX(d), "B data not in A");
    }
    ck.testTrue(rangeA.containsX(rangeA.fractionToPoint(0.4)), "fractionToPoint, interior case");
    ck.testFalse(rangeA.containsX(rangeA.fractionToPoint(-0.4)), "fractionToPoint, exterior case");
    ck.testFalse(rangeA.containsX(rangeA.fractionToPoint(10.4)), "fractionToPoint, exterior case");

    ck.checkpoint("Range3d.MiscRange1d");

    expect(ck.getNumErrors()).equals(0);
  });

  it("SinglePointRanges", () => {
    const ck = new Checker();
    const delta = 0.1;
    const twoDelta = 2.0 * delta;
    const r1 = Range1d.createX(1);
    ck.testTrue(r1.isSinglePoint, "1d single point");
    ck.testTrue(r1.isAlmostZeroLength, "1d isAlmostZeroLength");
    const r1A = Range1d.createNull();
    r1A.setX(4);
    ck.testTrue(r1A.isSinglePoint, "single point set");
    r1.expandInPlace(delta);
    ck.testCoordinate(twoDelta, r1.length(), "expand");

    const r2 = Range2d.createXY(1, 2);
    ck.testTrue(r2.isSinglePoint, "2d single point");
    const r2A = Range2d.createNull();
    r2A.setXY(4, 3);
    ck.testTrue(r2A.isSinglePoint, "single point set");
    r2.expandInPlace(delta);
    ck.testCoordinate(twoDelta, r2.xLength(), "expand");
    ck.testCoordinate(twoDelta, r2.yLength(), "expand");

    const r3 = Range3d.createXYZ(1, 2, 3);
    ck.testTrue(r3.isSinglePoint, "3d single point");
    ck.checkpoint("Range3d.SinglePointRanges");
    r3.expandInPlace(delta);
    ck.testCoordinate(twoDelta, r3.xLength(), "expand");
    ck.testCoordinate(twoDelta, r3.yLength(), "expand");
    ck.testCoordinate(twoDelta, r3.zLength(), "expand");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Misc3d", () => {
    const ck = new Checker();
    const range0 = Range3d.createXYZXYZ(1, 2, 3, 6, 3, 2);
    const nullRange = Range3d.createNull();
    const unionA = range0.union(nullRange);
    const unionB = nullRange.union(range0);
    ck.testRange3d(range0, unionA);
    ck.testRange3d(range0, unionB);

    const range1 = Range3d.fromJSON([Point3d.create(1, 2, 3), Point3d.create(6, 3, 2)]);
    ck.testRange3d(range0, range1);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Misc2d", () => {
    const ck = new Checker();
    const range0 = Range2d.createXYXY(1, 2, 3, 6);
    const nullRange = Range2d.createNull();
    const unionA = range0.union(nullRange);
    const unionB = nullRange.union(range0);
    ck.testRange2d(range0, unionA);
    ck.testRange2d(range0, unionB);

    const range1 = Range2d.fromJSON({ low: [1, 2], high: [3, 6] });
    ck.testRange2d(range0, range1);
    expect(ck.getNumErrors()).equals(0);
  });

  it("Misc1d", () => {
    const ck = new Checker();
    const range0 = Range1d.createXX(1, 2);
    const nullRange = Range1d.createNull();
    const unionA = range0.union(nullRange);
    const unionB = nullRange.union(range0);
    ck.testRange1d(range0, unionA);
    ck.testRange1d(range0, unionB);

    const range1 = Range1d.fromJSON({ low: 1, high: 2 });
    ck.testRange1d(range0, range1);
    expect(ck.getNumErrors()).equals(0);
  });
  it("WorldToLocal3d", () => {
    const ck = new Checker();

    const a = 10000.0;
    const b = 1313131;
    const rangeA = Range3d.createXYZXYZ(1, 2, 4, 10, 21, 31);
    const worldPoints = Sample.createPoint3dLattice(-3, 15, 60);
    const localPoints: Point3d[] = [];
    const localPointsB: Point3d[] = [];
    for (const worldPoint of worldPoints) {
      const xyzA = worldPoint.clone();
      const xyzB = Point3d.create(a, a, a);
      const xyzC = Point3d.create(b, b, b);
      rangeA.worldToLocal(xyzA, xyzB);
      rangeA.localToWorld(xyzB, xyzC);
      localPoints.push(xyzB.clone());
      localPointsB.push(worldPoint.clone());  // to be transformed as full array
    }

    rangeA.worldToLocalArrayInPlace(localPointsB);
    ck.testPoint3dArray(localPoints, localPointsB);
    rangeA.localToWorldArrayInPlace(localPointsB);
    ck.testPoint3dArray(worldPoints, localPointsB);
    ck.checkpoint("Range3d.WorldToLocal3d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ScalarQueries3d", () => {
    const ck = new Checker();
    const rangeA = Range3d.createXYZXYZ(1, 2, 4, 10, 21, 31);
    const rangeB = Range3d.createXYZXYZ(rangeA.xLow, rangeA.yLow, rangeA.zLow, rangeA.xHigh, rangeA.yHigh, rangeA.zHigh);
    ck.testRange3d(rangeA, rangeB, "Range scalar queries");
    ck.testTrue(rangeA.containsPoint(rangeB.center));

    const npcToWorld = rangeA.getNpcToWorldRangeTransform();
    const centerA = npcToWorld.multiplyXYZ(0.5, 0.5, 0.5);
    ck.testPoint3d(centerA, rangeA.center);
    // For single point range, transform (of degenerate range images) is identity . .
    const singlePointRange = Range3d.createXYZ(1, 2, 3);
    const singlePointNpcToWorld = singlePointRange.getNpcToWorldRangeTransform();
    ck.testTrue(singlePointNpcToWorld.matrix.isIdentity, "npcToWorld for single point has identity scales");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ScalarQueries2d", () => {
    const ck = new Checker();
    const rangeA = Range2d.createXYXY(1, 2, 10, 21);
    const rangeB = Range2d.createXYXY(rangeA.xLow, rangeA.yLow, rangeA.xHigh, rangeA.yHigh);
    ck.testRange2d(rangeA, rangeB, "Range scalar queries");
    ck.testTrue(rangeA.containsPoint(rangeB.center));
    expect(ck.getNumErrors()).equals(0);
  });

  it("EnsureMinLengths", () => {
    const ck = new Checker();
    /** This has lengths of 1 in each direction . . . */
    const rangeA = Range3d.createXYZXYZ(1, 2, 3, 2, 3, 4);
    ck.testFalse(rangeA.xLength() >= 2.0);
    ck.testFalse(rangeA.yLength() >= 2.0);
    ck.testFalse(rangeA.zLength() >= 2.0);
    rangeA.ensureMinLengths(2.000000001);
    ck.testTrue(rangeA.xLength() >= 2.0);
    ck.testTrue(rangeA.yLength() >= 2.0);
    ck.testTrue(rangeA.zLength() >= 2.0);

    expect(ck.getNumErrors()).equals(0);
  });
  it("ZeroCases", () => {
    const ck = new Checker();
    ck.testTrue(RangeBase.isExtremeValue(RangeBase.coordinateToRangeAbsoluteDistance(0, 10, 1)));
    expect(ck.getNumErrors()).equals(0);
  });
  it("DistanceToNullRange", () => {
    const ck = new Checker();
    const null1 = Range1d.createNull();
    const null2 = Range2d.createNull();
    const null3 = Range3d.createNull();
    const q = Math.abs(null1.high); // All dimensions should use the same extreme positive
    ck.testExactNumber(q, null1.distanceToX(100), "null Range1d distance to X");
    ck.testExactNumber(q, null2.distanceToPoint(Point2d.create(1, 2)), "null Range1d distance to X");
    ck.testExactNumber(q, null3.distanceToPoint(Point3d.create(1, 2, 3)), "null Range1d distance to X");

    ck.testExactNumber(0, null3.maxAbs(), "Range3d.null maxAbs is 0");
    ck.testTrue(RangeBase.isExtremeValue(RangeBase.coordinateToRangeAbsoluteDistance(0, 10, 1)));
    expect(ck.getNumErrors()).equals(0);
  });
  it("Float64ArrayConstructors", () => {
    const ck = new Checker();
    const r2 = Range2d.createXYXY(5, 2, 4, 7);
    const f2 = r2.toFloat64Array();
    const r2A = Range2d.fromFloat64Array(f2);
    const r2B = Range2d.fromArrayBuffer(f2);
    ck.testRange2d(r2, r2A);
    ck.testRange2d(r2, r2B);

    const r3 = Range3d.createXYZXYZ(5, 3, 4, 7, 3, 1);
    const f3 = r3.toFloat64Array();
    const r3A = Range3d.fromFloat64Array(f3);
    const r3B = Range3d.fromArrayBuffer(f3);
    ck.testRange3d(r3, r3A);
    ck.testRange3d(r3, r3B);

    r2.freeze();
    r3.freeze();
    expect(ck.getNumErrors()).equals(0);
  });
  it("Reuse corners", () => {
    const ck = new Checker();
    const range = Range3d.createXYZXYZ(1, 2, 3, 7, 8, 9);
    const cornerA = range.corners();
    const cornerB: Point3d[] = [];
    const cornerB0 = range.corners(cornerB);
    ck.testTrue(cornerB !== cornerB0, "Range corners creates new array if result has wrong size");

    for (let i = 0; i < 8; i++)
      cornerB.push(Point3d.create(i, i, i));
    const cornerB1 = range.corners(cornerB);
    ck.testTrue(cornerB === cornerB1, "Range corners reuses result array");
    for (let i = 0; i < 8; i++) {
      ck.testPoint3d(cornerA[i], cornerB[i], "range.corners overwrites");
      ck.testTrue(range.containsPoint(cornerB[i]));
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("CreateFromNull", () => {
    const ck = new Checker();
    const r1 = Range1d.createFrom(Range1d.createNull());
    const r2 = Range2d.createFrom(Range2d.createNull());
    const r3 = Range3d.createFrom(Range3d.createNull());
    ck.testTrue(r1.isNull);
    ck.testTrue(r2.isNull);
    ck.testTrue(r3.isNull);
    expect(ck.getNumErrors()).equals(0);
  });

});

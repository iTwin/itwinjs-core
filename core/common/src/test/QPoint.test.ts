/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { QParams3d, QPoint3d } from "../QPoint";

function expectPointsEqual(lhs: Point3d, rhs: Point3d, tolerance: number) {
  expect(lhs.isAlmostEqual(rhs, tolerance)).to.equal(true);
}

function expectQPoint3d(pt: Point3d, params: QParams3d, exp: QPoint3d, tolerance: number) {
  const qpt = QPoint3d.create(pt, params);
  expect(qpt.x).to.equal(exp.x);
  expect(qpt.y).to.equal(exp.y);
  expect(qpt.z).to.equal(exp.z);

  expectPointsEqual(qpt.unquantize(params), pt, tolerance);
}

describe("QPoint", () => {
  it("quantizes to range", () => {
    const range = Range3d.createArray([new Point3d(0, -100, 200), new Point3d(50, 100, 10000)]);
    const qparams = QParams3d.fromRange(range);
    expectPointsEqual(qparams.origin, range.low, 0);

    expectQPoint3d(range.low, qparams, QPoint3d.fromScalars(0, 0, 0), 0);
    expectQPoint3d(range.high, qparams, QPoint3d.fromScalars(0xffff, 0xffff, 0xffff), 0);

    const center = range.low.interpolate(0.5, range.high);
    expectQPoint3d(center, qparams, QPoint3d.fromScalars(0x8000, 0x8000, 0x8000), 0.08);

    range.low.z = range.high.z = 500;
    qparams.setFromRange(range);

    expectQPoint3d(range.low, qparams, QPoint3d.fromScalars(0, 0, 0), 0);
    expectQPoint3d(range.high, qparams, QPoint3d.fromScalars(0xffff, 0xffff, 0), 0);

    center.z = 500.0;
    expectQPoint3d(center, qparams, QPoint3d.fromScalars(0x8000, 0x8000, 0), 0.002);
  });

  it("computes range", () => {
    function roundTrip(range: Range3d, tolerance = 0.01): void {
      const params = QParams3d.fromRange(range);
      expectPointsEqual(params.origin, range.low, 0);

      const result = params.computeRange();
      expectPointsEqual(result.low, range.low, 0);
      expectPointsEqual(result.high, range.high, tolerance);
    }

    roundTrip(Range3d.createXYZXYZ(0, 0, 0, 0xffff, 0xffff, 0xffff), 0);
    roundTrip(Range3d.createXYZXYZ(-100, 0, 100, 500, 10, 9999));
  });
});

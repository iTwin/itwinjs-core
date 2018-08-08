/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { QParams3d, QPoint3d } from "@bentley/imodeljs-common";
import { Point3d, Range3d } from "@bentley/geometry-core";

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
  it("QPoint tests from native source", () => {
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
});

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { QParams, QPoint3d } from "../../frontend/render/QPoint";
import { XYZ, Point3d} from "@bentley/geometry-core/lib/PointVector";
import { Range3d } from "@bentley/geometry-core/lib/Range";

function expectPointsEqual(lhs: XYZ, rhs: XYZ, tolerance: number) {
  assert.isTrue(lhs.isAlmostEqual(rhs, tolerance));
}
function expectQPoint3d(pt: XYZ, range: Range3d, exp: QPoint3d, tolerance: number) {
  const qpt = new QPoint3d(pt, range);
  expectPointsEqual(qpt.point, exp.point, tolerance);
  expectPointsEqual(qpt.unquantize(), pt, tolerance);
}
describe("QPoint", () => {
  it("QPoint tests from native source", () => {
    const range = Range3d.createArray([new Point3d(0, -100, 200), new Point3d(50, 100, 10000)]);
    const qparams = new QParams(range);
    expectPointsEqual(qparams.origin as XYZ, range.low, 0);

    expectQPoint3d(range.low, range, QPoint3d.fromScalars(0, 0, 0), 0);
    expectQPoint3d(range.high, range, QPoint3d.fromScalars(0xffff, 0xffff, 0xffff), 0);

    const center = range.low.interpolate(0.5, range.high);
    expectQPoint3d(center, range, QPoint3d.fromScalars(0x8000, 0x8000, 0x8000), 0.08);

    range.low.z = range.high.z = 500;
    qparams.init(range);

    expectQPoint3d(range.low, range, QPoint3d.fromScalars(0, 0, 0), 0);
    expectQPoint3d(range.high, range, QPoint3d.fromScalars(0xffff, 0xffff, 0), 0);

    center.z = 500.0;
    expectQPoint3d(center, range, QPoint3d.fromScalars(0x8000, 0x8000, 0), 0.002);
  });
});

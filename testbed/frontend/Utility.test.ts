/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { PointUtil, RangeUtil } from "@bentley/imodeljs-common";
import { Range1d, Range2d, Range3d } from "@bentley/geometry-core";
import { XY, XYZ, Vector2d, Vector3d, Point2d, Point3d } from "@bentley/geometry-core";

describe("PointUtil", () => {
  it("isNaN", () => {
    assert.isTrue(PointUtil.isNaN(NaN), "NaN");
    assert.isTrue(PointUtil.isNaN("a"), "characters");
    assert.isTrue(PointUtil.isNaN("!"), "symbols");
    assert.isTrue(PointUtil.isNaN({}), "object");
    assert.isTrue(PointUtil.isNaN([]), "array");
    assert.isFalse(PointUtil.isNaN(1), "number");
    assert.isFalse(PointUtil.isNaN(0xffff), "hex");
    assert.isFalse(PointUtil.isNaN(0.01), "decimal");
    assert.isFalse(PointUtil.isNaN("1"), "string number");
  });
  it("isNumber", () => {
    assert.isFalse(PointUtil.isNumber(NaN), "NaN");
    assert.isFalse(PointUtil.isNumber("a"), "characters");
    assert.isFalse(PointUtil.isNumber("!"), "symbols");
    assert.isFalse(PointUtil.isNumber({}), "object");
    assert.isFalse(PointUtil.isNumber([]), "array");
    assert.isTrue(PointUtil.isNumber(1), "number");
    assert.isTrue(PointUtil.isNumber(0xffff), "hex");
    assert.isTrue(PointUtil.isNumber(0.01), "decimal");
    assert.isTrue(PointUtil.isNumber("1"), "string number");
  });
  it("isVector", () => {
    function testIsVector(v: number | XY | XYZ) {
      if (PointUtil.isVector(v)) {
        assert.isTrue(typeof v.x !== "undefined", "Vector");
      } else {
        assert.isTrue(v * 0 === 0, "Number");
      }
    }
    testIsVector(new Vector2d(0, 0));
    testIsVector(new Vector3d(0, 0, 0));
    testIsVector(0);
  });
  it("isPointArray", () => {
    function testIsPointArray(v: Array<number | XY | XYZ>) {
      if (PointUtil.isPoint2dArray(v)) {
        assert.isTrue(typeof v[0].x !== "undefined", "isPoint2dArray");
      } else if (PointUtil.isPoint3dArray(v)) {
        assert.isTrue(typeof v[0].z !== "undefined", "isPoint3dArray");
      } else if (PointUtil.isNumberArray(v)) {
        assert.isFalse(isNaN(v[0]), "isNumberArray");
      }
    }
    testIsPointArray([new Vector2d(0, 0), new Vector2d(0, 0)]);
    testIsPointArray([new Vector3d(0, 0, 0), new Vector3d(0, 0, 0)]);
    testIsPointArray([0, 0]);
  });
  it("toNumberArray", () => {
    expect(PointUtil.toNumberArray(new Vector3d(0, 0, 0))).to.deep.equal([0, 0, 0]);
    assert.isTrue(PointUtil.toNumberArray(new Vector3d(0, 0, 0)).length === 3);
    expect(PointUtil.toNumberArray(new Vector2d(0, 0))).to.deep.equal([0, 0]);
    assert.isTrue(PointUtil.toNumberArray(new Vector2d(0, 0)).length === 2);
    expect(PointUtil.toNumberArray(0)).to.deep.equal([0]);
    assert.isTrue(PointUtil.toNumberArray(0).length === 1);
  });
  it("fromNumberArray", () => {
    assert.isTrue(PointUtil.fromNumberArray([0, 0, 0]) instanceof XYZ);
    assert.isTrue(PointUtil.fromNumberArray([0, 0]) instanceof XY);
    assert.isTrue(PointUtil.fromNumberArray([0]) === 0);
  });
  it("to2dNumberArray", () => {
    expect(PointUtil.to2dNumberArray(new Vector3d(0, 0, 0), new Vector3d(0, 0, 0))).to.deep.equal([[0, 0, 0], [0, 0, 0]]);
    expect(PointUtil.to2dNumberArray(new Vector2d(0, 0), new Vector2d(0, 0))).to.deep.equal([[0, 0], [0, 0]]);
    expect(PointUtil.to2dNumberArray(0, 0)).to.deep.equal([[0], [0]]);
  });
  it("asNumberArray", () => {
    function runAgainstNumberArray(arr: number[]) { return arr.map((v) => v * 0); }
    assert.isTrue(PointUtil.asNumberArray(new Vector3d(8, 7, 6), runAgainstNumberArray) instanceof XYZ, "1) works for XYZ");
    assert.isTrue((PointUtil.asNumberArray(new Vector3d(8, 7, 6), runAgainstNumberArray) as XYZ).isAlmostZero(), "2) works for XYZ");
    assert.isTrue(PointUtil.asNumberArray(new Vector2d(8, 7), runAgainstNumberArray) instanceof XY, "1) works for XY");
    assert.isTrue((PointUtil.asNumberArray(new Vector2d(8, 7), runAgainstNumberArray) as XY).isAlmostZero(), "2) works for XY");
    assert.isTrue(PointUtil.isNumber(PointUtil.asNumberArray(9, runAgainstNumberArray)), "1) works for number");
    assert.isTrue(PointUtil.asNumberArray(9, runAgainstNumberArray) === 0, "2) works for number");
  });
  it("eachScalar", () => {
    function runAgainstScalar(v: number) { return v * 0; }
    assert.isTrue(PointUtil.eachScalar(new Vector3d(8, 7, 6), runAgainstScalar) instanceof XYZ, "1) works for XYZ");
    assert.isTrue((PointUtil.eachScalar(new Vector3d(8, 7, 6), runAgainstScalar) as XYZ).isAlmostZero(), "2) works for XYZ");
    assert.isTrue(PointUtil.eachScalar(new Vector2d(8, 7), runAgainstScalar) instanceof XY, "1) works for XY");
    assert.isTrue((PointUtil.eachScalar(new Vector2d(8, 7), runAgainstScalar) as XY).isAlmostZero(), "2) works for XY");
    assert.isTrue(PointUtil.isNumber(PointUtil.eachScalar(9, runAgainstScalar)), "1) works for number");
    assert.isTrue(PointUtil.eachScalar(9, runAgainstScalar) === 0, "2) works for number");
  });
});
describe("RangeUtil", () => {
  it("isVector", () => {
    function testIsRange(v: Range1d | Range2d | Range3d) {
      if (RangeUtil.isRange1d(v)) {
        assert.isTrue(typeof v.low === "number", "Range1d");
      } else if (RangeUtil.isRange2d(v)) {
        assert.isTrue(v.low instanceof XY, "Range2d");
      } else if (RangeUtil.isRange3d(v)) {
        assert.isTrue(v.low instanceof XYZ, "Range3d");
      }
    }
    testIsRange(Range1d.createArray([0, 0]));
    testIsRange(Range2d.createArray([new Point2d(0, 0), new Point2d(0, 0)]));
    testIsRange(Range3d.createArray([new Point3d(0, 0, 0), new Point3d(0, 0, 0)]));
  });
});

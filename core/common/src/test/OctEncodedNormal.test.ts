/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import type { XYZ } from "@itwin/core-geometry";
import { Vector3d } from "@itwin/core-geometry";
import { OctEncodedNormal } from "../OctEncodedNormal";

function _expectSignsEqual(a: number, b: number) {
  if (a !== 0) {
    assert.isTrue(a < 0 === b < 0, `expectSignsEqual ${a} ${b}`);
  }
}

function expectSignsEqual(a: XYZ, b: XYZ) {
  _expectSignsEqual(a.x, b.x);
  _expectSignsEqual(a.y, b.y);
  _expectSignsEqual(a.z, b.z);
}

function expectPointsEqual(lhs: XYZ, rhs: XYZ, tolerance: number) {
  assert.isTrue(lhs.isAlmostEqual(rhs, tolerance), `expectPointsEqual ${lhs.toJSON()} ${rhs.toJSON()}`);
}

function _roundTrip(vec: Vector3d, normalized: boolean = true, tolerance: number = 0.005) {
  if (!normalized) {
    vec.normalize(vec);
  }

  const oen = OctEncodedNormal.fromVector(vec);
  const out = oen.decode();
  expectPointsEqual(vec, out, tolerance);
  expectSignsEqual(vec, out);

  const rep = OctEncodedNormal.fromVector(out);
  assert.isTrue(rep.value === oen.value);
}

function roundTrip(x: number, y: number, z: number, normalized: boolean = true, tolerance: number = 0.005) {
  _roundTrip(new Vector3d(x, y, z), normalized, tolerance);
}

describe("OctEncodedNormal", () => {
  it("OctEncodedNormal tests from native source", () => {
    roundTrip(1.0, 0.0, 0.0);
    roundTrip(0.0, 1.0, 0.0);
    roundTrip(0.0, 0.0, 1.0);

    roundTrip(-1.0, 0.0, 0.0);
    roundTrip(0.0, -1.0, 0.0);
    roundTrip(0.0, 0.0, -1.0);

    roundTrip(0.5, 2.5, 0.0, false);
    roundTrip(-25.0, 25.0, 5.0, false, 0.012);
    roundTrip(0.0001, -1900.0, 22.5, false, 0.01);
    roundTrip(-1.0, -1.0, -1.0, false, 0.03);
  });
});

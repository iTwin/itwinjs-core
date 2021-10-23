/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Geometry } from "../../Geometry";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Checker } from "../Checker";

function verifySegment(ck: Checker, a: number, b: number) {
  const s0 = Segment1d.create(a, b);
  const s1 = s0.clone();
  const s2 = Segment1d.create();
  const s3 = Segment1d.create();
  const s4 = Segment1d.create(a, b, Segment1d.create());
  s3.setFrom(s0);
  s2.set(a, b);

  ck.testSegment1d(s0, s1);
  ck.testSegment1d(s0, s2);
  ck.testSegment1d(s0, s3);
  ck.testSegment1d(s0, s4);
  s3.reverseInPlace();
  for (const f of [-1, 0.2, 0.5, 0.9, 2]) {
    ck.testCoordinate(s0.fractionToPoint(f), Geometry.interpolate(a, f, b));
    ck.testCoordinate(s0.fractionToPoint(f), s3.fractionToPoint(1.0 - f));
  }
}
describe("Segment1d", () => {
  it("Create", () => {
    const ck = new Checker();
    verifySegment(ck, 1, 3);
    verifySegment(ck, 2, -5);
    const a = 0.1;
    const b = 1.4;
    const s01 = Segment1d.create(0, 1);
    const s10 = Segment1d.create(1, 0);
    const sab = Segment1d.create(a, b);

    ck.testTrue(s01.isExact01, "exact01");
    ck.testTrue(s10.isExact01Reversed, "exact01Reversed");
    ck.testFalse(s10.isExact01, "exact01");
    ck.testFalse(s01.isExact01Reversed, "exact01Reversed");
    ck.testFalse(sab.isExact01, "exact01 not");
    ck.testFalse(sab.isExact01Reversed, "exact01Reversed not");
    ck.checkpoint("Segment1d.Create");
    expect(ck.getNumErrors()).equals(0);
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Segment1d } from "../geometry3d/Segment1d";
import { Geometry } from "../Geometry";
import { Checker } from "./Checker";
import { expect } from "chai";

function verifySegment(ck: Checker, a: number, b: number) {
  const s0 = Segment1d.create(a, b);
  const s1 = s0.clone();
  const s2 = Segment1d.create();
  const s3 = Segment1d.create();
  const s4 = Segment1d.create (a, b, Segment1d.create());
  s3.setFrom(s0);
  s2.set(a, b);

  ck.testSegment1d(s0, s1);
  ck.testSegment1d(s0, s2);
  ck.testSegment1d(s0, s3);
  ck.testSegment1d(s0, s4);
  s3.reverseInPlace ();
  for (const f of [-1, 0.2, 0.5, 0.9, 2]) {
    ck.testCoordinate(s0.fractionToPoint(f), Geometry.interpolate (a, f, b));
    ck.testCoordinate(s0.fractionToPoint(f), s3.fractionToPoint (1.0 - f));
  }
}
describe("Segment1d", () => {
  it("Create", () => {
    const ck = new Checker();
    verifySegment(ck, 1, 3);
    verifySegment(ck, 2, -5);
    ck.checkpoint("Segment1d.Create");
    expect(ck.getNumErrors()).equals(0);
  });

});

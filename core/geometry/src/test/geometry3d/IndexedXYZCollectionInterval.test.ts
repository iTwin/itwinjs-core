/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { IndexedCollectionInterval, IndexedXYZCollectionInterval } from "../../geometry3d/IndexedCollectionInterval";
import * as bsiChecker from "../Checker";

/* eslint-disable no-console */

describe("IndexedXYZCollectionInterval", () => {
  it("hello", () => {
    const ck = new bsiChecker.Checker();
    const points = new GrowableXYZArray();
    for (let i = 0; i < 10; i++) {
      points.pushXYZ(i, 0, 0);
    }
    const fullInterval = IndexedCollectionInterval.createComplete(points);
    const smallInterval = IndexedXYZCollectionInterval.createBeginEnd(points, 3, 8);
    const length0 = smallInterval.length;
    ck.testExactNumber(fullInterval.length, points.length);
    smallInterval.advanceEnd();
    ck.testExactNumber(length0 + 1, smallInterval.length, "advanceEnd");
    smallInterval.advanceBegin();
    ck.testExactNumber(length0, smallInterval.length, "advanceBegin");

    ck.testUndefined(smallInterval.localIndexToParentIndex(-1));
    ck.testUndefined(smallInterval.localIndexToParentIndex(20));
    ck.testExactNumber(smallInterval.localIndexToParentIndex(0)!, smallInterval.begin);
    ck.testTrue(fullInterval.isNonEmpty, " verify invalid interval");
    ck.testTrue(fullInterval.isValidSubset, " subset valid before trim.");
    const intervalB = IndexedXYZCollectionInterval.createBeginLength(points, 3, 4);
    while (intervalB.length > 0) {
      ck.testTrue(intervalB.isValidSubset);
      intervalB.advanceBegin();
    }

    ck.testTrue(intervalB.isValidSubset);
    ck.testTrue(intervalB.length === 0);
    points.length = 5;    // oops !! intervals become invalid!!
    ck.testFalse(fullInterval.isValidSubset, " subset invalid after trim.");
    fullInterval.restrictEnd();
    fullInterval.advanceEnd();
    ck.testTrue(fullInterval.isNonEmpty, " verify restricted end");
    ck.testExactNumber(fullInterval.length, points.length, "advanceEnd capped");
    expect(ck.getNumErrors()).equals(0);
  });

});

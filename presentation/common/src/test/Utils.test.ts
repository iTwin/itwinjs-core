/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getInstancesCount, KeySet } from "../presentation-common";
import { createRandomBaseNodeKey, createRandomECInstanceKey, createRandomECInstancesNodeKey, createRandomGroupingNodeKey } from "./_helpers/random";

describe("getInstancesCount", () => {

  it("calculates correct count with instance keys, instance node keys and grouping node keys", () => {
    const keys = new KeySet([
      createRandomECInstanceKey(), // 1
      createRandomECInstancesNodeKey([createRandomECInstanceKey(), createRandomECInstanceKey()]), // 2
      createRandomGroupingNodeKey(5), // 5
      createRandomBaseNodeKey(),
    ]);
    expect(getInstancesCount(keys)).to.eq(8);
  });

});

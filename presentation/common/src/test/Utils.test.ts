/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getInstancesCount, KeySet } from "../presentation-common";
import { createTestECClassGroupingNodeKey, createTestECInstanceKey, createTestECInstancesNodeKey, createTestNodeKey } from "./_helpers";

describe("getInstancesCount", () => {
  it("calculates correct count with instance keys, instance node keys and grouping node keys", () => {
    const keys = new KeySet([
      createTestECInstanceKey(), // 1
      createTestECInstancesNodeKey({ instanceKeys: [createTestECInstanceKey(), createTestECInstanceKey()] }), // 2
      createTestECClassGroupingNodeKey({ groupedInstancesCount: 5 }), // 5
      createTestNodeKey(),
    ]);
    expect(getInstancesCount(keys)).to.eq(8);
  });
});

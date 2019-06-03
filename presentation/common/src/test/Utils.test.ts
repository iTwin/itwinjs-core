/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { KeySet } from "../KeySet";
import { getInstancesCount } from "../Utils";
import {
  createRandomECInstanceKey, createRandomECInstanceNodeKey,
  createRandomGroupingNodeKey, createRandomBaseNodeKey,
} from "./_helpers/random";

describe("getInstancesCount", () => {

  it("calculates correct count with instance keys, instance node keys and grouping node keys", () => {
    const keys = new KeySet([
      createRandomECInstanceKey(),
      createRandomECInstanceNodeKey(),
      createRandomGroupingNodeKey(5),
      createRandomBaseNodeKey(),
    ]);
    expect(getInstancesCount(keys)).to.eq(7);
  });

});

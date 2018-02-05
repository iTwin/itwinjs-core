/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestGateway, TestOp1Params } from "../common/TestGateway";
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

describe("Gateway", () => {
  it("should marshall types over the wire", async () => {
    const params = new TestOp1Params(1, 1);
    const remoteSum = await TestGateway.getProxy().op1(params);
    assert.strictEqual (remoteSum, params.sum());
  });

  it("should support toJSON/fromJSON", async () => {
    const id1 = new Id64();
    const id2 = await TestGateway.getProxy().op2(id1);
    assert.isTrue(id1.equals(id2));
  });

  it("should support toJSON and fall back to constructor when fromJSON does not exist", async () => {
    const date1 = new Date();
    const date2 = await TestGateway.getProxy().op3(date1);
    assert.strictEqual(date1.getTime(), date2.getTime());
  });

  it.skip("support Map", async () => {
    const map1 = new Map();
    const map2 = await TestGateway.getProxy().op4(map1);
    map2;
  });
});

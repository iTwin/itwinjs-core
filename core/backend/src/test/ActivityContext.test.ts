/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { IModelActivityContext, IModelHost } from "../IModelHost";

describe("ActivityContext", async () => {
  it("should track entry/exit", async () => {
    const log: string[] = [];
    function logId() {
      log.push(IModelHost.currentActivityContext!.activityId);
    }

    async function requestEntryPoint(activityId: string): Promise<number> {
      // An RPC impl function (the request entry point on the backend) will call IModelActivityContext.createForCurrentRpcRequest
      // instead of taking an activityId string and creating a new context.

      const activityContext = new IModelActivityContext(activityId).enter();

      const x = supplyX();
      activityContext.suspend();
      const y = await computeY(activityContext);
      activityContext.resume();

      const sum = x + y;
      activityContext.exit();
      return Promise.resolve(sum);
    }

    function supplyX(): number {
      const value = 1;
      logId();
      return value;
    }

    async function computeY(activityContext: IModelActivityContext): Promise<number> {
      activityContext.enter();
      const value = makeRandomY();
      activityContext.exit();
      return Promise.resolve(value);
    }

    function makeRandomY(): number {
      const value = Math.random();
      logId();
      return value;
    }

    try {
      await requestEntryPoint("abc");
      await requestEntryPoint("xyz");
      expect(log).to.eql(["abc", "abc", "xyz", "xyz"]);
    } catch (err) {
      assert(false);
    }
  });

  it("should report current context to IModelHost", async () => {
    const ctx = new IModelActivityContext("");
    ctx.enter();
    assert.strictEqual(IModelHost.currentActivityContext, ctx);
    ctx.suspend();
    assert.isUndefined(IModelHost.currentActivityContext);
    ctx.resume();
    assert.strictEqual(IModelHost.currentActivityContext, ctx);
    ctx.exit();
    assert.isUndefined(IModelHost.currentActivityContext);
  });

  it("should detect unbalanced usage", async () => {
    let ctx: IModelActivityContext;

    // ---------------------------------------
    ctx = new IModelActivityContext("");

    // missing ctx.enter();
    try { ctx.exit(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------

    // ---------------------------------------
    ctx = new IModelActivityContext("");

    ctx.enter();
    // missing ctx.suspend();
    try { ctx.resume(); assert(false); } catch (err) { assert(true); }
    // ctx.exit();
    // ---------------------------------------

    // ---------------------------------------
    ctx = new IModelActivityContext("");

    ctx.enter();
    ctx.suspend();
    // missing ctx.resume();
    try { ctx.exit(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------

    // ---------------------------------------
    ctx = new IModelActivityContext("");

    ctx.enter();
    ctx.suspend();
    ctx.resume();
    // missing ctx.exit();

    try { ctx.enter(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------
  });
});

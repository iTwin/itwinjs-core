/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/*
import { assert, expect } from "chai";
import { RpcInvocationContext, IModelHost } from "../IModelHost";

describe("ActivityContext", async () => {
  it("should track entry/exit", async () => {
    const log: string[] = [];
    function logId() {
      log.push(IModelHost.currentActivityContext!.activityId);
    }

    async function requestEntryPoint(activityId: string): Promise<number> {
      // An RPC impl function (the request entry point on the backend) will call RpcInvocationContext.createForCurrentRpcRequest
      // instead of taking an activityId string and creating a new context.

      const activityContext = new ActivityLoggingContext(activityId).assert();

      const x = supplyX();
      activityContext.suspend();
      const y = await computeY(activityContext);
      activityContext.enter();

      const sum = x + y;
      activityContext.exit();
      return Promise.resolve(sum);
    }

    function supplyX(): number {
      const value = 1;
      logId();
      return value;
    }

    async function computeY(activityContext: ActivityLoggingContext): Promise<number> {
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
    const ctx = new ActivityLoggingContext("");
    ctx.assert();
    assert.strictEqual(IModelHost.currentActivityContext, ctx);
    ctx.suspend();
    assert.isUndefined(IModelHost.currentActivityContext);
    ctx.assert();
    assert.strictEqual(IModelHost.currentActivityContext, ctx);
    ctx.exit();
    assert.isUndefined(IModelHost.currentActivityContext);
  });

  it("should detect unbalanced usage", async () => {
    let ctx: ActivityLoggingContext;

    // ---------------------------------------
    ctx = new ActivityLoggingContext("");

    // missing ctx.enter();
    try { ctx.exit(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------

    // ---------------------------------------
    ctx = new ActivityLoggingContext("");

    ctx.assert();
    // missing ctx.suspend();
    try { ctx.assert(); assert(false); } catch (err) { assert(true); }
    // ctx.exit();
    // ---------------------------------------

    // ---------------------------------------
    ctx = new ActivityLoggingContext("");

    ctx.assert();
    ctx.suspend();
    // missing ctx.resume();
    try { ctx.exit(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------

    // ---------------------------------------
    ctx = new ActivityLoggingContext("");

    ctx.assert();
    ctx.suspend();
    ctx.assert();
    // missing ctx.exit();

    try { ctx.assert(); assert(false); } catch (err) { assert(true); }
    // ---------------------------------------
  });
});
*/

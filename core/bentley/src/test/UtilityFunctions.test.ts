/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { wrapTimerCallback } from "../UtilityFunctions";

describe("wrapTimerCallback", () => {
  it("resolves and removes promise from set on successful callback", async () => {
    const promises = new Set<Promise<void>>();
    await wrapTimerCallback(promises, async () => {});
    expect(promises.size).to.equal(0);
  });

  it("rejects and keeps promise in set on failed callback", async () => {
    const promises = new Set<Promise<void>>();
    const error = new Error("test error");

    await wrapTimerCallback(promises, async () => { throw error; });

    expect(promises.size).to.equal(1);
    try {
      await Promise.all(promises);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).to.equal(error);
    }
  });

  it("adds promise to set before callback executes", async () => {
    const promises = new Set<Promise<void>>();
    let sizeInsideCallback = 0;

    await wrapTimerCallback(promises, async () => {
      sizeInsideCallback = promises.size;
    });

    expect(sizeInsideCallback).to.equal(1);
    expect(promises.size).to.equal(0);
  });

  it("handles multiple successful wrappers sequentially", async () => {
    const promises = new Set<Promise<void>>();

    await wrapTimerCallback(promises, async () => {});
    await wrapTimerCallback(promises, async () => {});

    expect(promises.size).to.equal(0);
  });

  it("handles mix of successful and failed callbacks", async () => {
    const promises = new Set<Promise<void>>();

    await wrapTimerCallback(promises, async () => {});
    await wrapTimerCallback(promises, async () => { throw new Error("fail"); });
    await wrapTimerCallback(promises, async () => {});

    expect(promises.size).to.equal(1);
  });
});
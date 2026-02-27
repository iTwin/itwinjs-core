/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, onTestFinished } from "vitest";
import { AbandonedError, OneAtATimeAction } from "../OneAtATimeAction";
import { BeDuration } from "../Time";

describe("OneAtATime test", () => {

  it("OneAtATime", async () => {
    const unhandledRejections: Error[] = [];
    const unhandledRejectionHandler = (reason: Error) => {
      unhandledRejections.push(reason);
    };

    process.on("unhandledRejection", unhandledRejectionHandler);
    onTestFinished(() => {
      process.removeListener("unhandledRejection", unhandledRejectionHandler);
    });

    let calls = 0;
    const operation = new OneAtATimeAction(async (a: number, b: string) => {
      if (a === 10)
        throw new Error("cancelled");

      expect(a).toBe(200);
      expect(b).toBe("hello");
      await BeDuration.wait(100);
      return ++calls;
    }, "testAbandon");

    // First batch of operations
    const promise1 = operation.request(200, "hello"); // is started immediately, and will complete
    const promise2 = operation.request(200, "hello"); // becomes pending, doesn't abort previous because its already started
    const promise3 = operation.request(200, "hello"); // aborts previous, becomes pending
    const promise4 = operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run

    // Wait for the first promise to resolve
    const count1 = await promise1;
    expect(count1).toBe(1);

    // The intermediate promises should be abandoned
    await expect(promise2).rejects.toBeInstanceOf(AbandonedError);
    await expect(promise3).rejects.toBeInstanceOf(AbandonedError);

    // The last promise should resolve
    const count2 = await promise4;
    expect(count2).toBe(2); // only the first and last complete

    // Second batch with error throwing
    const errorPromise1 = operation.request(10, "hello"); // try calling a function that throws
    const errorPromise2 = operation.request(10, "hello"); // try calling a function that throws
    const promise5 = operation.request(200, "hello"); // becomes pending, doesn't abort previous because its already started
    const promise6 = operation.request(200, "hello"); // aborts previous, becomes pending
    const promise7 = operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run

    // Wait for error promises to reject with AbandonedError containing "cancelled" message
    await expect(errorPromise1).rejects.toThrow("cancelled");
    await expect(errorPromise2).rejects.toBeInstanceOf(AbandonedError);

    // Wait for the intermediate promise to be abandoned
    await expect(promise5).rejects.toBeInstanceOf(AbandonedError);
    await expect(promise6).rejects.toBeInstanceOf(AbandonedError);

    // The last promise should resolve
    const count3 = await promise7;
    expect(count3).toBe(3);

    // Check that we had the expected unhandled rejections from the floating promises in start()
    await BeDuration.wait(10); // Give a moment for unhandled rejections to be captured
    expect(unhandledRejections.length).toBe(2);
    // The unhandled rejections are AbandonedError instances with the default message "testAbandon"
    for (const rejection of unhandledRejections) {
      expect(rejection.toString()).toContain("testAbandon");
    }
  });

  it("does not start pending request until active request completes", async () => {
    const releaseByArg = new Map<number, () => void>();
    const started: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const operation = new OneAtATimeAction(async (value: number) => {
      started.push(value);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);

      await new Promise<void>((resolve) => {
        releaseByArg.set(value, resolve);
      });

      inFlight--;
      return value;
    });

    const active = operation.request(1);
    const pending1 = operation.request(2);
    const pending2 = operation.request(3);

    await expect(pending1).rejects.toBeInstanceOf(AbandonedError);

    // Replacing a pending request must not trigger execution while request(1) is still active.
    expect(started).toEqual([1]);
    expect(maxInFlight).toBe(1);

    releaseByArg.get(1)?.();
    await expect(active).resolves.toBe(1);

    expect(started).toEqual([1, 3]);
    expect(maxInFlight).toBe(1);

    releaseByArg.get(3)?.();
    await expect(pending2).resolves.toBe(3);
  });
});

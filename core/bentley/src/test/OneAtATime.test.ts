/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { AbandonedError, OneAtATimeAction } from "../OneAtATimeAction";
import { BeDuration } from "../Time";

describe("OneAtATime test", () => {

  it("OneAtATime", async () => {
    const unhandledRejectionHandler = (_reason: any) => {
      expect(_reason).toBeInstanceOf(Error);
    };

    process.on("unhandledRejection", unhandledRejectionHandler);
    let calls = 0;
    const operation = new OneAtATimeAction(async (a: number, b: string) => {
      if (a === 10)
        throw new Error("cancelled");

      expect(a).toBe(200);
      expect(b).toBe("hello");
      await BeDuration.wait(100);
      return ++calls;
    }, "testAbandon");

    const abandonedError = new AbandonedError("testAbandon");
    const cancelled = new AbandonedError("cancelled");

    void expect(operation.request(200, "hello")).rejects.with.toBeInstanceOf(AbandonedError); // becomes pending, doesn't abort previous because its already started

    void expect(operation.request(200, "hello")).rejects.with.toBeInstanceOf(AbandonedError); // aborts previous, becomes pending
    let count = await operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run
    expect(count).toBe(2); // only the first and last complete
    // then, just try the whole thing again
    void expect(operation.request(10, "hello")).rejects; // try calling a function that throws
    void expect(operation.request(10, "hello")).rejects.with.toEqual(cancelled); // try calling a function that throws
    void expect(operation.request(200, "hello")).rejects.with.toEqual(abandonedError); // becomes pending, doesn't abort previous because its already started
    void expect(operation.request(200, "hello")).rejects.with.toEqual(abandonedError); // aborts previous, becomes pending
    count = await operation.request(200, "hello");
    expect(count).toBe(3);
    process.removeListener("unhandledRejection", unhandledRejectionHandler);
  });
});

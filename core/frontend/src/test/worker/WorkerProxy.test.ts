/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { createWorkerProxy } from "../../common/WorkerProxy";
import { TestWorker } from "./test-worker";

describe("WorkerProxy", () => {
  const createWorker = () => createWorkerProxy<TestWorker>("/test-worker.js");
  it("terminates", () => {
    const worker = createWorker();
    expect(worker.isTerminated).toBe(false);
    worker.terminate();
    expect(worker.isTerminated).toBe(true);
  });

  it("invokes functions accepting any number of arguments", async () => {
    const worker = createWorker();

    await expect(worker.zero()).resolves.toBe("zero");
    await expect(worker.one("hi")).resolves.toBe("hi");
    await expect(worker.two([1, 2])).resolves.toBe(3);
    await expect(worker.throwError()).rejects.toThrow("ruh-roh");
    await expect(worker.throwString()).rejects.toThrow("Unknown worker error");

    worker.terminate();
  });

  it("transfers objects to functions accepting any number of arguments", async () => {
    const worker = createWorker();

    let bytes = new Uint8Array(5);
    expect(bytes.length).toBe(5);
    await worker.one("hi", [bytes.buffer]);
    expect(bytes.length).toBe(0);

    bytes = new Uint8Array(4);
    expect(bytes.length).toBe(4);
    await worker.two([1, 2], [bytes.buffer]);
    expect(bytes.length).toBe(0);

    worker.terminate();
  });

  it("returns results out of sequence if caller does not await each operation", async () => {
    const worker = createWorker();

    const [slowest, slow, fast] = await Promise.all([
      worker.someVeryLongRunningAsyncOperation(),
      worker.someLongRunningAsyncOperation(),
      worker.someFastSynchronousOperation(),
    ]);

    expect(fast).toBeLessThan(slow);
    expect(slow).toBeLessThan(slowest);
    worker.terminate();
  });

  it("returns results in sequence if caller awaits each operation", async () => {
    const worker = createWorker();

    const first = await worker.someVeryLongRunningAsyncOperation();
    const second = await worker.someLongRunningAsyncOperation();
    const third = await worker.someFastSynchronousOperation();

    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    worker.terminate();
  });
});

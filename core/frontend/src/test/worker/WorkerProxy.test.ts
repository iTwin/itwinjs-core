/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { createWorkerProxy } from "../../common/WorkerProxy";
import { TestWorker } from "./test-worker";

use(chaiAsPromised);

describe("WorkerProxy", () => {
  const createWorker = () => createWorkerProxy<TestWorker>("./test-worker.js");
  it("terminates", () => {
    const worker = createWorker();
    expect(worker.isTerminated).to.be.false;
    worker.terminate();
    expect(worker.isTerminated).to.be.true;
  });

  it("invokes functions accepting any number of arguments", async () => {
    const worker = createWorker();

    expect(await worker.zero()).to.equal("zero");
    expect(await worker.one("hi")).to.equal("hi");
    expect(await worker.two([1, 2])).to.equal(3);
    await expect(worker.throwError()).to.be.eventually.rejectedWith("ruh-roh");
    await expect(worker.throwString()).to.be.eventually.rejectedWith("Unknown worker error");

    worker.terminate();
  });

  it("transfers objects to functions accepting any number of arguments", async () => {
    const worker = createWorker();

    let bytes = new Uint8Array(5);
    expect(bytes.length).to.equal(5);
    await worker.one("hi", [bytes.buffer]);
    expect(bytes.length).to.equal(0);

    bytes = new Uint8Array(4);
    expect(bytes.length).to.equal(4);
    await worker.two([1, 2], [bytes.buffer]);
    expect(bytes.length).to.equal(0);

    worker.terminate();
  });

  it.only("returns results out of sequence if caller does not await each operation", async () => {
    const worker = createWorker();

    const [slowest, slow, fast] = await Promise.all([
      worker.someVeryLongRunningAsyncOperation(),
      worker.someLongRunningAsyncOperation(),
      worker.someFastSynchronousOperation(),
    ]);

    expect(fast).to.be.lessThan(slow);
    expect(slow).to.be.lessThan(slowest);
    worker.terminate();
  });

  it.only("returns results in sequence if caller awaits each operation", async () => {
    const worker = createWorker();

    const first = await worker.someVeryLongRunningAsyncOperation();
    const second = await worker.someLongRunningAsyncOperation();
    const third = await worker.someFastSynchronousOperation();

    expect(first).to.be.lessThan(second);
    expect(second).to.be.lessThan(third);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration } from "@bentley/bentleyjs-core";
import { IModelHost } from "../../IModelHost";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelJsNative } from "@bentley/imodeljs-native";

describe("DgnDbWorker", () => {
  let imodel: StandaloneDb;

  function openIModel(): void {
    const rootSubject = { name: "DgnDbWorker tests", description: "DgnDbWorker tests" };
    imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DgnDbWorker", "DgnDbWorker.bim"), { rootSubject });
  }

  before(() => {
    openIModel();
  });

  after(() => {
    imodel.close();
  });

  class Worker {
    public readonly promise: Promise<void>;
    private readonly _worker: IModelJsNative.TestWorker;

    public constructor() {
      let worker: unknown;
      this.promise = new Promise<void>((resolve) => {
        worker = new IModelHost.platform.TestWorker(imodel.nativeDb, () => resolve());
      });

      expect(worker).instanceof(IModelHost.platform.TestWorker);
      this._worker = worker as IModelJsNative.TestWorker;
    }

    public queue() { this._worker.queue(); }
    public cancel() { this._worker.cancel(); }
    public setReady() { this._worker.setReady(); }
    public setThrow() { this._worker.setThrow(); }

    public get isCanceled(): boolean { return this._worker.isCanceled(); }
    public get wasExecuted(): boolean { return this._worker.wasExecuted(); }
    public get state(): IModelJsNative.TestWorkerState { return this._worker.getState(); }

    public get wasQueued() { return IModelJsNative.TestWorkerState.NotQueued !== this.state; }
    public get isQueued() { return IModelJsNative.TestWorkerState.Queued === this.state; }
    public get isRunning() { return IModelJsNative.TestWorkerState.Running === this.state; }
    public get isError() { return IModelJsNative.TestWorkerState.Error === this.state; }
    public get isOk() { return IModelJsNative.TestWorkerState.Ok === this.state; }
    public get isSkipped() { return IModelJsNative.TestWorkerState.Skipped === this.state; }
    public get isAborted() { return IModelJsNative.TestWorkerState.Aborted === this.state; }
  }

  async function waitUntil(condition: () => boolean): Promise<void> {
    if (condition())
      return;

    await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
    return waitUntil(condition);
  }

  it("executes asynchronously", async () => {
    const worker = new Worker();
    await BeDuration.wait(1000);
    expect(worker.wasQueued).to.be.false;
    expect(worker.isCanceled).to.be.false;

    worker.queue();
    expect(worker.isQueued || worker.isRunning).to.be.true;

    worker.setReady();
    await worker.promise;

    expect(worker.wasExecuted).to.be.true;
    expect(worker.isCanceled).to.be.false;
    expect(worker.isOk).to.be.true;
  });

  it("executes a maximum of 4 simultaneously", async () => {
    // Create 4 workers. They should all start executing.
    const first = [new Worker(), new Worker(), new Worker(), new Worker()];
    for (const worker of first)
      worker.queue();

    await waitUntil(() => first.every((x) => x.isRunning));

    // Queue up 2 more workers. They should not start executing until at least one of the first 4 resolves.
    const next = [new Worker(), new Worker()];
    for (const worker of next)
      worker.queue();

    await BeDuration.wait(1000);
    expect(first.every((x) => x.isRunning)).to.be.true;
    expect(next.every((x) => x.isQueued)).to.be.true;

    // Let the first worker resolve.
    first[0].setReady();
    await first[0].promise;
    expect(first[0].isOk).to.be.true;

    // Exactly one of the 2 workers remaining in the queue should start executing.
    await waitUntil(() => next.some((x) => x.isRunning));
    await BeDuration.wait(1000);
    expect(next.every((x) => x.isRunning)).to.be.false;

    // Clear the queue.
    const workers = first.concat(next);
    for (const worker of workers)
      worker.setReady();

    await Promise.all(workers.map((x) => x.promise)); // eslint-disable-line @typescript-eslint/promise-function-async
    expect(workers.every((x) => x.isOk)).to.be.true;
  });

  it("skips execution if canceled before execution begins", async () => {
    const worker = new Worker();
    worker.cancel();
    expect(worker.isCanceled).to.be.true;
    worker.queue();
    await worker.promise;
    expect(worker.isSkipped).to.be.true;
    expect(worker.wasExecuted).to.be.false;
  });

  it("executes if canceled after execution begins", async () => {
    const worker = new Worker();
    worker.queue();
    await waitUntil(() => worker.isRunning);
    worker.cancel();
    worker.setReady();
    await worker.promise;
    expect(worker.isCanceled).to.be.true;
    expect(worker.isSkipped).to.be.false;
    expect(worker.wasExecuted).to.be.true;
  });

  it("throws", async () => {
    const worker = new Worker();
    worker.setThrow();
    worker.queue();
    await worker.promise;
    expect(worker.isCanceled).to.be.false;
    expect(worker.isError).to.be.true;
  });

  it("cancels all workers before iModel is closed", async () => {
    const resolve = new Worker();
    resolve.setReady();
    const reject = new Worker();
    reject.setThrow();

    // These 6 workers will never resolve nor reject explicitly.
    const cancel = [new Worker(), new Worker(), new Worker(), new Worker(), new Worker(), new Worker()];

    // Queue up all the workers.
    const workers = cancel.concat([resolve, reject]);
    for (const worker of workers)
      worker.queue();

    // Closing the iModel cancels all extant workers.
    imodel.close();
    openIModel();
    await Promise.all(workers.map((x) => x.promise)); // eslint-disable-line @typescript-eslint/promise-function-async

    expect(cancel.every((x) => x.isCanceled)).to.be.true;
    expect(cancel.every((x) => x.isAborted || x.isSkipped)).to.be.true;
    expect(resolve.isOk || resolve.isSkipped || resolve.isAborted).to.be.true;
    expect(reject.isError || reject.isSkipped).to.be.true;
  });
});

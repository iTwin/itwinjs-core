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

describe.only("DgnDbWorker", () => {
  let imodel: StandaloneDb;

  before(() => {
    const rootSubject = { name: "DgnDbWorker tests", description: "DgnDbWorker tests" };
    imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DgnDbWorker", "DgnDbWorker.bim"), { rootSubject });
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

    public setReady() { this._worker.setReady(); }
    public get isCanceled(): boolean { return this._worker.isCanceled(); }
    public get wasExecuted(): boolean { return this._worker.wasExecuted(); }
    public get state(): IModelJsNative.TestWorkerState { return this._worker.getState(); }

    public get isQueued() { return IModelJsNative.TestWorkerState.Queued === this.state; }
    public get isRunning() { return IModelJsNative.TestWorkerState.Running === this.state; }
    public get isError() { return IModelJsNative.TestWorkerState.Error === this.state; }
    public get isOk() { return IModelJsNative.TestWorkerState.Ok === this.state; }
    public get isSkipped() { return IModelJsNative.TestWorkerState.Skipped === this.state; }
  }

  it("executes asynchronously", async () => {
    const worker = new Worker();
    worker.setReady();
    await worker.promise;

    expect(worker.wasExecuted).to.be.true;
    expect(worker.isCanceled).to.be.false;
    expect(worker.isOk).to.be.true;
  });
});

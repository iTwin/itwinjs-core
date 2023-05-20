/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { createWorkerProxy } from "../../common";
import { TestWorker } from "./test-worker";

use(chaiAsPromised);

describe.only("WorkerProxy", () => {
  const createWorker = () => createWorkerProxy<TestWorker>("./test-worker.js");
  it("terminates", () => {
    const worker = createWorker();
    expect(worker.isTerminated).to.be.false;
    worker.terminate();
    expect(worker.isTerminated).to.be.true;
  });

  it("invokes functions accepting any number of arguments", async () => {
    // ###TODO
  });

  it("transfers objects to functions accepting any number of arguments", async () => {
    // ###TODO
  });
});

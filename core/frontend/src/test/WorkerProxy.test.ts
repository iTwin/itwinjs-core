/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { createWorkerProxy } from "../common";

describe("WorkerProxy", () => {
  it("terminates", () => {
    const worker = createWorkerProxy<any>("./scripts/parse-imdl-worker.js");
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

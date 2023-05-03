/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { IModelApp } from "../IModelApp";

use(chaiAsPromised);

describe.only("WebWorker", () => {
  async function callWorker(scriptName: string, input: string): Promise<string> {
    const usePublicPath = false;
    const path = usePublicPath ? IModelApp.publicPath : "";
    const worker = new Worker(`${path}scripts/${scriptName}.js`);
    return new Promise((resolve, reject) => {
      worker.postMessage(input);
      console.log("posted message to worker");
      worker.addEventListener("message", (e) => {
        console.log("received response from worker");
        resolve(e.data);
      });
      worker.addEventListener("error", (error) => {
        console.log("worker threw");
        reject(error);
      });
    });
  }

  it("receives response", async () => {
    const response = await callWorker("example-worker", "Hello");
    expect(response).to.equal("HELLO");
  });

  it("receives error", async () => {
    const promise = callWorker("example-worker", "ERROR");
    await expect(promise).to.be.eventually.rejectedWith(ErrorEvent, "worker received ERROR");
  });
});

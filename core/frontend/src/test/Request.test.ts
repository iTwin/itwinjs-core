/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { request } from "../request/Request";
import { assert, expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

describe("request()", async () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("Should retry n times before failing if retryCount is specified", async () => {
    const retryCount = 3;
    const error = new Error("Network Error");

    const fetchStub = sandbox.stub(window, "fetch");
    fetchStub.rejects(error);

    const promise = request("https://www.itwinjs.org/", "text", { retryCount });
    await expect(promise).to.be.eventually.rejectedWith(Error, error.message);

    assert(fetchStub.callCount === retryCount + 1);
  });

  it("Should retry 4 times before failing if retryCount is not specified", async () => {
    const defaultRetryCount = 4;
    const error = new Error("Network Error");

    const fetchStub = sandbox.stub(window, "fetch");
    fetchStub.rejects(error);

    const promise = request("https://www.itwinjs.org/", "text");
    await expect(promise).to.be.eventually.rejectedWith(Error, error.message);

    assert(fetchStub.callCount === defaultRetryCount + 1);
  });

  it("Should not retry if AbortError was thrown", async () => {
    const error = new Error("The user aborted a request.");
    error.name = "AbortError";

    const fetchStub = sandbox.stub(window, "fetch");
    fetchStub.rejects(error);

    const promise = request("https://www.itwinjs.org/", "text", { timeout: 10 });
    await expect(promise).to.be.eventually.rejected;

    assert(fetchStub.calledOnce);
    assert(fetchStub.getCall(0).args[1]?.signal);
  });
});

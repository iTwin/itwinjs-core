/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import {
  HttpResponseError,
  request,
  RequestBasicCredentials,
} from "../request/Request";
import { assert, expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

describe("request()", async () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("Should throw HttpResponseError if response status is not in 200-299 range", async () => {
    const response = new Response(undefined, { status: 500 });

    const fetchStub = sandbox.stub(window, "fetch");
    fetchStub.resolves(response);

    let thrownError;
    try {
      await request("https://www.itwinjs.org/", "text");
    } catch (error: unknown) {
      thrownError = error;
    }

    assert(thrownError instanceof HttpResponseError);
    assert(thrownError.status === response.status);
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

    const promise = request("https://www.itwinjs.org/", "text", {
      timeout: 10,
    });
    await expect(promise).to.be.eventually.rejected;

    assert(fetchStub.calledOnce);
    assert(fetchStub.getCall(0).args[1]?.signal);
  });

  it("Should generate valid basic auth token if username and password are provided", async () => {
    const auth: RequestBasicCredentials = {
      user: "TestUsername",
      password: "TestPassword",
    };

    const fetchStub = sandbox.stub(window, "fetch");
    fetchStub.resolves(new Response());

    await request("https://www.itwinjs.org/", "text", { auth });

    const headers = fetchStub.getCall(0).args[1]?.headers as any;

    const token = headers?.authorization;
    assert(typeof token === "string");
    assert(/^Basic /.test(token));

    const base64Str = token.substring(6);
    assert(window.atob(base64Str) === `${auth.user}:${auth.password}`);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpResponseError, request, RequestBasicCredentials } from "../request/Request";

describe("request()", async () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Should throw HttpResponseError if response status is not in 200-299 range", async () => {
    const response = new Response(undefined, { status: 500 });

    vi.spyOn(window, "fetch").mockResolvedValue(response);

    let thrownError;
    try {
      await request("https://www.itwinjs.org/", "text");
    } catch (error: unknown) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(HttpResponseError);
    expect((thrownError as HttpResponseError).status).toBe(response.status);
  });

  it("Should retry n times before failing if retryCount is specified", async () => {
    const retryCount = 3;
    const error = new Error("Network Error");

    const fetchStub = vi.spyOn(window, "fetch").mockRejectedValue(error);

    const promise = request("https://www.itwinjs.org/", "text", { retryCount });
    await expect(promise).rejects.toThrowError(error.message);

    expect(fetchStub).toHaveBeenCalledTimes(retryCount + 1);
  });

  it("Should retry 4 times before failing if retryCount is not specified", async () => {
    const defaultRetryCount = 4;
    const error = new Error("Network Error");

    const fetchStub = vi.spyOn(window, "fetch").mockRejectedValue(error);

    const promise = request("https://www.itwinjs.org/", "text");
    await expect(promise).rejects.toThrowError(error.message);

    expect(fetchStub).toHaveBeenCalledTimes(defaultRetryCount + 1);
  });

  it("Should not retry if AbortError was thrown", async () => {
    const error = new Error("The user aborted a request.");
    error.name = "AbortError";

    const fetchStub = vi.spyOn(window, "fetch").mockRejectedValue(error);

    const promise = request("https://www.itwinjs.org/", "text", { timeout: 10 });
    await expect(promise).rejects.toThrowError(error.message);

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls[0][1]?.signal).toBeDefined();
  });

  it("Should generate valid basic auth token if username and password are provided", async () => {
    const auth: RequestBasicCredentials = {
      user: "TestUsername",
      password: "TestPassword",
    };

    const fetchStub = vi.spyOn(window, "fetch").mockResolvedValue(new Response());

    await request("https://www.itwinjs.org/", "text", { auth });

    const headers = fetchStub.mock.calls[0][1]?.headers as any;

    const token = headers?.authorization;
    expect(typeof token).toBe("string");
    expect(/^Basic /.test(token)).toBe(true);

    const base64Str = token.substring(6);
    expect(window.atob(base64Str)).toBe(`${auth.user}:${auth.password}`);
  });
});

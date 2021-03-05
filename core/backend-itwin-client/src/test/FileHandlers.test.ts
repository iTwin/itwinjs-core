/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as nock from "nock";
import * as path from "path";
import * as streamBuffers from "stream-buffers";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, CancelRequest, ProgressInfo } from "@bentley/itwin-client";
import { AzureFileHandler } from "../imodelhub/AzureFileHandler";

const testValidUrl = "https://example.com/";
const testErrorUrl = "http://bad.example.com/";  // NB: This is not automatically mocked - each test should use nock as-needed.

const ECONNRESET: any = new Error("socket hang up");
ECONNRESET.code = "ECONNRESET";

const testOutputDir = path.join(__dirname, "output");
const targetFile = path.join(testOutputDir, "downloadedFile");

describe("AzureFileHandler", async () => {
  const ctx = ClientRequestContext.current as AuthorizedClientRequestContext;
  const createCancellation = (): CancelRequest => ({ cancel: () => false });

  let generatedTestData: Buffer;
  let onDataReceived: () => Promise<void>;

  before(async () => {
    generatedTestData = crypto.randomBytes(1024 * 1024);
  });

  beforeEach(async () => {
    fs.emptyDirSync(testOutputDir);
    const responseStream = new streamBuffers.ReadableStreamBuffer({ chunkSize: generatedTestData.byteLength / 8, frequency: 0 });
    responseStream.put(generatedTestData);
    responseStream.stop();
    const scope = nock(testValidUrl).get("/").optionally().reply(200, responseStream);
    scope.once("request", (response: any) => {
      response.socket.prependListener("close", () => responseStream.destroy());
    });

    onDataReceived = async () => new Promise(async (resolve) => responseStream.prependOnceListener("data", resolve));
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it("downloads a file", async () => {
    const handler = new AzureFileHandler();
    await handler.downloadFile(ctx, testValidUrl, targetFile);
    assert(fs.readFileSync(targetFile).compare(generatedTestData) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("supports canceling a file", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile(ctx, testValidUrl, targetFile, undefined, undefined, signal);
    await onDataReceived();
    assert.isTrue(signal.cancel());
    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "User cancelled operation");
      assert.equal(error.message, "User cancelled download");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(signal.cancel());
      // FIXME: This is fixed in nock 13
      // await Promise.race([
      //   new Promise((resolve) => setTimeout(resolve)),
      //   onDataReceived().then(() => assert.fail("Should not read after cancellation!")),
      // ]);
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("supports progress callbacks", async () => {
    const handler = new AzureFileHandler();
    const progressArgs: ProgressInfo[] = [];
    const progressCb = (arg: any) => progressArgs.push(arg);
    const promise = handler.downloadFile(ctx, testValidUrl, targetFile, generatedTestData.byteLength, progressCb);
    assert.isEmpty(progressArgs);
    while (progressArgs.length === 0)
      await onDataReceived();

    assert.isAbove(progressArgs.length, 0);
    assert.isBelow(progressArgs.length, 8);
    await promise;
    assert.isAtLeast(progressArgs.length, 8);

    for (const { loaded, total, percent } of progressArgs) {
      assert.equal(total, generatedTestData.byteLength);
      assert.equal(percent, 100 * loaded / total!);
    }
    assert.equal(progressArgs[progressArgs.length - 1].percent, 100);
  });

  it("should stop progress callbacks after cancellation", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const progressArgs: any[] = [];
    const progressCb = (arg: any) => progressArgs.push(arg);
    const promise = handler.downloadFile(ctx, testValidUrl, targetFile, generatedTestData.byteLength, progressCb, signal);
    assert.isEmpty(progressArgs);
    while (progressArgs.length === 0)
      await onDataReceived();

    assert.isAbove(progressArgs.length, 0);
    assert.isBelow(progressArgs.length, 8);
    const lastProgressLength = progressArgs.length;
    assert.isTrue(signal.cancel());
    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "User cancelled operation");
      assert.equal(error.message, "User cancelled download");
      assert.equal(progressArgs.length, lastProgressLength);
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should return false for cancel request after download is complete", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    await handler.downloadFile(ctx, testValidUrl, targetFile, undefined, undefined, signal);
    assert.isFalse(signal.cancel());
    assert(fs.readFileSync(targetFile).compare(generatedTestData) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("should retry on HTTP 503", async () => {
    nock(testErrorUrl).get("/").twice().reply(503, "Service Unavailable");
    nock(testErrorUrl).get("/").reply(200, "This should eventually succeed");
    const handler = new AzureFileHandler();
    await handler.downloadFile(ctx, testErrorUrl, targetFile);
    assert.isTrue(nock.isDone());
    assert.equal(fs.readFileSync(targetFile).toString(), "This should eventually succeed");
  });

  it("should eventually throw for HTTP 503", async () => {
    nock(testErrorUrl).persist().get("/").reply(503, "Service Unavailable");
    const handler = new AzureFileHandler();
    try {
      await handler.downloadFile(ctx, testErrorUrl, targetFile);
    } catch (error) {
      assert.equal(error.errorNumber, 503);
      assert.equal(error.name, "Fail to download file");
      assert.equal(error.message, "Service Unavailable");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should not retry HTTP 403", async () => {
    nock(testErrorUrl).get("/").twice().reply(403, "Forbidden");
    const handler = new AzureFileHandler();
    try {
      await handler.downloadFile(ctx, testErrorUrl, targetFile);
    } catch (error) {
      assert.equal(error.errorNumber, 403);
      assert.equal(error.name, "Fail to download file");
      assert.equal(error.message, "Forbidden");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(nock.isDone(), "Should have only requested once!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should retry on ECONNRESET", async () => {
    nock(testErrorUrl).get("/").replyWithError(ECONNRESET);
    nock(testErrorUrl).get("/").reply(200, "This should eventually succeed");
    const handler = new AzureFileHandler();
    await handler.downloadFile(ctx, testErrorUrl, targetFile);
    assert.isTrue(nock.isDone());
    assert.equal(fs.readFileSync(targetFile).toString(), "This should eventually succeed");
  });

  it("should eventually throw for ECONNRESET", async () => {
    nock(testErrorUrl).persist().get("/").replyWithError(ECONNRESET);
    const handler = new AzureFileHandler();
    const promise = handler.downloadFile(ctx, testErrorUrl, targetFile);
    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "ECONNRESET");
      assert.equal(error.message, "socket hang up");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  }).timeout("30s");

  it("should throw when tempfile is deleted", async () => {
    const handler = new AzureFileHandler();
    const promise = handler.downloadFile(ctx, testValidUrl, targetFile);
    await onDataReceived();
    fs.emptyDirSync(testOutputDir);

    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "ENOENT");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should return false for cancel request after disk error", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile(ctx, testValidUrl, targetFile, undefined, undefined, signal);
    await onDataReceived();
    fs.emptyDirSync(testOutputDir);
    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "ENOENT");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(signal.cancel());
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should return false for cancel request after network error", async () => {
    nock(testErrorUrl).persist().get("/").replyWithError(ECONNRESET);
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile(ctx, testErrorUrl, targetFile, undefined, undefined, signal);
    try {
      await promise;
    } catch (error) {
      assert.equal(error.name, "ECONNRESET");
      assert.equal(error.message, "socket hang up");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(signal.cancel());
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });
});

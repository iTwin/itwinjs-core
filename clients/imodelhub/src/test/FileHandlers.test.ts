/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import nock from "nock";
import * as path from "path";
import { AsyncMutex, BeEvent } from "@itwin/core-bentley";
import { CancelRequest, ProgressInfo } from "@bentley/itwin-client";
import { AzureFileHandler } from "../itwin-client/AzureFileHandler";

const testValidUrl = "https://example.com/";
const testErrorUrl = "http://bad.example.com/";  // NB: This is not automatically mocked - each test should use nock as-needed.
const blobSizeInBytes = 1024 * 10;
const blockSize = 1024;
const enableMd5 = true;

const ECONNRESET: any = new Error("socket hang up");
ECONNRESET.code = "ECONNRESET";

const testOutputDir = path.join(__dirname, "output");
const targetFile = path.join(testOutputDir, "downloadedFile");
function createHandler() {
  return new AzureFileHandler(undefined, undefined, { blockSize, simultaneousDownloads: 1, progressReportAfter: 100, checkMD5AfterDownload: enableMd5 });
}
describe("AzureFileHandler", async () => {
  const createCancellation = (): CancelRequest => ({ cancel: () => false });

  const randomBuffer = crypto.randomBytes(blobSizeInBytes);
  let onDataReceived: () => Promise<void>;
  let bytesRead = 0;
  const bytesReadChanged = new BeEvent();
  beforeEach(async () => {
    bytesReadChanged.clear();
    bytesRead = 0;
    fs.emptyDirSync(testOutputDir);
    nock(testValidUrl).persist().get("/").reply(200, async function (this: nock.ReplyFnContext) {
      const rangeStr = this.req.getHeader("range") as string;
      const range = rangeStr.replace("bytes=", "").split("-");
      const startOffset = Number(range[0]);
      const stopOffset = Number(range[1]);
      const length = stopOffset - startOffset;
      bytesRead += length;
      bytesReadChanged.raiseEvent();
      const block = new Uint8Array(length + 1);
      randomBuffer.copy(block, 0, startOffset, stopOffset + 1);
      return Buffer.from(block);
    });

    const md5 = crypto.createHash("md5").update(randomBuffer).digest("base64");
    const header = { "content-length": blobSizeInBytes.toString(), "accept-ranges": "bytes", "content-md5": md5 };
    nock(testValidUrl).head("/").reply(200, undefined, header);

    onDataReceived = async () => { if (bytesRead < blobSizeInBytes) return new Promise((resolve) => bytesReadChanged.addOnce(resolve)); };
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  it("downloads a file", async () => {
    const handler = new AzureFileHandler();
    await handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes);
    assert(fs.readFileSync(targetFile).compare(randomBuffer) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("supports canceling a file", async () => {
    const handler = createHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes, undefined, signal);
    await onDataReceived();
    assert.isTrue(signal.cancel());
    try {
      await promise;
    } catch (error: any) {
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
    const handler = createHandler();
    const progressArgs: ProgressInfo[] = [];
    const progressCb = (arg: any) => progressArgs.push(arg);
    const promise = handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes, progressCb);
    assert.isEmpty(progressArgs);
    while (progressArgs.length === 0)
      await onDataReceived();

    assert.isAbove(progressArgs.length, 0);
    assert.isBelow(progressArgs.length, 8);
    await promise;
    assert.isAtLeast(progressArgs.length, 2);

    for (const { loaded, total, percent } of progressArgs) {
      assert.equal(total, blobSizeInBytes);
      assert.equal(percent, 100 * loaded / total!);
    }
    assert.equal(progressArgs[progressArgs.length - 1].percent, 100);
  });

  it("should stop progress callbacks after cancellation", async () => {
    const handler = createHandler();
    const signal = createCancellation();
    const progressArgs: any[] = [];
    const firstEvent = new AsyncMutex();
    const unlock = await firstEvent.lock();
    const progressCb = (arg: any) => {
      progressArgs.push(arg);
      if (progressArgs.length === 1) {
        unlock();
      }
    };
    const promise = handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes, progressCb, signal);
    assert.isEmpty(progressArgs);
    (await firstEvent.lock())();

    assert.isAbove(progressArgs.length, 0);
    assert.isBelow(progressArgs.length, 8);
    const lastProgressLength = progressArgs.length;
    assert.isTrue(signal.cancel());
    try {
      await promise;
    } catch (error: any) {
      assert.equal(error.name, "User cancelled operation");
      assert.equal(error.message, "User cancelled download");
      assert.isTrue(progressArgs.length >= lastProgressLength);
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should return false for cancel request after download is complete", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    await handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes, undefined, signal);
    assert.isFalse(signal.cancel());
    assert(fs.readFileSync(targetFile).compare(randomBuffer) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("should retry on HTTP 503", async () => {
    nock.cleanAll();
    nock(testErrorUrl).get("/").twice().reply(503, "Service Unavailable");
    nock(testErrorUrl).head("/").thrice().reply(503, "Service Unavailable");

    nock(testErrorUrl).persist().get("/").reply(200, async function (this: nock.ReplyFnContext) {
      const rangeStr = this.req.getHeader("range") as string;
      const range = rangeStr.replace("bytes=", "").split("-");
      const startOffset = Number(range[0]);
      const stopOffset = Number(range[1]);
      const length = stopOffset - startOffset;
      bytesRead += length;
      bytesReadChanged.raiseEvent();
      const block = new Uint8Array(length + 1);
      randomBuffer.copy(block, 0, startOffset, stopOffset + 1);
      return Buffer.from(block);
    });

    const md5 = crypto.createHash("md5").update(randomBuffer).digest("base64");
    const header = { "content-length": blobSizeInBytes.toString(), "accept-ranges": "bytes", "content-md5": md5 };
    nock(testErrorUrl).head("/").reply(200, undefined, header);

    const handler = new AzureFileHandler(undefined, undefined, { blockSize });
    await handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes);
    assert.isTrue(nock.isDone());
    assert(fs.readFileSync(targetFile).compare(randomBuffer) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("should eventually throw for HTTP 503", async () => {
    nock(testErrorUrl).persist().get("/").reply(503, "Service Unavailable");
    nock(testErrorUrl).persist().head("/").reply(503, "Service Unavailable");
    const handler = new AzureFileHandler();
    try {
      await handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes);
    } catch (error: any) {
      assert.equal(error.name, "HTTPError");
      assert.equal(error.message, "Response code 503 (Service Unavailable)");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should not retry HTTP 403", async () => {
    nock(testErrorUrl).get("/").twice().reply(403, "Forbidden");
    nock(testErrorUrl).head("/").twice().reply(403, "Forbidden");

    const handler = new AzureFileHandler();
    try {
      await handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes);
    } catch (error: any) {
      assert.equal(error.name, "HTTPError");
      assert.equal(error.message, "Response code 403 (Forbidden)");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(nock.isDone(), "Should have only requested once!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should retry on ECONNRESET", async () => {
    nock.cleanAll();
    nock(testErrorUrl).get("/").replyWithError(ECONNRESET);
    nock(testErrorUrl).head("/").replyWithError(ECONNRESET);
    nock(testErrorUrl).persist().get("/").reply(200, async function (this: nock.ReplyFnContext) {
      const rangeStr = this.req.getHeader("range") as string;
      const range = rangeStr.replace("bytes=", "").split("-");
      const startOffset = Number(range[0]);
      const stopOffset = Number(range[1]);
      const length = stopOffset - startOffset;
      bytesRead += length;
      bytesReadChanged.raiseEvent();
      const block = new Uint8Array(length + 1);
      randomBuffer.copy(block, 0, startOffset, stopOffset + 1);
      return Buffer.from(block);
    });

    const md5 = crypto.createHash("md5").update(randomBuffer).digest("base64");
    const header = { "content-length": blobSizeInBytes.toString(), "accept-ranges": "bytes", "content-md5": md5 };
    nock(testErrorUrl).head("/").reply(200, undefined, header);

    const handler = new AzureFileHandler();
    await handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes);
    assert.isTrue(nock.isDone());
    assert(fs.readFileSync(targetFile).compare(randomBuffer) === 0, "Downloaded file contents do not match expected contents.");
  });

  it("should eventually throw for ECONNRESET", async () => {
    nock.cleanAll();
    nock(testErrorUrl).persist().head("/").replyWithError(ECONNRESET);
    const handler = new AzureFileHandler();
    const promise = handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes);
    try {
      await promise;
    } catch (error: any) {
      assert.equal(error.code, "ECONNRESET");
      assert.equal(error.message, "socket hang up");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  }).timeout("30s");

  // ###TODO khanaffan This tends to hang on linux.
  it.skip("should throw when tempfile is deleted", async () => {
    const handler = new AzureFileHandler();
    const promise = handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes);
    await onDataReceived();
    fs.emptyDirSync(testOutputDir);

    try {
      await promise;
    } catch (error: any) {
      assert.oneOf(error.code, ["EPERM", "ENOENT"]);
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it.skip("should return false for cancel request after disk error", async () => {
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile("", testValidUrl, targetFile, blobSizeInBytes, undefined, signal);
    await onDataReceived();
    fs.emptyDirSync(testOutputDir);
    try {
      await promise;
    } catch (error: any) {
      assert.equal(error.name, "ENOENT");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(signal.cancel());
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });

  it("should return false for cancel request after network error", async () => {
    nock(testErrorUrl).persist().head("/").replyWithError(ECONNRESET);
    const handler = new AzureFileHandler();
    const signal = createCancellation();
    const promise = handler.downloadFile("", testErrorUrl, targetFile, blobSizeInBytes, undefined, signal);
    try {
      await promise;
    } catch (error: any) {
      assert.equal(error.code, "ECONNRESET");
      assert.equal(error.message, "socket hang up");
      assert.isFalse(fs.existsSync(targetFile), "Should not have written anything to disk after failure!");
      assert.isFalse(signal.cancel());
      return;
    }
    assert.fail("Expected an error to be thrown!");
  });
});

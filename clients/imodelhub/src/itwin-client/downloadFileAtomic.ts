/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import got from "got";
import { PassThrough, pipeline as pipeline_callback } from "stream";
import { promisify } from "util";
import { BriefcaseStatus } from "@itwin/core-bentley";
import { CancelRequest, DownloadFailed, ProgressCallback, ResponseError, UserCancelledError } from "@bentley/itwin-client";
import { BufferedStream } from "./AzureFileHandler";

import WriteStreamAtomic from "fs-write-stream-atomic";

const pipeline = promisify(pipeline_callback);

/** @internal */
export async function downloadFileAtomic(downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest, bufferThreshold?: number): Promise<void> {
  let retryCount = 0;
  let closePromise: Promise<void>;

  while (retryCount > -1) {
    const fileStream = new WriteStreamAtomic(downloadToPathname, { encoding: "binary" });
    closePromise = new Promise((resolve) => fileStream.once("close", resolve));

    const bufferedStream = (bufferThreshold !== undefined) ? new BufferedStream(bufferThreshold) : new PassThrough();

    const downloadStream = got.stream(downloadUrl);
    downloadStream.retryCount = retryCount;
    downloadStream.once("retry", (count) => retryCount = count);  // NB: This listener is required to use got's default retry behavior!
    retryCount = -1;

    if (progressCallback) {
      downloadStream.on("downloadProgress", ({ transferred }) => {
        progressCallback({ loaded: transferred, total: fileSize, percent: fileSize ? 100 * transferred / fileSize : 0 });
      });
    }

    if (cancelRequest !== undefined) {
      cancelRequest.cancel = () => {
        downloadStream.destroy(new got.CancelError());
        return true;
      };
    }

    try {
      await pipeline(
        downloadStream,
        bufferedStream,
        fileStream,
      );
    } catch (error: any) {
      if (error instanceof got.CancelError)
        throw new UserCancelledError(BriefcaseStatus.DownloadCancelled, "User cancelled download");

      if (error instanceof got.HTTPError)
        throw new DownloadFailed(error.response.statusCode, error.response.statusMessage ?? "Download failed");

      // Ignore ERR_STREAM_PREMATURE_CLOSE - that comes from `got` aborting the request on retries.
      if (error.code !== "ERR_STREAM_PREMATURE_CLOSE")
        throw ResponseError.parse(error);
    } finally {
      if (cancelRequest !== undefined)
        cancelRequest.cancel = () => false;

      // Ensure that `fileStream` has fully written/cleaned up before continuing
      await closePromise!;
    }
  }
}

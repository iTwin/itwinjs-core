/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHub
 */

import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as urllib from "url";
import { Logger } from "@bentley/bentleyjs-core";
import { ArgumentCheck } from "@bentley/imodelhub-client";
import {
  AuthorizedClientRequestContext, CancelRequest, DownloadFailed, FileHandler, ProgressCallback, ProgressInfo, request, RequestOptions, SasUrlExpired,
  UserCancelledError,
} from "@bentley/itwin-client";
import { MobileHost } from "./MobileHost";

const loggerCategory: string = "mobile.filehandler";

/**
 * Provides methods to work with the file system and azure storage. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 * @internal
 */
export class MobileFileHandler implements FileHandler {
  /** @internal */
  public agent?: https.Agent;

  /**
   * Constructor for MobileFileHandler.
   */
  constructor() {
  }

  /** Create a directory, recursively setting up the path as necessary. */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    MobileFileHandler.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  /**
   * Make url safe for logging by removing sensitive information
   * @param url input url that will be strip of search and query parameters and replace them by ... for security reason
   */
  private static getSafeUrlForLogging(url: string): string {
    const safeToLogDownloadUrl = urllib.parse(url);
    if (safeToLogDownloadUrl.search && safeToLogDownloadUrl.search.length > 0)
      safeToLogDownloadUrl.search = "...";
    if (safeToLogDownloadUrl.hash && safeToLogDownloadUrl.hash.length > 0)
      safeToLogDownloadUrl.hash = "...";
    return urllib.format(safeToLogDownloadUrl);
  }

  /**
   * Check if sas url has expired
   * @param download sas url for download
   * @param futureSeconds should be valid in future for given seconds.
   */
  public static isUrlExpired(downloadUrl: string, futureSeconds?: number): boolean {
    const sasUrl = new URL(downloadUrl);
    const se = sasUrl.searchParams.get("se");
    if (se) {
      const expiryUTC = new Date(se);
      const now = new Date();
      const currentUTC = new Date(now.toUTCString());
      if (futureSeconds) {
        currentUTC.setSeconds(futureSeconds + currentUTC.getSeconds());
      }
      return expiryUTC <= currentUTC;
    }
    return false;
  }

  /**
   * Download a file from AzureBlobStorage for iModelHub. Creates the directory containing the file if necessary. If there is an error in the operation, incomplete file is deleted from disk.
   * @param requestContext The client request context
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */
  public async downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    // strip search and hash parameters from download Url for logging purpose
    requestContext.enter();
    const safeToLogUrl = MobileFileHandler.getSafeUrlForLogging(downloadUrl);
    Logger.logInfo(loggerCategory, `Downloading file from ${safeToLogUrl}`);
    ArgumentCheck.defined("downloadUrl", downloadUrl);
    ArgumentCheck.defined("downloadToPathname", downloadToPathname);
    if (MobileFileHandler.isUrlExpired(downloadUrl)) {
      Logger.logError(loggerCategory, `Sas url has expired ${safeToLogUrl}`);
      throw new SasUrlExpired(403, "Download URL has expired");
    }
    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    MobileFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));
    try {
      await MobileHost.downloadFile(downloadUrl, downloadToPathname, progressCallback, cancelRequest);
    } catch (err) {
      requestContext.enter();
      if (fs.existsSync(downloadToPathname))
        fs.unlinkSync(downloadToPathname); // Just in case there was a partial download, delete the file

      if (!(err instanceof UserCancelledError))
        Logger.logError(loggerCategory, `Error downloading file`);
      throw err;
    }
    if (fileSize && fs.existsSync(downloadToPathname)) {
      if (fs.lstatSync(downloadToPathname).size !== fileSize) {
        fs.unlinkSync(downloadToPathname);
        Logger.logError(loggerCategory, `Downloaded file is of incorrect size ${safeToLogUrl}`);
        throw new DownloadFailed(403, "Download failed. Expected filesize does not match");
      }
    }
    requestContext.enter();
    Logger.logTrace(loggerCategory, `Downloaded file from ${safeToLogUrl}`);
  }
  /** Get encoded block id from its number. */
  private getBlockId(blockId: number) {
    return Base64.encode(blockId.toString(16).padStart(5, "0"));
  }

  private async uploadChunk(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, fileDescriptor: number, blockId: number, callback?: ProgressCallback) {
    requestContext.enter();
    const chunkSize = 4 * 1024 * 1024;
    let buffer = Buffer.alloc(chunkSize);
    const bytesRead = fs.readSync(fileDescriptor, buffer, 0, chunkSize, chunkSize * blockId);
    buffer = buffer.slice(0, bytesRead);

    const options: RequestOptions = {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": "application/octet-stream", // eslint-disable-line @typescript-eslint/naming-convention
        "Content-Length": buffer.length, // eslint-disable-line @typescript-eslint/naming-convention
      },
      body: buffer,
      progressCallback: callback,
      agent: this.agent,
      timeout: {
        deadline: 60000,
        response: 60000,
      },
    };

    const uploadUrl = `${uploadUrlString}&comp=block&blockid=${this.getBlockId(blockId)}`;
    await request(requestContext, uploadUrl, options);
  }

  /**
   * Upload a file to AzureBlobStorage for iModelHub.
   * @param requestContext The client request context
   * @param uploadUrl URL to upload the file to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */
  public async uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: ProgressCallback): Promise<void> {
    const safeToLogUrl = MobileFileHandler.getSafeUrlForLogging(uploadUrlString);
    requestContext.enter();
    Logger.logTrace(loggerCategory, `Uploading file to ${safeToLogUrl}`);
    ArgumentCheck.defined("uploadUrlString", uploadUrlString);
    ArgumentCheck.defined("uploadFromPathname", uploadFromPathname);

    const fileSize = this.getFileSize(uploadFromPathname);
    const file = fs.openSync(uploadFromPathname, "r");
    const chunkSize = 4 * 1024 * 1024;

    try {
      let blockList = '<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>';
      let i = 0;
      const callback: ProgressCallback = (progress: ProgressInfo) => {
        const uploaded = i * chunkSize + progress.loaded;
        progressCallback!({ loaded: uploaded, percent: uploaded / fileSize, total: fileSize });
      };
      for (; i * chunkSize < fileSize; ++i) {
        await this.uploadChunk(requestContext, uploadUrlString, file, i, progressCallback ? callback : undefined);
        blockList += `<Latest>${this.getBlockId(i)}</Latest>`;
      }
      blockList += "</BlockList>";

      const options: RequestOptions = {
        method: "PUT",
        headers: {
          "Content-Type": "application/xml", // eslint-disable-line @typescript-eslint/naming-convention
          "Content-Length": blockList.length, // eslint-disable-line @typescript-eslint/naming-convention
        },
        body: blockList,
        agent: this.agent,
        timeout: {
          response: 5000,
          deadline: 60000,
        },
      };

      const uploadUrl = `${uploadUrlString}&comp=blocklist`;
      await request(requestContext, uploadUrl, options);
    } finally {
      fs.closeSync(file);
    }
  }

  /**
   * Get size of a file.
   * @param filePath Path of the file.
   * @returns Size of the file.
   */
  public getFileSize(filePath: string): number {
    return fs.statSync(filePath).size;
  }

  /**
   * Check if path is a directory.
   * @param filePath Path of the file.
   * @returns True if path is directory.
   */
  public isDirectory(filePath: string): boolean {
    return fs.statSync(filePath).isDirectory();
  }

  /**
   * Check if path exists.
   * @param filePath Path of the file.
   * @returns True if path exists.
   */
  public exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Deletes file.
   * @param filePath Path of the file.
   */
  public unlink(filePath: string): void {
    fs.unlinkSync(filePath);
  }

  /**
   * Get file name from the path.
   * @param filePath Path of the file.
   * @returns File name.
   */
  public basename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Join multiple strings into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return path.join(...paths);
  }
}

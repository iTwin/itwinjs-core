/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHub
 */

import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import { AccessToken, BentleyError, GetMetaDataFunction, Logger } from "@itwin/core-bentley";
import { ProgressCallback, ProgressInfo, request, RequestOptions } from "./Request";
import { MobileHost } from "./MobileHost";

const loggerCategory: string = "mobile.filehandler";

const defined = (argumentName: string, argument?: any, allowEmpty: boolean = false) => {
  if (argument === undefined || argument === null || (argument === "" && !allowEmpty))
    throw Error(`Argument ${argumentName} is null or undefined`);
};

/** Interface to cancel a request
  * @beta
  */
export interface CancelRequest {
  /** Returns true if cancel request was acknowledged */
  cancel: () => boolean;
}

/** Error thrown when user cancelled operation
  * @internal
  */
export class UserCancelledError extends BentleyError {
  public constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = "User cancelled operation";
  }
}

/** Error thrown fail to download file. ErrorNumber will correspond to HTTP error code.
  * @internal
  */
export class DownloadFailed extends BentleyError {
  public constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = "Fail to download file";
  }
}

/** Error thrown when sas-url provided for download has expired
  * @internal
  */
export class SasUrlExpired extends BentleyError {
  public constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = "SaS url has expired";
  }
}

/**
 * Provides methods to work with the file system and azure storage. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 * @internal
 */
export class MobileFileHandler {
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
    const safeToLogDownloadUrl = new URL(url);
    if (safeToLogDownloadUrl.search && safeToLogDownloadUrl.search.length > 0)
      safeToLogDownloadUrl.search = "...";
    if (safeToLogDownloadUrl.hash && safeToLogDownloadUrl.hash.length > 0)
      safeToLogDownloadUrl.hash = "...";
    return safeToLogDownloadUrl.toString();
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
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */
  public async downloadFile(_accessToken: AccessToken, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    // strip search and hash parameters from download Url for logging purpose
    const safeToLogUrl = MobileFileHandler.getSafeUrlForLogging(downloadUrl);
    Logger.logInfo(loggerCategory, `Downloading file from ${safeToLogUrl}`);

    defined("downloadUrl", downloadUrl);
    defined("downloadToPathname", downloadToPathname);
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
    Logger.logTrace(loggerCategory, `Downloaded file from ${safeToLogUrl}`);
  }
  /** Get encoded block id from its number. */
  private getBlockId(blockId: number) {
    return Buffer.from(blockId.toString(16).padStart(5, "0")).toString("base64");
  }

  private async uploadChunk(_accessToken: AccessToken, uploadUrlString: string, fileDescriptor: number, blockId: number, callback?: ProgressCallback) {
    const chunkSize = 4 * 1024 * 1024;
    let buffer = Buffer.alloc(chunkSize);
    const bytesRead = fs.readSync(fileDescriptor, buffer, 0, chunkSize, chunkSize * blockId);
    buffer = buffer.subarray(0, bytesRead);

    const options: RequestOptions = {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": "application/octet-stream",
        "Content-Length": buffer.length,
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
    await request(uploadUrl, options);
  }

  /**
   * Upload a file to AzureBlobStorage for iModelHub.
   * @param uploadUrl URL to upload the file to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */
  public async uploadFile(accessToken: AccessToken, uploadUrlString: string, uploadFromPathname: string, progressCallback?: ProgressCallback): Promise<void> {
    const safeToLogUrl = MobileFileHandler.getSafeUrlForLogging(uploadUrlString);
    Logger.logTrace(loggerCategory, `Uploading file to ${safeToLogUrl}`);
    defined("uploadUrlString", uploadUrlString);
    defined("uploadFromPathname", uploadFromPathname);

    const fileSize = this.getFileSize(uploadFromPathname);
    const file = fs.openSync(uploadFromPathname, "r");
    const chunkSize = 4 * 1024 * 1024;

    try {
      let blockList = '<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>';
      let i = 0;
      const callback: ProgressCallback = (progress: ProgressInfo) => {
        const uploaded = i * chunkSize + progress.loaded;
        if (progressCallback)
          progressCallback({ loaded: uploaded, percent: uploaded / fileSize, total: fileSize });
      };
      for (; i * chunkSize < fileSize; ++i) {
        await this.uploadChunk(accessToken, uploadUrlString, file, i, progressCallback ? callback : undefined);
        blockList += `<Latest>${this.getBlockId(i)}</Latest>`;
      }
      blockList += "</BlockList>";

      const options: RequestOptions = {
        method: "PUT",
        headers: {
          "Content-Type": "application/xml",
          "Content-Length": blockList.length,
        },
        body: blockList,
        agent: this.agent,
        timeout: {
          response: 5000,
          deadline: 60000,
        },
      };

      const uploadUrl = `${uploadUrlString}&comp=blocklist`;
      await request(uploadUrl, options);
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

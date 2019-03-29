/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */
import { Logger } from "@bentley/bentleyjs-core";
import { ArgumentCheck, AuthorizedClientRequestContext, FileHandler, request, RequestOptions } from "@bentley/imodeljs-clients";
import * as fs from "fs";
import * as path from "path";
import { LoggerCategory } from "../LoggerCategory";

const loggerCategory: string = LoggerCategory.IModelHub;

/**
 * Provides methods to work with the file system and azure storage. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 */
export class IOSAzureFileHandler implements FileHandler {
  /** @hidden */
  public agent: any;

  /**
   * Constructor for AzureFileHandler.
   * @param threshold Minimum chunk size in bytes for a single file write.
   */
  constructor() {
  }
  private static get _isMobile() {
    return typeof (self) !== "undefined" && (self as any).imodeljsMobile;
  }
  /** Create a directory, recursively setting up the path as necessary. */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    IOSAzureFileHandler.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }
  /**
   * Download a file from AzureBlobStorage for the iModelHub. Creates the directory containing the file if necessary. If there is an error in the operation, incomplete file is deleted from disk.
   * @param requestContext The client request context
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */

  public async downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string): Promise<void> {
    requestContext.enter();
    if (!IOSAzureFileHandler._isMobile) {
      Logger.logError(loggerCategory, "Expecting this code to run on a mobile device");
      return Promise.reject("Expecting this code to run on a mobile device");
    }

    Logger.logInfo(loggerCategory, `Downloading file from ${downloadUrl}`);
    ArgumentCheck.defined("downloadUrl", downloadUrl);
    ArgumentCheck.defined("downloadToPathname", downloadToPathname);

    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    IOSAzureFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));
    try {
      await new Promise<void>((resolve: any, reject: any) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", downloadUrl);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject();
          }
        };
        xhr.onerror = () => {
          reject();
        };
        // iOS implementation knows about this method
        (xhr as any).downloadFile(downloadToPathname);
      });
    } catch (err) {
      requestContext.enter();
      if (fs.existsSync(downloadToPathname))
        fs.unlinkSync(downloadToPathname); // Just in case there was a partial download, delete the file
      Logger.logError(loggerCategory, `Error downloading file`);
      return Promise.reject(err);
    }
    requestContext.enter();
    Logger.logTrace(loggerCategory, `Downloaded file from ${downloadUrl}`);
  }

  /** Get encoded block id from its number. */
  private getBlockId(blockId: number) {
    return Base64.encode(blockId.toString(16).padStart(5, "0"));
  }

  private async uploadChunk(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, filePath: string, blockId: number) {
    requestContext.enter();
    const chunkSize = 4 * 1024 * 1024;
    const uploadUrl = `${uploadUrlString}&comp=block&blockid=${this.getBlockId(blockId)}`;
    return new Promise<void>((resolve: any, reject: any) => {
      const xhr = new XMLHttpRequest();
      xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.open("PUT", uploadUrl);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject();
        }
      };
      xhr.onerror = () => {
        reject();
      };
      // iOS implementation knows about this method
      (xhr as any).uploadFile(filePath, chunkSize * blockId, chunkSize);
    });
  }

  /**
   * Upload a file to AzureBlobStorage for the iModelHub.
   * @param requestContext The client request context
   * @param uploadUrl URL to upload the file to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   */
  public async uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string): Promise<void> {
    requestContext.enter();
    if (!IOSAzureFileHandler._isMobile) {
      Logger.logError(loggerCategory, "Expecting this code to run on a mobile device");
      return Promise.reject("Expecting this code to run on a mobile device");
    }

    Logger.logTrace(loggerCategory, `Uploading file to ${uploadUrlString}`);
    ArgumentCheck.defined("uploadUrlString", uploadUrlString);
    ArgumentCheck.defined("uploadFromPathname", uploadFromPathname);

    const fileSize = this.getFileSize(uploadFromPathname);
    const chunkSize = 4 * 1024 * 1024;

    let blockList = '<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>';
    let i = 0;
    for (; i * chunkSize < fileSize; ++i) {
      await this.uploadChunk(requestContext, uploadUrlString, uploadFromPathname, i);
      requestContext.enter();

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
      timeout: {
        response: 5000,
        deadline: 60000,
      },
    };

    const uploadUrl = `${uploadUrlString}&comp=blocklist`;
    await request(requestContext, uploadUrl, options);
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

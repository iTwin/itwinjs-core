/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { request, RequestOptions } from "../Request";
import { IModelHubRequestError } from "./Errors";
import { Config } from "../Config";
import { Logger } from "@bentley/bentleyjs-core";
import { URL } from "url";
import * as Azure from "azure-storage";
import { FileHandler } from "./FileHandler";
import * as fs from "fs";
import * as path from "path";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Provides methods to work with the file system and azure storage.
 */
export class AzureFileHandler implements FileHandler {
  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    AzureFileHandler.makeDirectoryRecursive(path.dirname(dirPath));

    fs.mkdirSync(dirPath);
  }

  /**
   * Downloads a file from AzureBlobStorage for the iModelHub
   * Creates the directory containing the file if necessary.
   * If there is a error in the operation any incomplete file is deleted from disk.
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @throws [[RequestError]] if the file cannot be downloaded.
   * @throws [[IModelHubRequestError]] if this method is used incorrectly.
   */
  public async downloadFile(downloadUrl: string, downloadToPathname: string): Promise<void> {
    Logger.logInfo(loggingCategory, `Downloading file from ${downloadUrl}`);

    if (Config.isBrowser())
      return Promise.reject(IModelHubRequestError.browser());

    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    AzureFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));

    const writeStream: fs.WriteStream = fs.createWriteStream(downloadToPathname, {encoding: "binary"});

    const options: RequestOptions = {
      method: "GET",
      stream: writeStream,
      timeout: 600000, // 10 minutes!
    };

    try {
      await request(downloadUrl, options);
    } catch (err) {
      if (fs.existsSync(downloadToPathname))
        fs.unlinkSync(downloadToPathname); // Just in case there was a partial download, delete the file
      Logger.logError(loggingCategory, `Error downloading file`);
      return Promise.reject(err);
    }

    Logger.logTrace(loggingCategory, `Downloaded file from ${downloadUrl}`);
  }

  /**
   * Uploads a file to AzureBlobStorage for the iModelHub
   * @param uploadUrl URL to upload the fille to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @throws [[IModelHubRequestError]] if this method is used incorrectly.
   */
  public async uploadFile(uploadUrlString: string, uploadFromPathname: string): Promise<void> {
    Logger.logTrace(loggingCategory, `Uploading file to ${uploadUrlString}`);

    if (Config.isBrowser())
      return Promise.reject(IModelHubRequestError.browser());

    if (!fs.existsSync(uploadFromPathname))
      return Promise.reject(new Error("Could not find file at specified location: " + uploadFromPathname));

    const uploadUrl = new URL(uploadUrlString);
    const azureStorageHost = `${uploadUrl.protocol}//${uploadUrl.host}`;
    const azureSasToken = uploadUrl.search.substr(1); // Omit the leading "?"
    const split = uploadUrl.pathname.split(/[\/]/);
    const azureContainerId = split[1];
    const azureBlobId = split[2];

    const blobService: Azure.BlobService = Azure.createBlobServiceWithSas(azureStorageHost, azureSasToken);

    return new Promise<void>((resolve, reject) => {
      blobService.createBlockBlobFromLocalFile(azureContainerId, azureBlobId, uploadFromPathname, (error: Error): void => {
        if (error) {
          Logger.logError(loggingCategory, `Failed to upload file to ${uploadUrlString}: ${error.name} ${error.message}`);
          reject(error);
          return;
        }
        Logger.logTrace(loggingCategory, `Uploaded file to ${uploadUrlString}`);
        resolve();
      });
    });
  }

  /**
   * Gets size of a file.
   * @param filePath Path of the file.
   * @returns Size of the file.
   */
  public getFileSize(filePath: string): number {
    return fs.statSync(filePath).size;
  }

  /**
   * Checks if path exists.
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
   * Joins multiple string into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return path.join(...paths);
  }
}

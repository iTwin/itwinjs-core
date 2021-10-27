/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHub
 */

import * as fs from "fs-extra";
import * as https from "https";
import * as pathLib from "path";
import * as url from "url";
import { AccessToken, Logger } from "@itwin/core-bentley";
import { FileHandler, ProgressCallback } from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";

const loggerCategory: string = IModelHubClientLoggerCategory.FileHandlers;

/**
 * Provides methods to work with the local file system. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 * @internal
 */
export class LocalhostHandler implements FileHandler {
  public agent?: https.Agent;

  /**
   * Download a file.
   * @param downloadUrl URL to download file from.
   * @param path Path to download the file to, including file name.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async downloadFile(_accessToken: AccessToken, downloadUrl: string, path: string, fileSize?: number, progress?: ProgressCallback): Promise<void> {
    Logger.logTrace(loggerCategory, `Downloading file from '${downloadUrl}' to '${path}'.`);
    await fs.ensureDir(pathLib.dirname(path));
    await fs.copy(url.fileURLToPath(downloadUrl), path);
    if (progress) {
      const size = fileSize || this.getFileSize(path);
      progress({
        loaded: size,
        total: size,
        percent: 100,
      });
    }
  }

  /**
   * Upload a file.
   * @param uploadUrl URL to upload the file to.
   * @param path Path of the file to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async uploadFile(_accessToken: AccessToken, uploadUrlString: string, path: string, progress?: ProgressCallback): Promise<void> {
    Logger.logTrace(loggerCategory, `Uploading file '${path}' to '${uploadUrlString}'.`);
    const uploadPath = url.fileURLToPath(uploadUrlString);
    await fs.ensureDir(pathLib.dirname(uploadPath));
    await fs.copy(path, uploadPath);
    if (progress) {
      const fileSize = this.getFileSize(path);
      progress({
        loaded: fileSize,
        total: fileSize,
        percent: 100,
      });
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
    return pathLib.basename(filePath);
  }

  /**
   * Join multiple strings into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return pathLib.join(...paths);
  }
}

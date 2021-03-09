/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utils
 */
import * as fs from "fs-extra";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { URL } from "url";
import { AuthorizedClientRequestContext, CancelRequest, FileHandler, ProgressCallback } from "@bentley/itwin-client";
import { downloadFileAtomic } from "./downloadFileAtomic";

/**
 * Provides methods to upload and download files from the Internet
 * @internal
 */
export class UrlFileHandler implements FileHandler {
  public agent?: https.Agent;
  protected _uploadMethod = "POST";

  constructor() {
  }

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    UrlFileHandler.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  public async downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    requestContext.enter();
    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    UrlFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));
    return downloadFileAtomic(requestContext, downloadUrl, downloadToPathname, fileSize, progressCallback, cancelRequest);
  }

  public async uploadFile(_requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: ProgressCallback): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const uploadUrl = new URL(uploadUrlString);
      const fileSize = this.getFileSize(uploadFromPathname);
      const requestOptions = { method: this._uploadMethod, hostname: uploadUrl.hostname, port: uploadUrl.port, path: uploadUrl.pathname + uploadUrl.search };
      const callback = (response: http.IncomingMessage) => {
        if (response.statusCode === 200 || response.statusCode === 201) {
          if (progressCallback)
            progressCallback({ percent: 100, total: fileSize, loaded: fileSize });
          resolve();
        } else {
          reject(new Error(response.statusCode!.toString()));
        }
      };
      const request = uploadUrlString.startsWith("https:") ? https.request(requestOptions, callback) : http.request(requestOptions, callback);

      let bytesWritten: number = 0;
      const source = fs.createReadStream(uploadFromPathname);
      if (progressCallback) {
        source.on("data", (chunk) => {
          bytesWritten += chunk.length;
          progressCallback({ loaded: bytesWritten, total: fileSize, percent: fileSize ? bytesWritten / fileSize : 0 });
        });
      }

      source.on("error", (err) => {
        reject(err);
      });

      source.pipe(request);
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
   * Gets size of a file.
   * @param filePath Path of the file.
   * @returns Size of the file.
   */
  public isDirectory(filePath: string): boolean {
    return fs.statSync(filePath).isDirectory();
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
   * Joins multiple string into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return path.join(...paths);
  }
}

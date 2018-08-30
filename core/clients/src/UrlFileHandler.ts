/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */
import { ProgressInfo } from "./Request";
import { FileHandler } from "./FileHandler";
import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";
import { URL } from "url";

/**
 * Provides methods to upload and download files from the Internet
 */
export class UrlFileHandler implements FileHandler {
  public agent: https.Agent;

  constructor() {
  }

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    UrlFileHandler.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  public async downloadFile(downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    UrlFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));

    return new Promise<void>((resolve, reject) => {
      https.get(downloadUrl, (response) => {
        if (response.statusCode !== 200) {
          reject();
        } else {
          const target = fs.createWriteStream(downloadToPathname);
          target.on("error", (err) => {
            reject(err);
          });

          target.on("close", () => {
            if (progressCallback) {
              fileSize = fileSize || fs.statSync(downloadToPathname).size;
              progressCallback({ percent: 100, total: fileSize, loaded: fileSize });
            }
            resolve();
          });

          response.pipe(target);
        }
      });
    });
  }

  public async uploadFile(uploadUrlString: string, uploadFromPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const uploadUrl = new URL(uploadUrlString);
      const request = https.request({ method: "POST", hostname: uploadUrl.hostname, port: uploadUrl.port, path: uploadUrl.pathname }, (response) => {
        if (response.statusCode === 200) {
          if (progressCallback)
            progressCallback({ percent: 100, total: 1, loaded: 1 });
          resolve();
        } else {
          reject(new Error(response.statusCode!.toString()));
        }
      });

      const source = fs.createReadStream(uploadFromPathname);
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

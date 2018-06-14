/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ProgressInfo } from "../Request";
import { assert } from "@bentley/bentleyjs-core";
import { FileHandler } from "../FileHandler";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

/**
 * Provides methods to upload and download files from the Internet
 */
export class UrlFileHandler implements FileHandler {
  public agent: https.Agent;

  constructor() {
  }

  public async downloadFile(_downloadUrl: string, _downloadToPathname: string, _fileSize?: number,
    _progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    assert(false, "TBD");
  }

  public async uploadFile(_uploadUrlString: string, _uploadFromPathname: string, _progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    assert(false, "TBD");
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

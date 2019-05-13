/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */
import { ProgressInfo } from "./Request";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import * as https from "https";

/** Handler for file system, and upload / download. TODO: Move this to parent directory -- it is not iModelHub-specific.
 * @internal
 */
export interface FileHandler {
  agent: https.Agent;
  /**
   * Download a file.
   * @param requestContext The client request context
   * @param downloadUrl URL to download file from.
   * @param path Path to download the file to, including file name.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, path: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void>;

  /**
   * Upload a file.
   * @param requestContext The client request context
   * @param uploadUrl URL to upload the file to.
   * @param path Path of the file to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, path: string, progress?: (progress: ProgressInfo) => void): Promise<void>;

  /**
   * Get size of a file.
   * @param filePath Path of the file.
   * @returns Size of the file.
   */
  getFileSize(filePath: string): number;

  /**
   * Check if path is a directory.
   * @param filePath Path of the file.
   * @returns True if path is directory.
   */
  isDirectory(filePath: string): boolean;

  /**
   * Check if path exists.
   * @param filePath Path of the file.
   * @returns True if path exists.
   */
  exists(filePath: string): boolean;

  /**
   * Get file name from the path.
   * @param filePath Path of the file.
   * @returns File name.
   */
  basename(filePath: string): string;

  /**
   * Join multiple strings into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  join(...paths: string[]): string;
}

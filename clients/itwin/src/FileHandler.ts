/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iTwinServiceClients
 */
import * as https from "https";
import { AccessToken, BentleyError, GetMetaDataFunction } from "@itwin/core-bentley";
import { ProgressCallback } from "./Request";

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

/** Error thrown when sas-url provided for download has expired
 * @beta
 */
export class SasUrlExpired extends BentleyError {
  public constructor(errorNumber: number, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = "SaS url has expired";
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

/** Handler for file system, and upload / download. TODO: Move this to parent directory -- it is not iModelHub-specific.
 * @internal
 */
export interface FileHandler {
  agent?: https.Agent;
  /**
   * Download a file.
   * @param accessToken A valid access token string
   * @param downloadUrl URL to download file from.
   * @param path Path to download the file to, including file name.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  downloadFile(accessToken: AccessToken, downloadUrl: string, path: string, fileSize?: number, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void>;

  /**
   * Upload a file.
   * @param accessToken A valid access token string
   * @param uploadUrl URL to upload the file to.
   * @param path Path of the file to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  uploadFile(accessToken: AccessToken, uploadUrlString: string, path: string, progress?: ProgressCallback): Promise<void>;

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
   * Deletes file.
   * @param filePath Path of the file.
   */
  unlink(filePath: string): void;

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

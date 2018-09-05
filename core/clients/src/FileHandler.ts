/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */
import { ProgressInfo } from "./Request";
import * as https from "https";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Handler for file system, and upload / download. TODO: Move this to parent directory -- it is not iModelHub-specific. */
export interface FileHandler {
  /** @hidden */
  agent: https.Agent;
  /**
   * Download a file.
   * @param alctx Activity logging context
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  downloadFile(alctx: ActivityLoggingContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void>;

  /**
   * Upload a file.
   * @param alctx Activity logging context
   * @param uploadUrl URL to upload the file to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @param progressCallback Callback for tracking progress.
   */
  uploadFile(alctx: ActivityLoggingContext, uploadUrlString: string, uploadFromPathname: string, progress?: (progress: ProgressInfo) => void): Promise<void>;

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

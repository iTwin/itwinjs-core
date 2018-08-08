/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */
import { ProgressInfo } from "./Request";
import * as https from "https";

/** Handler for file system, and upload / download. TODO: Move this to parent directory -- it is not iModelHub-specific. */
export interface FileHandler {
  agent: https.Agent;
  downloadFile(downloadUrl: string, downloadToPathname: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void>;
  uploadFile(uploadUrlString: string, uploadFromPathname: string, progress?: (progress: ProgressInfo) => void): Promise<void>;
  getFileSize(filePath: string): number;
  isDirectory(filePath: string): boolean;
  exists(filePath: string): boolean;
  basename(filePath: string): string;
  join(...paths: string[]): string;
}

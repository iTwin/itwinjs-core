/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ProgressInfo } from "../Request";

/** Handler for file system, and upload / download. */
export interface FileHandler {
  downloadFile(downloadUrl: string, downloadToPathname: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void>;
  uploadFile(uploadUrlString: string, uploadFromPathname: string, progress?: (progress: ProgressInfo) => void): Promise<void>;
  getFileSize(filePath: string): number;
  exists(filePath: string): boolean;
  basename(filePath: string): string;
  join(...paths: string[]): string;
}

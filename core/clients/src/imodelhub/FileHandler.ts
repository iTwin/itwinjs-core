/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** Handler for file system, and upload / download. */
export interface FileHandler {
  downloadFile(downloadUrl: string, downloadToPathname: string): Promise<void>;
  uploadFile(uploadUrlString: string, uploadFromPathname: string): Promise<void>;
  getFileSize(filePath: string): number;
  exists(filePath: string): boolean;
  basename(filePath: string): string;
  join(...paths: string[]): string;
}

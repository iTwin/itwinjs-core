/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHub
 */

import * as fs from "fs";
import * as path from "path";
import * as urllib from "url";
import { AzCopyClient, ICopyJobInfo, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { BriefcaseStatus, Logger } from "@bentley/bentleyjs-core";
import { ArgumentCheck } from "@bentley/imodelhub-client";
import {
  AuthorizedClientRequestContext, CancelRequest, DownloadError, DownloadFailed, FileHandler, ProgressCallback, SasUrlExpired, UploadError,
  UserCancelledError,
} from "@bentley/itwin-client";
import { BackendITwinClientLoggerCategory } from "../BackendITwinClientLoggerCategory";
import { ITransferStatus, ProgressJobStatus } from "@azure-tools/azcopy-node/dist/src/Output/TransferStatus";

const loggerCategory: string = BackendITwinClientLoggerCategory.FileHandlers;

/**
 * Provides methods to work with the file system and azure storage. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 * @internal
 */
export class AzCopyFileHandler implements FileHandler {
  /** @internal */
  private static client: AzCopyClient = new AzCopyClient();
  /**
   * Constructor for AzureFileHandler.
   * @param useDownloadBuffer Should Buffering be used when downloading files. If undefined, buffering is enabled only for Azure File Shares mounted with a UNC path.
   * @param threshold Minimum chunk size in bytes for a single file write.
   */
  constructor() {
  }

  /** Create a directory, recursively setting up the path as necessary. */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;

    AzCopyFileHandler.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  private parseBlobUrl(downloadUrl: string): IRemoteSasLocation {
    const url = new URL(downloadUrl);
    const decoded = decodeURIComponent(url.pathname);
    const parts = decoded.split("/");
    if (parts[0].length === 0) {
      parts.shift();
    }
    const container = parts.shift();
    const resourceUri = `${url.origin}/${container}`;
    const sasToken = url.searchParams.toString();
    const pathName = `/${parts.join("/")}`;
    return { sasToken, resourceUri, path: pathName, useWildCard: false, type: "RemoteSas" };
  }

  private parseLocalPath(downloadFile: string): ILocalLocation {
    return { path: downloadFile, useWildCard: false, type: "Local" };
  }

  /**
   * Make url safe for logging by removing sensitive information
   * @param url input url that will be strip of search and query parameters and replace them by ... for security reason
   */
  private static getSafeUrlForLogging(url: string): string {
    const safeToLogDownloadUrl = urllib.parse(url);
    if (safeToLogDownloadUrl.search && safeToLogDownloadUrl.search.length > 0)
      safeToLogDownloadUrl.search = "...";
    if (safeToLogDownloadUrl.hash && safeToLogDownloadUrl.hash.length > 0)
      safeToLogDownloadUrl.hash = "...";
    return urllib.format(safeToLogDownloadUrl);
  }

  /**
   * Check if sas url has expired
   * @param download sas url for download
   * @param futureSeconds should be valid in future for given seconds.
   */
  public static isUrlExpired(downloadUrl: string, futureSeconds?: number): boolean {
    const sasUrl = new URL(downloadUrl);
    const se = sasUrl.searchParams.get("se");
    if (se) {
      const expiryUTC = new Date(se);
      const now = new Date();
      const currentUTC = new Date(now.toUTCString());
      if (futureSeconds) {
        currentUTC.setSeconds(futureSeconds + currentUTC.getSeconds());
      }
      return expiryUTC <= currentUTC;
    }
    return false;
  }

  /**
   * Download a file from AzureBlobStorage for iModelHub. Creates the directory containing the file if necessary. If there is an error in the operation, incomplete file is deleted from disk.
   * @param requestContext The client request context
   * @param downloadUrl URL to download file from.
   * @param downloadToPathname Pathname to download the file to.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   * @throws [[ResponseError]] if the file cannot be downloaded.
   */
  public async downloadFile(requestContext: AuthorizedClientRequestContext, downloadUrl: string, downloadToPathname: string, fileSize?: number, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    // strip search and hash parameters from download Url for logging purpose
    requestContext.enter();
    const safeToLogUrl = AzCopyFileHandler.getSafeUrlForLogging(downloadUrl);
    Logger.logInfo(loggerCategory, `Downloading file from ${safeToLogUrl}`);
    ArgumentCheck.defined("downloadUrl", downloadUrl);
    ArgumentCheck.defined("downloadToPathname", downloadToPathname);
    if (AzCopyFileHandler.isUrlExpired(downloadUrl)) {
      Logger.logError(loggerCategory, `Sas url has expired ${safeToLogUrl}`);
      throw new SasUrlExpired(403, "Download URL has expired");
    }
    if (fs.existsSync(downloadToPathname))
      fs.unlinkSync(downloadToPathname);

    AzCopyFileHandler.makeDirectoryRecursive(path.dirname(downloadToPathname));
    try {
      const sourceUri: IRemoteSasLocation = this.parseBlobUrl(downloadUrl);
      const targetUri: ILocalLocation = this.parseLocalPath(downloadToPathname);
      const jobId = await AzCopyFileHandler.client.copy(sourceUri, targetUri, { overwriteExisting: "true", recursive: false, checkLength: true });
      let signalCancel = false;

      if (cancelRequest) {
        cancelRequest.cancel = () => { signalCancel = true; return true; };
      }
      let lastProgressStatus: ITransferStatus<"Progress", ProgressJobStatus> | undefined;
      let job: ICopyJobInfo | undefined;
      do {
        await new Promise((resolve) => setTimeout(resolve, 100));
        job = await AzCopyFileHandler.client.getJobInfo(jobId);

        if (!job.canceled && signalCancel) {
          await AzCopyFileHandler.client.cancelJob(jobId);
        }

        if (progressCallback) {
          if (job.latestStatus && job.latestStatus.StatusType === "Progress") {
            lastProgressStatus = job.latestStatus;
            progressCallback({ total: job.latestStatus.TotalBytesEnumerated, loaded: job.latestStatus.TotalBytesTransferred, percent: job.latestStatus.PercentComplete });
          }
        }
      } while (!job.latestStatus || job.latestStatus.StatusType !== "EndOfJob");

      if (job.canceled || signalCancel) {
        throw new UserCancelledError(BriefcaseStatus.DownloadCancelled, "User cancelled download", Logger.logWarning);
      } else if (job.killed) {
        throw new DownloadError(BriefcaseStatus.DownloadError, "Download error", Logger.logError);
      } else if (job.errorMessage) {
        throw new DownloadError(BriefcaseStatus.DownloadError, job.errorMessage, Logger.logError);
      }

      if (progressCallback && lastProgressStatus && lastProgressStatus.TotalBytesTransferred < lastProgressStatus.TotalBytesEnumerated) {
        // fake this event to complete
        progressCallback({ total: lastProgressStatus.TotalBytesEnumerated, loaded: lastProgressStatus.TotalBytesEnumerated, percent: 100.0 });
      }
    } catch (err) {
      requestContext.enter();
      if (fs.existsSync(downloadToPathname))
        fs.unlinkSync(downloadToPathname); // Just in case there was a partial download, delete the file

      if (!(err instanceof UserCancelledError))
        Logger.logWarning(loggerCategory, `Error downloading file: ${err}`);
      throw err;
    }
    if (fileSize && fs.existsSync(downloadToPathname)) {
      if (fs.lstatSync(downloadToPathname).size !== fileSize) {
        fs.unlinkSync(downloadToPathname);
        Logger.logError(loggerCategory, `Downloaded file is of incorrect size ${safeToLogUrl}`);
        throw new DownloadFailed(403, "Download failed. Expected filesize does not match");
      }
    }
    requestContext.enter();
    Logger.logTrace(loggerCategory, `Downloaded file from ${safeToLogUrl}`);
  }

  /**
   * Upload a file to AzureBlobStorage for iModelHub.
   * @param requestContext The client request context
   * @param uploadUrl URL to upload the file to.
   * @param uploadFromPathname Pathname to upload the file from.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the arguments is undefined or empty.
   * @throws [[ResponseError]] if the file cannot be uploaded.
   */
  public async uploadFile(requestContext: AuthorizedClientRequestContext, uploadUrlString: string, uploadFromPathname: string, progressCallback?: ProgressCallback): Promise<void> {
    const safeToLogUrl = AzCopyFileHandler.getSafeUrlForLogging(uploadUrlString);
    requestContext.enter();
    Logger.logTrace(loggerCategory, `Uploading file to ${safeToLogUrl}`);
    ArgumentCheck.defined("uploadUrlString", uploadUrlString);
    ArgumentCheck.defined("uploadFromPathname", uploadFromPathname);

    const jobId = await AzCopyFileHandler.client.copy(this.parseLocalPath(uploadFromPathname), this.parseBlobUrl(uploadUrlString), { overwriteExisting: "false" });
    let progressTriggered = false;
    let job: ICopyJobInfo | undefined;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      job = await AzCopyFileHandler.client.getJobInfo(jobId);
      if (progressCallback) {
        if (job.latestStatus && job.latestStatus.StatusType === "Progress") {
          progressTriggered = true;
          progressCallback({ total: job.latestStatus.TotalBytesEnumerated, loaded: job.latestStatus.TotalBytesTransferred, percent: job.latestStatus.PercentComplete });
        }
      }
    } while (!job.latestStatus || job.latestStatus.StatusType !== "EndOfJob");

    if (job.killed) {
      throw new UploadError(BriefcaseStatus.UploadError, "Upload error", Logger.logError);
    } else if (job.canceled) {
      throw new UserCancelledError(BriefcaseStatus.UploadCancelled, "User cancelled upload", Logger.logWarning);
    } else if (job.errorMessage) {
      throw new UploadError(BriefcaseStatus.UploadError, job.errorMessage, Logger.logError);
    }
    if (progressCallback && !progressTriggered) {
      progressCallback({ total: job.latestStatus.TotalBytesEnumerated, loaded: job.latestStatus.TotalBytesTransferred, percent: job.latestStatus.PercentComplete });
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
    return path.basename(filePath);
  }

  /**
   * Join multiple strings into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return path.join(...paths);
  }
}

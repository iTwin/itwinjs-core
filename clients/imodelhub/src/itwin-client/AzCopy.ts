/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AzCopy
 */

import { execFileSync, spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as semver from "semver";

/* eslint-disable @typescript-eslint/naming-convention */

/** Integerity check constraint
 * @internal
 */
export type MD5Options = "NoCheck" | "LogOnly" | "FailIfDifferent" | "FailIfDifferentOrMissing";

/** Log level for azcopy. Default to INFO
 * @internal
 */
export type LogLevel = "INFO" | "WARNING" | "ERROR";

/** Copy option taken by 'azcopy copy' command
 * @internal
 */
export interface CopyOptions {
  blobType?: string; // defines the type of blob at the destination. This is used in case of upload / account to account copy (default "None")
  blockBlobTier?: string; // pload block blob to Azure Storage using this blob tier. (default "None")
  blockSizeMb?: number; // use this block size (specified in MiB) when uploading to/downloading from Azure Storage. Default is automatically calculated based on file size.
  checkMD5?: MD5Options; // specifies how strictly MD5 hashes should be validated when downloading. Only available when downloading  (default "FailIfDifferent")
  contentEncoding?: string; //  upload to Azure Storage using this content encoding.
  contentType?: string; // specifies content type of the file. Implies no-guess-mime-type.
  followSymLinks?: boolean; // follow symbolic links when uploading from local file system.
  logLevel?: LogLevel; // define the log verbosity for the log file, available levels: INFO(all requests/responses), WARNING(slow responses), and ERROR(only failed requests). (default "INFO")
  noGuessMimeType?: boolean; // prevents AzCopy from detecting the content-type based on the extension/content of the file.
  preserveLastModifiedTime?: boolean; // only available when destination is file system
  putMD5?: boolean; // create an MD5 hash of each file, and save the hash as the Content-MD5 property of the destination blob/file. (By default the hash is NOT created.) Only available when uploading.
  recursive?: boolean; // look into sub-directories recursively when uploading from local file system.
  overwrite?: boolean; // overwrite the conflicting files/blobs at the destination if this flag is set to true. (default true)
}

/** Allow configuring azure stack variables
 * @internal
 */
export interface Configuration {
  concurrencyValue?: number; // Overrides how many Go Routines work on transfers. By default, this number is determined based on the number of logical cores on the machine.
  logLocation?: string; // Overrides where the log files are stored, to avoid filling up a disk.
  showPerfStates?: boolean; // If set, to anything, on-screen output will include counts of chunks by state
  pacePageBlobs?: boolean; // Should throughput for page blobs automatically be adjusted to match Service limits? Default is true. Set to 'false' to disable
  defaultServiceApiVersion?: string; // Overrides the service API version so that AzCopy could accommodate custom environments such as Azure Stack.
}
/** Describe message type
 * @internal
 */
export type MessageType = "Init" | "Info" | "Progress" | "Exit" | "Error" | "Prompt";

/** Base interface for az events
 * @internal
 */
export interface MessageEventArgs {
  TimeStamp: string;
  MessageType: MessageType;
}

/** Base class for event args
 * @internal
 */
export interface StringEventArgs extends MessageEventArgs {
  MessageContent: string;
}

/** Args for azinit event
 * @internal
 */
export interface InitEventArgs extends MessageEventArgs {
  LogFileLocation: string;
  JobID: string;
}

/** Args for azprogress and azexit events
 * @internal
 */
export interface ProgressEventArgs extends MessageEventArgs {
  ErrorMsg: string;
  ActiveConnections: number;
  CompleteJobOrdered: boolean;
  JobStatus: string;
  TotalTransfers: number;
  TransfersCompleted: number;
  TransfersFailed: number;
  TransfersSkipped: number;
  BytesOverWire: number;
  TotalBytesTransferred: number;
  TotalBytesEnumerated: number;
  FailedTransfers: any[];
  SkippedTransfers?: any;
  PerfConstraint: number;
}

/** Declare typed events
 * @internal
 */
export declare interface AzCopy {
  on(event: "azinit", listener: (args: InitEventArgs) => void): this;
  on(event: "azinfo" | "azerror", listener: (args: StringEventArgs) => void): this;
  on(event: "azprogress" | "azexit", listener: (args: ProgressEventArgs) => void): this;
  on(event: "azruntimeerror", listener: (args: string) => void): this;
}

/**
 *  Wrapper to allow launch azcopy and listen to events.
 * @internal
 */
export class AzCopy extends EventEmitter {
  private static _resolvedExecPath?: string;
  private static _minimumAzCopyVersionSupported = "10.1.0";
  private static _currentAzCopyVersion?: string;
  /** Attempt to initialize azcopy utility class */
  private static init() {
    const currentVersion = this.getVersion();
    if (!semver.gte(currentVersion, AzCopy._minimumAzCopyVersionSupported))
      throw new Error(`AzCopy version ${currentVersion} must be >= ${AzCopy._minimumAzCopyVersionSupported}`);
  }
  /**
   * Constructor for AzCopy utility
   * @param config configure azure stack variables
   */
  public constructor(public config: Configuration = {}) {
    super();
  }
  /** check if azcopy has been configured and also initialize it. */
  public static get isAvailable(): boolean {
    try {
      this.init();
      return true;
    } catch {
      return false;
    }
  }

  /** Return path to azopy image if configured */
  public static get execPath(): string {
    if (!AzCopy._resolvedExecPath) {
      if (!process.env.AZCOPY_BINARY_PATH) {
        throw new Error(`AZCOPY_BINARY_PATH is not set`);
      }
      if (!fs.existsSync(process.env.AZCOPY_BINARY_PATH)) {
        throw new Error(`AzCopy binary '${process.env.AZCOPY_BINARY_PATH}' does not exist.`);
      }
      AzCopy._resolvedExecPath = process.env.AZCOPY_BINARY_PATH;
    }
    return AzCopy._resolvedExecPath;
  }

  /** Return binary version of configured azcopy */
  public static getVersion(): string {
    if (!AzCopy._currentAzCopyVersion) {
      const cmd = execFileSync(AzCopy.execPath, ["--version"], { encoding: "utf8" });
      const match = cmd.match(/[0-9]+\.[0-9]+\.[0-9]+/);
      if (match)
        AzCopy._currentAzCopyVersion = match[0];
      else
        AzCopy._currentAzCopyVersion = "";
    }
    return AzCopy._currentAzCopyVersion;
  }
  /**
   * Allow copy blob/files from and to azure storage. It can also copy between azure storage.
   * @param source Source for azcopy. For more read azcopy docs.
   * @param dest Destination for azcopy. For more read azcopy docs.
   * @param options Options for copy.
   */
  public async copy(source: string, dest: string, options?: CopyOptions): Promise<number> {
    AzCopy.init();
    const args = ["copy", `${source}`, `${dest}`, "--output-type=json"];
    if (options) {
      if (options.blobType)
        args.push(`--blob-type=${options.blobType}`);
      if (options.blockBlobTier)
        args.push(`--block-blob-tier=${options.blockBlobTier}`);
      if (options.blockSizeMb)
        args.push(`--block-size-mb=${options.blockSizeMb}`);
      if (options.checkMD5)
        args.push(`--check-md5=${options.checkMD5}`);
      if (options.contentEncoding)
        args.push(`--content-encoding=${options.contentEncoding}`);
      if (options.contentType)
        args.push(`--content-type=${options.contentType}`);
      if (options.followSymLinks)
        args.push(`--follow-symlinks=${options.followSymLinks}`);
      if (options.logLevel)
        args.push(`--log-level=${options.logLevel}`);
      if (options.noGuessMimeType)
        args.push(`--no-guess-mime-type=${options.noGuessMimeType}`);
      if (options.preserveLastModifiedTime)
        args.push(`--preserve-last-modified-time=${options.preserveLastModifiedTime}`);
      if (options.putMD5)
        args.push(`--put-md5=${options.putMD5}`);
      if (options.recursive)
        args.push(`--recursive=${options.recursive}`);
      if (options.overwrite)
        args.push(`--overwrite=${options.overwrite}`);
    }

    // Set config env
    const azenv = { ...process.env };
    if (this.config.concurrencyValue) {
      Object.defineProperty(azenv, "AZCOPY_CONCURRENCY_VALUE", { value: this.config.concurrencyValue.toString(), enumerable: true });
    }
    if (this.config.logLocation) {
      Object.defineProperty(azenv, "AZCOPY_LOG_LOCATION", { value: this.config.logLocation, enumerable: true });
    }
    if (this.config.showPerfStates) {
      Object.defineProperty(azenv, "AZCOPY_SHOW_PERF_STATES", { value: this.config.showPerfStates, enumerable: true });
    }
    if (this.config.pacePageBlobs) {
      Object.defineProperty(azenv, "AZCOPY_PACE_PAGE_BLOBS", { value: this.config.pacePageBlobs.toString(), enumerable: true });
    }
    if (this.config.defaultServiceApiVersion) {
      Object.defineProperty(azenv, "AZCOPY_DEFAULT_SERVICE_API_VERSION", { value: this.config.defaultServiceApiVersion, enumerable: true });
    }

    const enableEvents = this.listenerCount("azinit") || this.listenerCount("azinfo") || this.listenerCount("azprogress") || this.listenerCount("azexit") || this.listenerCount("azerror");
    return new Promise<number>((resolve, reject) => {
      const cmd = spawn(AzCopy.execPath, args, { cwd: process.cwd(), env: azenv, stdio: "pipe" });
      cmd.stdout.setEncoding("utf8");
      cmd.stderr.setEncoding("utf8");
      if (enableEvents) {
        cmd.stdout.on("data", (data: string) => {
          for (const m of data.split("\n")) {
            if (m.length === 0)
              continue;
            const msg = JSON.parse(m);
            const eventId = `az${(msg.MessageType as string).toLowerCase()}`;
            if (msg.MessageType === "Progress" || msg.MessageType === "Exit") {
              this.emit(eventId, { TimeStamp: msg.TimeStamp, MessageType: msg.MessageType, ...JSON.parse(msg.MessageContent) });
            } else if (msg.MessageType === "Init") {
              this.emit(eventId, { TimeStamp: msg.TimeStamp, MessageType: msg.MessageType, ...JSON.parse(msg.MessageContent) });
            } else {
              this.emit(eventId, { TimeStamp: msg.TimeStamp, MessageType: msg.MessageType, MessageContent: msg.MessageContent });
            }
          }
        });
      }
      cmd.stderr.on("data", (data: string) => {
        // runtime error
        this.emit("azruntimeerror", data);
      });
      cmd.on("exit", (code: number) => {
        resolve(code);
      });
      cmd.on("close", (code: number) => {
        resolve(code);
      });
      cmd.on("error", (code: number, _signal: string) => {
        reject(code);
      });
    });
  }
}

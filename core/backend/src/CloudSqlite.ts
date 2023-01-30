/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { mkdirSync } from "fs";
import { dirname } from "path";
import { NativeLibrary } from "@bentley/imodeljs-native";
import { BriefcaseStatus, GuidString } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

/** Types for using SQLite files stored in cloud containers.
 * @beta
 */
export namespace CloudSqlite {
  export function createCloudContainer(args: ContainerAccessProps): CloudContainer {
    return new NativeLibrary.nativeLib.CloudContainer(args);
  }
  export function createCloudCache(args: CloudSqlite.CacheProps): CloudSqlite.CloudCache {
    return new NativeLibrary.nativeLib.CloudCache(args);
  }
  export function startCloudPrefetch(container: CloudSqlite.CloudContainer, dbName: string, args?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch {
    return new NativeLibrary.nativeLib.CloudPrefetch(container, dbName, args);
  }

  /** Properties that specify how to access the account for a cloud blob-store container. */
  export interface AccountAccessProps {
    /** blob storage module: e.g. "azure", "google", "aws". May also include URI style parameters. */
    storageType: string;
    /** blob store account name, or a URI for custom domains. */
    accessName: string;
  }

  /** Properties of a CloudContainer. */
  export interface ContainerProps {
    /** the name of the container. */
    containerId: string;
    /** an alias for the container. Defaults to `containerId` */
    alias?: string;
    /** token that grants access to the container. For sas=1 `storageType`s, this is the sasToken. For sas=0, this is the account key */
    accessToken: string;
    /** if true, container is attached with write permissions, and accessToken must provide write access to the cloud container. */
    writeable?: boolean;
    /** if true, container is attached in "secure" mode (blocks are encrypted). Only supported in daemon mode. */
    secure?: boolean;
  }

  /** Returned from `CloudContainer.queryDatabase` describing one database in the container */
  export interface CachedDbProps {
    /** The total of (4Mb) blocks in the database. */
    readonly totalBlocks: number;
    /** the number of blocks of the database that have been downloaded into the CloudCache */
    readonly localBlocks: number;
    /** the number of blocks from this database that have been modified in the CloudCache and need to be uploaded. */
    readonly dirtyBlocks: number;
    /** If true, the database currently has transactions in the WAL file and may not be uploaded until they have been checkPointed. */
    readonly transactions: boolean;
    /** the state of this database. Indicates whether the database is new or deleted since last upload */
    readonly state: "" | "copied" | "deleted";
  }

  /** Properties for accessing a CloudContainer */
  export type ContainerAccessProps = AccountAccessProps & ContainerProps & {
    /** Duration for holding write lock, in seconds. After this time the write lock expires if not refreshed. Default is one hour. */
    durationSeconds?: number;
  };

  /** The name of a CloudSqlite database within a CloudContainer. */
  export interface DbNameProp {
    /** the name of the database within the CloudContainer.
     * @note names of databases within a CloudContainer are always **case sensitive** on all platforms.*/
    dbName: string;
  }

  /** Properties for accessing a database within a CloudContainer */
  export interface DbProps extends DbNameProp {
    /** the name of the local file to access the database. */
    localFileName: LocalFileName;
  }

  export type TransferDirection = "upload" | "download";
  export interface TransferProgress {
    /** a user-supplied progress function called during the transfer operation. Return a non-0 value to abort the transfer. */
    onProgress?: (loaded: number, total: number) => number;
  }

  export interface CloudHttpProps {
    /** The number of simultaneous HTTP requests.  Default is 6. */
    nRequests?: number;
  }

  export interface PrefetchProps extends CloudHttpProps {
    /** timeout between requests, in milliseconds. Default is 100. */
    timeout?: number;
    /** The number of prefetch requests to issue while there is foreground activity. Default is 3. */
    minRequests?: number;
  }

  export type TransferDbProps = DbProps & TransferProgress & CloudHttpProps;

  /** Properties for creating a CloudCache. */
  export interface CacheProps extends CloudHttpProps {
    /** full path of directory for cache to store its files. Must be on a (preferably fast) local drive, and must be empty when the cache is first created. */
    rootDir: string;
    /** name of this cache. It is possible to have more than one CloudCache in the same session. */
    name: string;
    /** maximum cache Size. Must be a number followed by either M (for megabytes) or G (for gigabytes.) Default is 1G */
    cacheSize?: string;
    /** turn on diagnostics for `curl` (outputs to stderr) */
    curlDiagnostics?: boolean;
  }

  /** Parameters used to obtain the write lock on a cloud container
   * @internal
   */
  export interface ObtainLockParams {
    /** The name of the user attempting to acquire the write lock. This name will be shown to other users while the lock is held. */
    user?: string;
    /** number of times to retry in the event the lock currently held by someone else.
     * After this number of attempts, `onFailure` is called. Default is 20.
     */
    nRetries: number;
    /** Delay between retries, in milliseconds. Default is 100. */
    retryDelayMs: number;
    /** function called if lock cannot be obtained after all retries. It is called with the name of the user currently holding the lock and
     * generally is expected that the user will be consulted whether to wait further.
     * If this function returns "stop", an exception will be thrown. Otherwise the retry cycle is restarted.
     */
    onFailure?: WriteLockBusyHandler;
  }

  /** @internal */
  export interface LockAndOpenArgs {
    /** the name to be displayed in the event of lock collisions */
    user: string;
    /** the name of the database within the container */
    dbName: string;
    /** the CloudContainer on which the operation will be performed */
    container: CloudContainer;
    /** if present, function called when the write lock is currently held by another user. */
    busyHandler?: WriteLockBusyHandler;
  }

  /** Logging categories for `CloudCache.setLogMask` */
  export enum LoggingMask {
    /** log all HTTP requests and responses */
    HTTP = 0x01,
    /** log as blocks become dirty and must be uploaded */
    DirtyBlocks = 0x02,
    /** log as blocks are added to the delete list */
    AddToDelete = 0x04,
    /** log container lifecycle events (e.g. authorization requests, disconnects, and state transitions) */
    LifecycleEvents = 0x08,
    /** Turn on all logging categories */
    All = 0xff,
    /** Disable logging */
    None = 0,
  }

  /**
   * A cache for storing data from CloudSqlite databases. This object refers to a directory on a local filesystem
   * and is used to **connect** CloudContainers so they may be accessed. The contents of the cache directory are entirely
   * controlled by CloudSqlite and should be empty when the cache is first created and never modified directly. It maintains
   * the state of the local data across sessions.
   */
  export interface CloudCache {
    /** `true` if this CloudCache is connected to a daemon process */
    get isDaemon(): boolean;
    /** The name for this CloudCache. */
    get name(): string;
    /** The root directory of this CloudCache on a local drive. */
    get rootDir(): LocalDirName;
    /** The guid for this CloudCache. Used for acquiring write lock. */
    get guid(): GuidString;
    /** Configure logging for this CloudCache.
     * @param mask A bitmask of `LoggingMask` values
     * @note this method does nothing if [[isDaemon]] is true. Daemon logging is configured when the daemon is started.
     * @note HTTP logging can be happen on multiple threads and may be buffered. To see buffered log messages, periodically call
     * `IModelHost.flushLog`
     */
    setLogMask(mask: number): void;
    /** destroy this CloudCache. All CloudContainers should be detached before calling this. */
    destroy(): void;
  }

  /** A CloudSqlite container that may be connected to a CloudCache. */
  export interface CloudContainer {
    readonly cache?: CloudCache;
    /** The ContainerId. */
    get containerId(): string;
    /** The *alias* to identify this CloudContainer in a CloudCache. Usually just the ContainerId. */
    get alias(): string;
    /** true if this CloudContainer is currently connected to a CloudCache via the `connect` method. */
    get isConnected(): boolean;
    /** true if this CloudContainer was created with the `writeable` flag (and its `accessToken` supplies write access). */
    get isWriteable(): boolean;
    /** true if this CloudContainer currently holds the write lock for its container in the cloud. */
    get hasWriteLock(): boolean;
    /** true if this CloudContainer has local changes that have not be uploaded to its container in the cloud. */
    get hasLocalChanges(): boolean;
    /** The current accessToken providing access to the cloud container */
    get accessToken(): string;
    set accessToken(val: string);
    /** Get the number of garbage blocks in this container that can be purged. */
    get garbageBlocks(): number;
    /** The block size for this CloudContainer. */
    get blockSize(): number;

    /**
     * initialize a cloud blob-store container to be used as a new Sqlite CloudContainer. This creates the manifest, and should be
     * performed on an empty container. If an existing manifest is present, it is destroyed and a new one is created (essentially emptying the container.)
     */
    initializeContainer(opts?: { checksumBlockNames?: boolean, blockSize?: number }): void;

    /**
     * Attempt to acquire the write lock for this CloudContainer. For this to succeed:
     * 1. it must be connected to a `CloudCache`
     * 2. this CloudContainer must have been constructed with `writeable: true`
     * 3. the `accessToken` must authorize write access
     * 4. no other process may be holding an unexpired write lock
     * @throws exception if any of the above conditions fail
     * @note Write locks *expire* after the duration specified in the `durationSeconds` property of the constructor argument, in case a process
     * crashes or otherwise fails to release the lock. Calling `acquireWriteLock` with the lock already held resets the lock duration from the current time,
     * so long running processes should call this method periodically to ensure their lock doesn't expire (they should also make sure their accessToken is refreshed
     * before it expires.)
     * @note on success, the manifest is polled before the promise resolves.
     * @param user  An identifier of the process/user locking the CloudContainer. In the event of a write lock
     * collision, this string will be included in the exception string of the *other* process attempting to obtain a write lock.
     */
    acquireWriteLock(user: string): void;

    /**
     * Release the write lock if it is currently held.
     * @note if there are local changes that have not been uploaded, they are automatically uploaded before the write lock is released.
     * @note if the write lock is not held, this method does nothing.
     */
    releaseWriteLock(): void;

    /**
     * Destroy any currently valid write lock from this or any other process. This is obviously very dangerous and defeats the purpose of write locking.
     * This method exists only for administrator tools to clear a failed process without waiting for the expiration period. It can also be useful for tests.
     * For this to succeed, all of the conditions of `acquireWriteLock` must be true other than #4.
     */
    clearWriteLock(): void;

    /**
     * Abandon any local changes in this container. If the write lock is currently held, it is released.
     * This function fails with BE_SQLITE_BUSY if one or more clients have open read or write transactions
     * on any database in the container.
     */
    abandonChanges(): void;

    /**
     * Connect this CloudContainer to a CloudCache for reading or writing its manifest, write lock, and databases.
     * @note A CloudCache is a local directory holding copies of information from the cloud. Its content is persistent across sessions,
     * but this method must be called each session to (re)establish the connection to the cache. If the CloudCache was previously populated,
     * this method may be called and will succeed *even when offline* or without a valid `accessToken`.
     * @note all operations that access the contents of databases or the manifest require this method be called (`isConnected === true`).
     */
    connect(cache: CloudCache): void;

    /**
     * Disconnect this CloudContainer from its CloudCache. There must be no open databases from this container. Leaves the container attached to the
     * CloudCache so it is available for future sessions.
     */
    disconnect(): void;

    /**
     * Permanently Detach and Disconnect this CloudContainer from its CloudCache. There must be no open databases from this container.
     */
    detach(): void;

    /**
     * Poll cloud storage for changes from other processes. *No changes* made by other processes are visible to
     * this CloudContainer unless/until this method is called.
     * @note this is automatically called whenever the write lock is obtained to ensure all changes are against the latest version.
     */
    checkForChanges(): void;

    /**
     * Upload any changed blocks from all databases in this CloudContainer.
     * @note this is called automatically from `releaseWriteLock` before the write lock is released. It is only necessary to call this directly if you
     * wish to upload changes while the write lock is still held.
     * @see hasLocalChanges
     */
    uploadChanges(): Promise<void>;

    /**
     * Clean any unused deleted blocks from cloud storage. When a database is written, a subset of its blocks are replaced
     * by new versions, sometimes leaving the originals unused. In this case, they are not deleted immediately.
     * Instead, they are scheduled for deletion at some later time. Calling this method deletes all blocks in the cloud container
     * for which the scheduled deletion time has passed.
     * @param nSeconds Any block that was marked as unused before this number of seconds ago will be deleted. Specifying a non-zero
     * value gives a period of time for other clients to refresh their manifests and stop using the now-garbage blocks. Otherwise they may get
     * a 404 error. Default is 1 hour.
     */
    cleanDeletedBlocks(nSeconds?: number): Promise<void>;

    /**
     * Create a copy of an existing database within this CloudContainer with a new name.
     * @note CloudSqlite uses copy-on-write semantics for this operation. That is, this method merely makes a
     * new entry in the manifest with the new name that *shares* all of its blocks with the original database.
     * If either database subsequently changes, the only modified blocks are not shared.
     */
    copyDatabase(dbName: string, toAlias: string): Promise<void>;

    /** Remove a database from this CloudContainer.
     * @see cleanDeletedBlocks
     */
    deleteDatabase(dbName: string): Promise<void>;

    /** Get the list of database names in this CloudContainer.
     * @param globArg if present, filter the results with SQLite [GLOB](https://www.sqlite.org/lang_expr.html#glob) operator.
     */
    queryDatabases(globArg?: string): string[];

    /**
     * Get the status of a specific database in this CloudContainer.
     * @param dbName the name of the database of interest
     */
    queryDatabase(dbName: string): CloudSqlite.CachedDbProps | undefined;

    /**
     * Get the SHA1 hash of the content of a database.
     * @param dbName the name of the database of interest
     * @note the hash will be empty if the database does not exist
     */
    queryDatabaseHash(dbName: string): string;
  }

  /** @internal */
  export interface CloudPrefetch {
    readonly cloudContainer: CloudContainer;
    readonly dbName: string;

    /** Cancel a currently pending prefetch. The promise will be resolved immediately after this call. */
    cancel(): void;

    /**
     * Promise that is resolved when the prefetch completes or is cancelled. Await this promise to ensure that the
     * database has been fully downloaded before going offline, for example.
     * @returns a Promise that resolves to `true` if the prefetch completed and the entire database is local, or `false` if it was aborted or failed.
     * @note the promise is *not* rejected on `cancel`. Some progress may (or may not) have been made by the request.
     * @note To monitor the progress being made during prefetch, call `CloudContainer.queryDatabase` periodically.
     */
    promise: Promise<boolean>;
  }

  /** @internal */
  export async function transferDb(direction: TransferDirection, container: CloudContainer, props: TransferDbProps) {
    if (direction === "download")
      mkdirSync(dirname(props.localFileName), { recursive: true }); // make sure the directory exists before starting download

    let timer: NodeJS.Timeout | undefined;
    try {
      const transfer = new NativeLibrary.nativeLib.CloudDbTransfer(direction, container, props);
      let total = 0;
      const onProgress = props.onProgress;
      if (onProgress) {
        timer = setInterval(async () => { // set an interval timer to show progress every 250ms
          const progress = transfer.getProgress();
          total = progress.total;
          if (onProgress(progress.loaded, progress.total))
            transfer.cancelTransfer();
        }, 250);
      }
      await transfer.promise;
      onProgress?.(total, total); // make sure we call progress func one last time when download completes
    } catch (err: any) {
      if (err.message === "cancelled")
        err.errorNumber = BriefcaseStatus.DownloadCancelled;

      throw err;
    } finally {
      if (timer)
        clearInterval(timer);
    }
  }

  /** Upload a database into a CloudContainer
    * @param container the CloudContainer holding the database. Must be connected.
    * @param props the properties that describe the database to be downloaded, plus optionally an `onProgress` function.
    * @note this function requires that the write lock be held on the container
    */
  export async function uploadDb(container: CloudContainer, props: TransferDbProps): Promise<void> {
    await transferDb("upload", container, props);
    container.checkForChanges(); // re-read the manifest so the database is available locally.
  }

  /** Download a database from a CloudContainer
    * @param container the CloudContainer holding the database. Must be connected.
    * @param props the properties that describe the database to be downloaded, plus optionally an `onProgress` function.
    * @returns a Promise that is resolved when the download completes.
    * @note the download is "restartable." If the transfer is aborted and then re-requested, it will continue from where
    * it left off rather than re-downloading the entire file.
    */
  export async function downloadDb(container: CloudContainer, props: TransferDbProps): Promise<void> {
    await transferDb("download", container, props);
  }

  /** Optional method to be called when an attempt to acquire the write lock fails because another user currently holds it.
    * @param lockedBy The identifier supplied by the application/user that currently holds the lock.
    * @param expires a stringified Date (in local time) indicating when the lock will expire.
    * @return "stop" to give up and stop retrying. Generally, it's a good idea to wait for some time before returning.
    */
  export type WriteLockBusyHandler = (lockedBy: string, expires: string) => Promise<void | "stop">;

  /**
    * Attempt to acquire the write lock for a container, with retries.
    * If write lock is held by another user, call busyHandler if supplied. If no busyHandler, or handler returns "stop", throw. Otherwise try again.
    * @note if write lock is already held, this function does nothing.
    * @param user the name to be displayed to other users in the event they attempt to obtain the lock while it is held by us
    * @param container the CloudContainer for which the lock is to be acquired
    * @param busyHandler if present, function called when the write lock is currently held by another user.
    */
  export async function acquireWriteLock(user: string, container: CloudContainer, busyHandler?: WriteLockBusyHandler) {
    if (container.hasWriteLock)
      return;

    while (true) {
      try {
        return container.acquireWriteLock(user);
      } catch (e: any) {
        if (e.errorNumber === 5 && busyHandler && "stop" !== await busyHandler(e.lockedBy, e.expires)) // 5 === BE_SQLITE_BUSY
          continue; // busy handler wants to try again
        throw e;
      }
    }
  }

  /**
    * Perform an asynchronous write operation on a CloudContainer with the write lock held.
    * 1. if write lock is already held, call operation and return.
    * 2. attempt to acquire the write lock, with retries. Throw if unable to obtain write lock.
    * 3. perform the operation
    * 3.a if the operation throws, abandon all changes and re-throw
    * 4. release the write lock.
    * 5. return value from operation
    * @param user the name to be displayed to other users in the event they attempt to obtain the lock while it is held by us
    * @param container the CloudContainer for which the lock is to be acquired
    * @param operation an asynchronous operation performed with the write lock held.
    * @param busyHandler if present, function called when the write lock is currently held by another user.
    * @returns a Promise with the result of `operation`
    */
  export async function withWriteLock<T>(user: string, container: CloudContainer, operation: () => T, busyHandler?: WriteLockBusyHandler) {
    if (container.hasWriteLock)
      return operation();

    await acquireWriteLock(user, container, busyHandler);
    try {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const val = await operation(); // wait for work to finish or fail
      container.releaseWriteLock();
      return val;
    } catch (e) {
      container.abandonChanges();  // if operation threw, abandon all changes
      throw e;
    }
  }
}

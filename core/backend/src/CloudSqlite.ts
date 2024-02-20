/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { NativeLibrary } from "@bentley/imodeljs-native";
import {
  AccessToken, BeDuration, BriefcaseStatus, Constructor, GuidString, Logger, OpenMode, Optional, PickAsyncMethods, PickMethods, StopWatch,
} from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { BlobContainer } from "./BlobContainerService";
import { IModelHost, KnownLocations } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { RpcTrace } from "./rpc/tracing";

import type { SQLiteDb, VersionedSqliteDb } from "./SQLiteDb";

// spell:ignore logmsg httpcode daemonless cachefile cacheslots ddthh

/**
 * Types for accessing SQLite databases stored in cloud containers.
 * @beta
 */
export namespace CloudSqlite {

  const logInfo = (msg: string) => Logger.logInfo("CloudSqlite", msg);
  const logError = (msg: string) => Logger.logError("CloudSqlite", msg);

  export type RequestTokenArgs = Optional<BlobContainer.RequestTokenProps, "userToken">;
  /**
   * Request a new AccessToken for a cloud container using the [[BlobContainer]] service.
   * If the service is unavailable or returns an error, an empty token is returned.
   */
  export async function requestToken(args: RequestTokenArgs): Promise<AccessToken> {
    // allow the userToken to be supplied via Rpc. If not supplied, or blank, use the backend's accessToken.
    const userToken = args.userToken ? args.userToken : (await IModelHost.getAccessToken());
    const response = await BlobContainer.service?.requestToken({ ...args, userToken });
    return response?.token ?? "";
  }

  interface CloudContainerInternal extends CloudContainer {
    timer?: NodeJS.Timeout;
    refreshPromise?: Promise<void>;
    lockExpireSeconds: number;
    writeLockHeldBy?: string;
  }

  /**
   * Create a new CloudContainer from a ContainerAccessProps. For non-public containers, a valid accessToken must be provided before the container
   * can be used (e.g. via [[CloudSqlite.requestToken]]).
   * @note After the container is successfully connected to a CloudCache, it will begin auto-refreshing its accessToken every `tokenRefreshSeconds` seconds (default is 1 hour)
   * until it is disconnected. However, if the container is public, or if `tokenRefreshSeconds` is <=0, auto-refresh is not enabled.
   */
  export function createCloudContainer(args: ContainerAccessProps & { accessLevel?: BlobContainer.RequestAccessLevel, tokenFn?: (args: RequestTokenArgs) => Promise<AccessToken> }): CloudContainer {
    const container = new NativeLibrary.nativeLib.CloudContainer(args) as CloudContainerInternal;
    const refreshSeconds = (undefined !== args.tokenRefreshSeconds) ? args.tokenRefreshSeconds : 60 * 60; // default is 1 hour
    container.lockExpireSeconds = args.lockExpireSeconds ?? 60 * 60; // default is 1 hour

    // don't refresh tokens for public containers or if refreshSeconds<=0
    if (!args.isPublic && refreshSeconds > 0) {
      const tokenProps = { baseUri: args.baseUri, containerId: args.containerId, accessLevel: args.accessLevel };
      const doRefresh = async () => {
        let newToken: AccessToken | undefined;
        const url = `[${tokenProps.baseUri}/${tokenProps.containerId}]`;
        try {
          newToken = await (args.tokenFn ?? CloudSqlite.requestToken)(tokenProps);
          logInfo(`Refreshed token for container ${url}`);
        } catch (err: any) {
          logError(`Error refreshing token for container ${url}: ${err.message}`);
        }
        container.accessToken = newToken ?? "";
      };
      const tokenRefreshFn = () => {
        container.timer = setTimeout(async () => {
          container.refreshPromise = doRefresh(); // this promise is stored on the container so it can be awaited in tests
          await container.refreshPromise;
          container.refreshPromise = undefined;
          tokenRefreshFn(); // schedule next refresh
        }, refreshSeconds * 1000);
      };
      container.onConnected = tokenRefreshFn; // schedule the first refresh when the container is connected
      container.onDisconnect = () => { // clear the refresh timer when the container is disconnected
        if (container.timer !== undefined) {
          clearTimeout(container.timer);
          container.timer = undefined;
        }
      };
    }
    return container;
  }

  /** Begin prefetching all blocks for a database in a CloudContainer in the background. */
  export function startCloudPrefetch(container: CloudContainer, dbName: string, args?: PrefetchProps): CloudPrefetch {
    return new NativeLibrary.nativeLib.CloudPrefetch(container, dbName, args);
  }
  export interface ContainerProps {
    /** The type of storage provider. */
    storageType: "azure" | "google";
    /** The base URI for the container. */
    baseUri: string;
    /** The name of the container. */
    containerId: string;
    /** true if the container is public (doesn't require authorization) */
    isPublic?: boolean;
  }

  /** Properties to access a CloudContainer. */
  export interface ContainerAccessProps extends ContainerProps {
    /** an alias for the container. Defaults to `containerId` */
    alias?: string;
    /** SAS token that grants access to the container. */
    accessToken: string;
    /** if true, container is allowed to request the write lock. */
    writeable?: boolean;
    /** if true, container is attached in "secure" mode (blocks are encrypted). Only supported in daemon mode. */
    secure?: boolean;
    /** string attached to log messages from CloudSQLite. This is most useful for identifying usage from daemon mode. */
    logId?: string;
    /** Duration for holding write lock, in seconds. After this time the write lock expires if not refreshed. Default is one hour. */
    lockExpireSeconds?: number;
    /** number of seconds between auto-refresh of access token. If <=0 no auto-refresh. Default is 1 hour (60*60) */
    tokenRefreshSeconds?: number;
  }

  /** Returned from `CloudContainer.queryDatabase` describing one database in the container */
  export interface CachedDbProps {
    /** The total number of blocks in the database. */
    readonly totalBlocks: number;
    /** the number of blocks of the database that have been downloaded into the CloudCache */
    readonly localBlocks: number;
    /** the number of blocks from this database that have been modified in the CloudCache and need to be uploaded. */
    readonly dirtyBlocks: number;
    /** If true, the database currently has transactions in the WAL file and may not be uploaded until they have been checkPointed. */
    readonly transactions: boolean;
    /** the state of this database. Indicates whether the database is new or deleted since last upload */
    readonly state: "" | "copied" | "deleted";
    /** current number of clients that have this database open. */
    readonly nClient: number;
    /** current number of ongoing prefetches on this database. */
    readonly nPrefetch: number;
  }

  /** Filter options passed to CloudContainer.queryHttpLog
   *  @internal
   */
  export interface BcvHttpLogFilterOptions {
    /** only return rows whose ID is >= the provided id */
    startFromId?: number;
    /** only return rows whose endTime is null OR >= the provided endTime. */
    finishedAtOrAfterTime?: string;
    /** only return rows with a non-null end_time. */
    showOnlyFinished?: boolean;
  }

  /** Returned from 'CloudContainer.queryHttpLog' describing a row in the bcv_http_log table.
   *  @internal
   */
  export interface BcvHttpLog {
    /** Unique, monotonically increasing id value */
    readonly id: number;
    /** Time request was made, as iso-8601 */
    readonly startTime: string;
    /** Time reply received, as iso-8601 (may be undefined) */
    readonly endTime: string | undefined;
    /** "PUT", "GET", etc. */
    readonly method: string;
    /** LogId of client that caused this request. Will be "prefetch" for prefetch requests. */
    readonly logId: string;
    /** Log message associated with request */
    readonly logmsg: string;
    /** URI of request */
    readonly uri: string;
    /** HTTP response code (e.g. 200) */
    readonly httpcode: number;
  }

  /** Filter options passed to 'CloudContainer.queryBcvStats'
   *  @internal
  */
  interface BcvStatsFilterOptions {
    /** if true, adds activeClients, totalClients, ongoingPrefetches, and attachedContainers to the result. */
    addClientInformation?: boolean;
  }

  /** Returned from 'CloudContainer.queryBcvStats' describing the rows in the bcv_stat table.
   *  Also gathers additional statistics using the other virtual tables bcv_container, bcv_database such as totalClients, ongoingPrefetches, activeClients and attachedContainers.
   *  @internal
   */
  export interface BcvStats {
    /** The total number of cache slots that are currently in use or 'locked' by ongoing client read transactions. In daemonless mode, this value is always 0.
     *  A locked cache slot implies that it is not eligible for eviction in the event of a full cachefile.
    */
    readonly lockedCacheslots: number;
    /** The current number of slots with data in them in the cache. */
    readonly populatedCacheslots: number;
    /** The configured size of the cache, in number of slots. */
    readonly totalCacheslots: number;
    /** The total number of clients opened on this cache */
    readonly totalClients?: number;
    /** The total number of ongoing prefetches on this cache */
    readonly ongoingPrefetches?: number;
    /** The total number of active clients on this cache. An active client is one which has an open read txn. */
    readonly activeClients?: number;
    /** The total number of attached containers on this cache. */
    readonly attachedContainers?: number;
  }

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
    /** name of this cache. It is possible to have more than one CloudCache in the same session, but each must have a unique name. */
    name: string;
    /** maximum cache Size. Must be a number followed by either M (for megabytes) or G (for gigabytes.) Default is 1G */
    cacheSize?: string;
    /** turn on diagnostics for `curl` (outputs to stderr) */
    curlDiagnostics?: boolean;
  }

  /** Parameters used to obtain the write lock on a cloud container */
  export interface ObtainLockParams {
    /** a string that identifies me to others if I hold the lock while they attempt to acquire it. */
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
  export interface LockAndOpenArgs extends SQLiteDb.WithOpenDbArgs {
    /** a string that identifies me to others if I hold the lock while they attempt to acquire it. */
    user: string;
    /** the name of the database within the container */
    dbName: string;
    /** the CloudContainer on which the operation will be performed */
    container: CloudContainer;
    /** if present, function called when the write lock is currently held by another user. */
    busyHandler?: WriteLockBusyHandler;
    /** if present, open mode for Db. Default is ReadWrite */
    openMode?: OpenMode;
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
   * A local cache for storing data downloaded from many CloudSqlite databases. This object refers to a directory on the local filesystem
   * and is used to **connect** CloudContainers so they may be accessed. It maintains the state of the local copy of
   * the downloaded data from SQLiteDbs in CloudContainers across sessions.
   *
   * Notes:
   * - CloudCaches have a name, used internally by CloudSqlite, that must be unique. CloudCaches are created and maintained via [[CloudCaches.getCache]].
   * - All CloudContainers connected to a given CloudCache must have the same block size, as determined by the first CloudContainer connected.
   * - they have a maximum size that limits the amount of disk space they can consume. When the maximum size of a CloudCache is reached,
   * the least recently used blocks are removed to make room for new blocks.
   * - CloudCaches may only be used by a single process at a time. An exception is thrown if you attempt to access a CloudCache from a
   * second process if it is already in use by another process. Note: for a readonly CloudCache, a "daemon" process can be used to
   * share a CloudCache across processes. See its documentation for details.
   * - Generally, it is expected that there only be a few CloudCaches and they be shared by all applications. Each CloudCache can consume
   * its maximum disk space, so controlling system-wide disk usage is complicated. The only reason to make a new CloudCache is either
   * for containers with a different block size, or to purposely control local disk space usage for a specific set of containers.
   * - The contents of the cache directory are entirely controlled by CloudSqlite and should be empty when the cache is
   * first created and never modified directly thereafter.
   */
  export interface CloudCache {
    /** `true` if this CloudCache is connected to a daemon process */
    get isDaemon(): boolean;
    /** The name for this CloudCache. */
    get name(): string;
    /** The root directory of this CloudCache on a local drive. */
    get rootDir(): LocalDirName;
    /** A guid for this CloudCache. It is assigned when the CloudCache is first created and used for acquiring write locks. */
    get guid(): GuidString;
    /** Configure logging for this CloudCache.
     * @param mask A bitmask of `LoggingMask` values
     * @note this method does nothing if [[isDaemon]] is true. Daemon logging is configured when the daemon is started.
     * @note HTTP logging can be happen on multiple threads and may be buffered. To see buffered log messages, periodically call
     * `[[IModelHost.flushLog]]
     */
    setLogMask(mask: number): void;
    /**
     * destroy this CloudCache to end this session. All currently connected CloudContainers are disconnected first.
     * @note this does *not* delete the local directory. Its contents are maintained so it can be used in future sessions.
     * @note this function is automatically called on [[IModelHost.shutdown]], so it is only called directly for tests.
     * @internal
     */
    destroy(): void;
  }

  /**
   * A CloudSqlite container that may be connected to a CloudCache. A CloudContainer maps a container in a cloud blob-storage
   * account to a local cache, so that the contents of a database in the container may be accessed as if it were a local file.
   *
   * Notes:
   * - all methods and accessors of this interface (other than `initializeContainer`) require that the `connect` method be successfully called first.
   * Otherwise they will throw an exception or return meaningless values.
   * - before a SQLiteDb in a container may be opened for write access, the container's write lock must be held (see [[acquireWriteLock]].)
   * - a single CloudContainer may hold more than one SQLiteDb, but often they are 1:1.
   * - the write lock is per-Container, not per-SQLiteDb (which is the reason they are often 1:1)
   * - the accessToken (a SAS key) member provides time limited, restricted, access to the container. It must be refreshed before it expires.
   * - when a CloudContainer is created, it may either be readonly or writeable. If a container is never meant to be used for writes,
   * it is slightly more efficient to indicate that by passing `writeable: false`
   */
  export interface CloudContainer {
    onConnect?: (container: CloudContainer, cache: CloudCache) => void;
    onConnected?: (container: CloudContainer) => void;
    onDisconnect?: (container: CloudContainer, detach: boolean) => void;
    onDisconnected?: (container: CloudContainer, detach: boolean) => void;

    readonly cache?: CloudCache;
    /** the baseUri of this container */
    get baseUri(): string;
    /** the storageType of this container */
    get storageType(): string;
    /** The ContainerId within a storage account. */
    get containerId(): string;
    /** The *alias* to identify this CloudContainer in a CloudCache. Usually just the ContainerId. */
    get alias(): string;
    /** The logId. */
    get logId(): string;
    /** The time that the write lock expires. Of the form 'YYYY-MM-DDTHH:MM:SS.000Z' in UTC.
     *  Returns empty string if write lock is not held.
     */
    get writeLockExpires(): string;
    /** true if this CloudContainer is currently connected to a CloudCache via the `connect` method. */
    get isConnected(): boolean;
    /** true if this CloudContainer was created with the `writeable` flag (and its `accessToken` supplies write access). */
    get isWriteable(): boolean;
    /** true if this container is public (doesn't require authorization ). */
    get isPublic(): boolean;
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
     * initialize a cloud blob-store container to be used as a new CloudContainer. This creates the container's manifest of its contents, and should be
     * performed on an empty container. If an existing manifest is present, it is destroyed and a new one is created (essentially emptying the container.)
     */
    initializeContainer(args: { checksumBlockNames?: boolean, blockSize: number }): void;

    /**
     * Connect this CloudContainer to a CloudCache for accessing and/or modifying its contents.
     * @note A CloudCache is a local directory holding copies of information from the cloud. It is persistent across sessions,
     * but this method must be called each session to (re)establish the connection to the CloudCache. If the CloudCache was previously populated,
     * this method may be called and will succeed *even when offline* or without a valid `accessToken`.
     */
    connect(cache: CloudCache): void;

    /**
     * Attempt to acquire the write lock for this CloudContainer. For this to succeed:
     * 1. it must be connected to a `CloudCache`
     * 2. this CloudContainer must have been constructed with `writeable: true`
     * 3. the `accessToken` must authorize write access
     * 4. no other process may be holding an unexpired write lock
     * @throws if any of the above conditions fail
     * @note Write locks *expire* after the duration specified in the `durationSeconds` property of the constructor argument, in case a process
     * crashes or otherwise fails to release the lock. Calling `acquireWriteLock` with the lock already held resets the lock duration from the current time,
     * so long running processes should call this method periodically to ensure their lock doesn't expire (they should also make sure their accessToken is refreshed
     * before it expires.)
     * @note on success, the container is synchronized with its contents in the cloud before the promise resolves.
     * @param user  An identifier of the process/user locking the CloudContainer. In the event of a write lock
     * collision, this string will be included in the exception string of the *other* process attempting to obtain a write lock so that users may identify who currently holds
     * the lock.
     */
    acquireWriteLock(user: string): void;

    /**
     * Release the write lock if it is currently held.
     *
     * Notes:
     *  - if there are local changes that have not been uploaded, they are automatically uploaded before the write lock is released.
     *  - if the write lock is not held, this method does nothing.
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
     * This function fails with BE_SQLITE_BUSY if there are any open read or write transactions on *any* database in the container.
     */
    abandonChanges(): void;

    /**
     * Disconnect this CloudContainer from its CloudCache. There must be no open databases from this container. Leaves the container's contents in the
     * CloudCache so it is available for future sessions.
     * @note This function does nothing (and does not throw) if the CloudContainer is not connected to a CloudCache.
     */
    disconnect(args?: {
      /** if true removes the container from the CloudCache, otherwise Leaves the container in the CloudCache so it is available for future sessions. */
      detach?: boolean;
    }): void;

    /**
     * Poll cloud storage for changes from other processes.
     *
     * Notes:
     * - no changes made by other processes are visible to this CloudContainer unless/until this method is called.
     * - note this is automatically called whenever the write lock is obtained to ensure all changes are against the latest version.
     */
    checkForChanges(): void;

    /**
     * Upload any changed blocks from the databases in this CloudContainer.
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
    queryDatabase(dbName: string): CachedDbProps | undefined;

    /**
     * query the bcv_http_log table
     * @note the bcv_http_log table contains one row for each HTTP request made by the VFS or connected daemon.
     * @note Entries are automatically removed from the table on a FIFO basis. By default entries which are 1 hr old will be removed.
     * @internal
     */
    queryHttpLog(filterOptions?: BcvHttpLogFilterOptions): CloudSqlite.BcvHttpLog[];

    /**
     * query the bcv_stat table.
     * @internal
     */
    queryBcvStats(filterOptions?: BcvStatsFilterOptions): CloudSqlite.BcvStats;

    /**
     * Get the SHA1 hash of the content of a database.
     * @param dbName the name of the database of interest
     * @note the hash will be empty if the database does not exist
     */
    queryDatabaseHash(dbName: string): string;
  }

  /**
   * Object returned by [[CloudSqlite.startCloudPrefetch]].
   * It holds a promise that is fulfilled when a Prefetch is completed. May also be used to cancel an in-progress prefetch.
   */
  export interface CloudPrefetch {
    readonly cloudContainer: CloudContainer;
    readonly dbName: string;

    /** Cancel a currently pending prefetch. The promise will be resolved immediately after this call. */
    cancel(): void;

    /**
     * Promise that is resolved when the prefetch completes or is cancelled. Await this promise to ensure that the
     * database has been fully downloaded before going offline, for example.
     *
     * Notes:
     * - resolves to `true` if the prefetch completed and the entire database is local, or `false` if it was aborted or failed.
     * - it is *not* rejected on `cancel`. Some progress may (or may not) have been made by the request.
     * - To monitor the progress being made during prefetch, call `CloudContainer.queryDatabase` periodically.
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

  /** Upload a local SQLite database file into a CloudContainer.
   * @param container the CloudContainer holding the database. Must be connected.
   * @param props the properties that describe the database to be downloaded, plus optionally an `onProgress` function.
   * @note this function requires that the write lock be held on the container
   */
  export async function uploadDb(container: CloudContainer, props: TransferDbProps): Promise<void> {
    await transferDb("upload", container, props);
    container.checkForChanges(); // re-read the manifest so the database is available locally.
  }

  /** Download a database from a CloudContainer.
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
    * @note if write lock is already held by the same user, this function will refresh the write lock's expiry time.
    * @param user the name to be displayed to other users in the event they attempt to obtain the lock while it is held by us
    * @param container the CloudContainer for which the lock is to be acquired
    * @param busyHandler if present, function called when the write lock is currently held by another user.
    * @throws if [[container]] is not connected to a CloudCache.
    */
  export async function acquireWriteLock(args: { user: string, container: CloudContainer, busyHandler?: WriteLockBusyHandler }) {
    const container = args.container as CloudContainerInternal;
    while (true) {
      try {
        if (container.hasWriteLock) {
          if (container.writeLockHeldBy === args.user) {
            return container.acquireWriteLock(args.user); // refresh the write lock's expiry time.
          }
          const err = new Error() as any; // lock held by another user within this process
          err.errorNumber = 5;
          err.lockedBy = container.writeLockHeldBy;
          err.expires = container.writeLockExpires;
          throw err;
        }
        return container.acquireWriteLock(args.user);

      } catch (e: any) {
        if (e.errorNumber === 5 && args.busyHandler && "stop" !== await args.busyHandler(e.lockedBy, e.expires)) // 5 === BE_SQLITE_BUSY
          continue; // busy handler wants to try again
        throw e;
      }
    }
  }

  /**
 * Perform an asynchronous write operation on a CloudContainer with the write lock held.
 * 1. if write lock is already held by the current user, refresh write lock's expiry time, call operation and return.
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
  export async function withWriteLock<T>(args: { user: string, container: CloudContainer, busyHandler?: WriteLockBusyHandler }, operation: () => Promise<T>): Promise<T> {
    await acquireWriteLock(args);
    const containerInternal = args.container as CloudContainerInternal;
    try {
      if (containerInternal.writeLockHeldBy === args.user) // If the user already had the write lock, then don't release it.
        return await operation();
      containerInternal.writeLockHeldBy = args.user;
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const val = await operation(); // wait for work to finish or fail
      containerInternal.releaseWriteLock();
      containerInternal.writeLockHeldBy = undefined;
      return val;
    } catch (e) {
      args.container.abandonChanges();  // if operation threw, abandon all changes
      containerInternal.writeLockHeldBy = undefined;
      throw e;
    }
  }

  /** Arguments to create or find a CloudCache */
  export interface CreateCloudCacheArg {
    /** The name of the CloudCache. CloudCache names must be unique. */
    cacheName: string;
    /** A string that specifies the maximum size of the CloudCache. It should be a number followed by "K",
     * "M" "G", or "T". Default is "10G". */
    cacheSize?: string;
    /** A local directory in temporary storage for the CloudCache. If not supplied, it is a subdirectory called `cacheName`
     * in the `CloudCaches` temporary directory.
     * If the directory does not exist, it is created. */
    cacheDir?: string;
  }

  /** The collection of currently extant `CloudCache`s, by name. */
  export class CloudCaches {
    private static readonly cloudCaches = new Map<string, CloudCache>();

    /** create a new CloudCache */
    private static makeCache(args: CreateCloudCacheArg): CloudCache {
      const cacheName = args.cacheName;
      const rootDir = args.cacheDir ?? join(IModelHost.profileDir, "CloudCaches", cacheName);
      IModelJsFs.recursiveMkDirSync(rootDir);
      const cache = new NativeLibrary.nativeLib.CloudCache({ rootDir, name: cacheName, cacheSize: args.cacheSize ?? "10G" });
      this.cloudCaches.set(cacheName, cache);
      return cache;
    }

    /** find a CloudCache by name, if it exists */
    public static findCache(cacheName: string): CloudCache | undefined {
      return this.cloudCaches.get(cacheName);
    }
    /** @internal */
    public static dropCache(cacheName: string): CloudCache | undefined {
      const cache = this.cloudCaches.get(cacheName);
      this.cloudCaches.delete(cacheName);
      return cache;
    }
    /** called by IModelHost after shutdown.
     * @internal
     */
    public static destroy() {
      this.cloudCaches.forEach((cache) => cache.destroy());
      this.cloudCaches.clear();
    }

    /** Get a CloudCache by name. If the CloudCache doesn't yet exist, it is created. */
    public static getCache(args: CreateCloudCacheArg): CloudCache {
      return this.cloudCaches.get(args.cacheName) ?? this.makeCache(args);
    }
  }

  /** Class that provides convenient local access to a SQLite database in a CloudContainer.  */
  export class DbAccess<DbType extends VersionedSqliteDb, ReadMethods = DbType, WriteMethods = DbType> {
    /** The name of the database within the cloud container. */
    public readonly dbName: string;
    /** Parameters for obtaining the write lock for this container.  */
    public readonly lockParams: ObtainLockParams = {
      user: "",
      nRetries: 20,
      retryDelayMs: 100,
    };
    protected static _cacheName = "default-64k";
    protected _container: CloudContainer;
    protected _cloudDb: DbType;
    private _writeLockProxy?: PickAsyncMethods<WriteMethods>;
    private _readerProxy?: PickMethods<ReadMethods>;
    private get _ctor() { return this.constructor as typeof DbAccess; }

    /** @internal */
    public static getCacheForClass() {
      return CloudCaches.getCache({ cacheName: this._cacheName });
    }
    private _cache?: CloudCache;
    /** only for tests
     * @internal
     */
    public setCache(cache: CloudCache) {
      this._cache = cache;
    }
    /** @internal */
    public getCache(): CloudCache {
      return this._cache ??= this._ctor.getCacheForClass();
    }
    /** @internal */
    public getCloudDb(): DbType {
      return this._cloudDb;
    }

    /**
     * The token that grants access to the cloud container for this DbAccess. If it does not grant write permissions, all
     * write operations will fail. It should be refreshed (via a timer) before it expires.
     */
    public get sasToken() { return this._container.accessToken; }
    public set sasToken(token: AccessToken) { this._container.accessToken = token; }

    /** the container for this DbAccess. It is automatically connected to the CloudCache whenever it is accessed. */
    public get container(): CloudContainer {
      const container = this._container;
      if (!container.isConnected)
        container.connect(this.getCache());
      return container;
    }

    /** Start a prefetch operation to download all the blocks for the VersionedSqliteDb */
    public startPrefetch(): CloudPrefetch {
      return startCloudPrefetch(this.container, this.dbName);
    }

    /** Create a new DbAccess for a database stored in a cloud container. */
    public constructor(args: {
      /** The Constructor for DbType. */
      dbType: Constructor<DbType>;
      /** The properties of the cloud container holding the database. */
      props: ContainerAccessProps;
      /** The name of the database within the container. */
      dbName: string;
    }) {
      this._container = createCloudContainer({ writeable: true, ...args.props });
      this._cloudDb = new args.dbType(args.props);
      this.dbName = args.dbName;
      this.lockParams.user = IModelHost.userMoniker;
    }

    /** Close the database for this DbAccess, if it is open */
    public closeDb() {
      if (this._cloudDb.isOpen)
        this._cloudDb.closeDb();
    }

    /** Close the database for this DbAccess if it is opened, and disconnect this `DbAccess from its CloudContainer. */
    public close() {
      this.closeDb();
      this._container.disconnect();
    }

    /**
     * Initialize a cloud container to hold a Cloud SQliteDb. The container must first be created via its storage supplier api (e.g. Azure, or Google).
     * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty database into the container.
     * @note this deletes any existing content in the container.
     */
    protected static async _initializeDb(args: { dbType: typeof VersionedSqliteDb, props: ContainerAccessProps, dbName: string, blockSize?: "64K" | "4M" }) {
      const container = createCloudContainer({ ...args.props, writeable: true });
      container.initializeContainer({ blockSize: args.blockSize === "4M" ? 4 * 1024 * 1024 : 64 * 1024 });
      container.connect(CloudCaches.getCache({ cacheName: this._cacheName }));
      await withWriteLock({ user: "initialize", container }, async () => {
        const localFileName = join(KnownLocations.tmpdir, "blank.db");
        args.dbType.createNewDb(localFileName);
        await transferDb("upload", container, { dbName: args.dbName, localFileName });
        unlinkSync(localFileName);
      });
      container.disconnect({ detach: true });
    }

    /**
     * Synchronize the local cache of this database with any changes by made by others.
     * @note This is called automatically whenever any write operation is performed on this DbAccess. It is only necessary to
     * call this directly if you have not changed the database recently, but wish to perform a readonly operation and want to
     * ensure it is up-to-date as of now.
     * @note There is no guarantee that the database is up-to-date even immediately after calling this method, since others
     * may be modifying it at any time.
     */
    public synchronizeWithCloud() {
      this.closeDb();
      this.container.checkForChanges();
    }

    /**
     * Ensure that the database controlled by this `DbAccess` is open for read access and return the database object.
     * @note if the database is already open (either for read or write), this method merely returns the database object.
     */
    public openForRead(): DbType {
      if (!this._cloudDb.isOpen)
        this._cloudDb.openDb(this.dbName, OpenMode.Readonly, this.container);
      return this._cloudDb;
    }

    /**
     * Perform an operation on this database with the lock held and the database opened for write
     * @param operationName the name of the operation. Only used for logging.
     * @param operation a function called with the lock held and the database open for write.
     * @returns A promise that resolves to the the return value of `operation`.
     * @see `SQLiteDb.withLockedContainer`
     * @note Most uses of `CloudSqliteDbAccess` require that the lock not be held by any operation for long. Make sure you don't
     * do any avoidable or time consuming work in your operation function.
     */
    public async withLockedDb<T>(args: { operationName: string, openMode?: OpenMode, user?: string }, operation: () => Promise<T>): Promise<T> {
      let nRetries = this.lockParams.nRetries;
      const cacheGuid = this.container.cache!.guid; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const user = args.user ?? this.lockParams.user ?? cacheGuid;
      const timer = new StopWatch(undefined, true);
      const showMs = () => `(${timer.elapsed.milliseconds}ms)`;

      const busyHandler = async (lockedBy: string, expires: string): Promise<void | "stop"> => {
        if (--nRetries <= 0) {
          if ("stop" === await this.lockParams.onFailure?.(lockedBy, expires))
            return "stop";
          nRetries = this.lockParams.nRetries;
        }
        const delay = this.lockParams.retryDelayMs;
        logInfo(`lock retry for ${cacheGuid} after ${showMs()}, waiting ${delay}`);
        await BeDuration.fromMilliseconds(delay).wait();
      };

      this.closeDb(); // in case it is currently open for read.
      let lockObtained = false;
      const operationName = args.operationName;
      try {
        return await this._cloudDb.withLockedContainer({ user, dbName: this.dbName, container: this.container, busyHandler, openMode: args.openMode }, async () => {
          lockObtained = true;
          logInfo(`lock acquired by ${cacheGuid} for ${operationName} ${showMs()}`);
          return operation();
        });
      } finally {
        if (lockObtained)
          logInfo(`lock released by ${cacheGuid} after ${operationName} ${showMs()} `);
        else
          logError(`could not obtain lock for ${cacheGuid} to perform ${operationName} ${showMs()} `);
      }
    }

    /** get a method member, by name, from the database object. Throws if not a Function. */
    private getDbMethod(methodName: string): Function {
      const fn = (this._cloudDb as any)[methodName] as Function;
      if (typeof fn !== "function")
        throw new Error(`illegal method name ${methodName}`);
      return fn;
    }

    /**
     * A Proxy Object to call a writeable async method on the cloud database controlled by this `DbAccess`.
     *
     * Whenever a method is called through this Proxy, it will:
     * - attempt to acquire the write lock on the container
     * - open the database for write
     * - call the method
     * - close the database
     * - upload changes
     * - release the write lock.
     *
     * @see [[withLockedDb]]
     */
    public get writeLocker() {
      return this._writeLockProxy ??= new Proxy(this, {
        get(access, operationName: string) {
          const fn = access.getDbMethod(operationName);
          return async (...args: any[]) => access.withLockedDb({ operationName, user: RpcTrace.currentActivity?.user }, fn.bind(access._cloudDb, ...args));
        },
      }) as PickAsyncMethods<WriteMethods>;
    }

    /**
     * A Proxy Object to call a synchronous readonly method on the database controlled by this `DbAccess`.
     * Whenever a method is called through this Proxy, it will first ensure that the database is opened for at least read access.
     */
    public get reader() {
      return this._readerProxy ??= new Proxy(this, {
        get(access, methodName: string) {
          const fn = access.getDbMethod(methodName);
          return (...args: any[]) => fn.call(access.openForRead(), ...args);
        },
      }) as PickMethods<ReadMethods>;
    }
  }
}

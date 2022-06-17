/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CloudSqlite, IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { mkdirSync } from "fs";
import { dirname } from "path";

/** Optional method to be called when an attempt to acquire the write lock fails because another user currently holds it.
 * @param lockedBy The identifier supplied by the application/user that currently holds the lock.
 * @param expires a stringified Date (in local time) indicating when the lock will expire.
 * @returns true to keep trying, false to give up. Generally, it's a good idea to wait for some time before returning.
 */
export type WriteLockBusyHandler = (lockedBy: string, expires: string) => Promise<boolean>;

/** @internal */
export class SqliteCloudContainer {
  public nativeContainer: IModelJsNative.CloudContainer;

  public constructor(props: CloudSqlite.ContainerAccessProps) {
    this.nativeContainer = new NativeLibrary.nativeLib.CloudContainer(props);
  }

  /** @internal */
  public async transferDb(direction: CloudSqlite.TransferDirection, props: CloudSqlite.TransferDbProps) {
    if (direction === "download")
      mkdirSync(dirname(props.localFileName), { recursive: true }); // make sure the directory exists before starting download

    let timer: NodeJS.Timeout | undefined;
    try {
      const transfer = new NativeLibrary.nativeLib.CloudDbTransfer(direction, this.nativeContainer, props);
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
        err.errorNumber = 131079; // BriefcaseStatus.DownloadCancelled

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
  public async uploadDb(props: CloudSqlite.TransferDbProps): Promise<void> {
    await this.transferDb("upload", props);
    this.nativeContainer.checkForChanges(); // re-read the manifest so the database is available locally.
  }

  /** Download a database from a CloudContainer
 * @param container the CloudContainer holding the database. Must be connected.
 * @param props the properties that describe the database to be downloaded, plus optionally an `onProgress` function.
 * @returns a Promise that is resolved when the download completes.
 * @note the download is "restartable." If the transfer is aborted and then re-requested, it will continue from where
 * it left off rather than re-downloading the entire file.
 */
  public async downloadDb(props: CloudSqlite.TransferDbProps): Promise<void> {
    await this.transferDb("download", props);
  }

  /**
 * Perform an asynchronous write operation on a CloudContainer with the write lock held.
 * 1. acquire the write lock if not already held
 * 1.a if write lock is held by another user, call busyHandler if supplied. If it returns true, go to 1.
 * 2. perform the operation
 * 3. if the write lock was not held before step 1., release the write lock.
 * @param user the name to be displayed in the event of lock collisions
 * @param container the CloudContainer on which the operation will be performed
 * @param operation an asynchronous operation performed with the write lock held.
 * @param busyHandler if present, function called when the write lock is currently held by another user.
 */
  public async withWriteLock(user: string, operation: () => Promise<void>, busyHandler?: WriteLockBusyHandler) {
    const cont = this.nativeContainer;
    const hadLock = cont.hasWriteLock;
    try {
      if (!hadLock) {
        while (true) {
          try {
            cont.acquireWriteLock(user);
          } catch (e: any) {
            if (e.errorNumber === 5 && busyHandler && await busyHandler(e.lockedBy, e.expires)) // 5 === BE_SQLITE_BUSY
              continue; // busy handler wants to try again
            throw e;
          }
          break;
        }
      }
      await operation(); // wait for work to finish or fail
    } finally {
      if (!hadLock && cont.hasWriteLock)
        cont.releaseWriteLock();
    }
  }
}

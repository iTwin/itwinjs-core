/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { ChildProcess } from "child_process";
import { BlobDaemon, BlobDaemonCommandArg, DaemonProps } from "@bentley/imodeljs-native";
import { BriefcaseStatus, DbResult } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
import { IModelHost } from "../IModelHost";

/** @beta */
export namespace CloudSqlite {
  export type DbName = string;

  export interface AccountProps {
    /** blob storage module: e.g. "azure", "google", "aws". May also include URI style parameters. */
    storageType: string;
    /** blob store account name. */
    accountName: string;
  }
  export interface ContainerProps {
    /** the name of the container. */
    containerId: string;
    /** SAS token that grants access to the container. */
    sasToken: string;
  }
  export type ContainerAccessProps = AccountProps & ContainerProps;
  export type Logger = (stream: NodeJS.ReadableStream) => void;
  export type ProcessProps = DaemonProps & AccountProps & { stdoutLogger?: Logger, stderrLogger?: Logger };
  export interface DbNameProp { dbName: DbName }
  export interface DbProps extends DbNameProp { localFile: LocalFileName }
  export type TransferDirection = "upload" | "download";
  export interface TransferProgress { onProgress?: (loaded: number, total: number) => number }
  export type TransferProps = ContainerAccessProps & TransferProgress;
  export type TransferDbProps = TransferProps & DbProps;
}

/** @beta */
export class CloudSqlite {
  private static cloudProcess?: ChildProcess;
  private static removeShutdownListener?: VoidFunction;
  private static killProcess() {
    if (this.cloudProcess) {
      this.cloudProcess.kill();
      this.cloudProcess = undefined;
    }
  }

  public static get isRunning() {
    return undefined !== this.cloudProcess;
  }

  public static async startProcess(props: CloudSqlite.ProcessProps) {
    if (this.isRunning)
      return;

    this.cloudProcess = BlobDaemon.start(this.toBlobAccountProps(props));

    // set up a listener to kill the containerProcess when we shut down
    this.removeShutdownListener = IModelHost.onBeforeShutdown.addOnce(() => this.killProcess());
  }

  public static stopProcess() {
    if (this.removeShutdownListener) {
      this.removeShutdownListener();
      this.removeShutdownListener = undefined;
    }
    this.killProcess();
  }

  private static toBlobAccountProps(props: CloudSqlite.AccountProps) {
    return {
      user: props.accountName,
      ...props,
    };
  }
  private static toBlobAccessProps(props: CloudSqlite.ContainerAccessProps) {
    return {
      container: props.containerId,
      auth: props.sasToken,
      ...this.toBlobAccountProps(props),
    };
  }
  public static async attach(dbAlias: CloudSqlite.DbName, props: CloudSqlite.ContainerAccessProps) {
    const args: BlobDaemonCommandArg & CloudSqlite.ProcessProps = {
      log: "meh",
      maxCacheSize: "10G",
      pollTime: 600,
      addr: "127.0.0.2",
      portNumber: 2030,
      persistAcrossSessions: true,
      lazy: false,
      dbAlias,
      // spawnOptions: {
      //   stdio: "inherit",
      // },
      ...this.toBlobAccessProps(props),
    };

    if (!this.isRunning)
      await this.startProcess(args);

    const stat = await BlobDaemon.command("attach", args);
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot attach: ${stat.errMsg}`);

    return BlobDaemon.getDbFileName(args);
  }

  public static async initializeContainer(props: CloudSqlite.ContainerAccessProps) {
    const stat = await BlobDaemon.command("create", { ...this.toBlobAccessProps(props), dbAlias: "" });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot initialize container: ${stat.errMsg}`);
  }

  public static async transferDb(direction: CloudSqlite.TransferDirection, props: CloudSqlite.TransferDbProps) {
    const transfer = new IModelHost.platform.CloudDbTransfer({ direction, ...props, dbAlias: props.dbName, ...this.toBlobAccessProps(props) });

    let timer: NodeJS.Timeout | undefined;
    try {
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
      throw (err.message === "cancelled") ? new IModelError(BriefcaseStatus.DownloadCancelled, `${direction} cancelled`) : err;
    } finally {
      if (timer)
        clearInterval(timer);
    }
  }

  public static async uploadDb(props: CloudSqlite.TransferDbProps) {
    return this.transferDb("upload", props);
  }

  public static async downloadDb(props: CloudSqlite.TransferDbProps) {
    return this.transferDb("download", props);
  }

  public static async copyDb(oldVersion: string, newVersion: string, props: CloudSqlite.ContainerAccessProps) {
    const stat = await BlobDaemon.command("copy", { dbAlias: oldVersion, toAlias: newVersion, ...this.toBlobAccessProps(props) });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot copy db: ${stat.errMsg}`);
  }

  public static async deleteDb(props: CloudSqlite.ContainerAccessProps & { dbName: string }) {
    const stat = await BlobDaemon.command("delete", { dbAlias: props.dbName, ...this.toBlobAccessProps(props) });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot delete db: ${stat.errMsg}`);
  }
}

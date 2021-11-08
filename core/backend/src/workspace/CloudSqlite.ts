/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BlobCacheProps, BlobContainerProps, BlobDaemon, BlobDaemonCommandArg, DaemonProps } from "@bentley/imodeljs-native";
import { LocalFileName } from "@itwin/core-common";
import { BeDuration, DbResult } from "@itwin/core-bentley";
import { ChildProcess } from "child_process";
import { IModelHost } from "../IModelHost";

/** @beta */
export namespace CloudSqlite {
  export type DbAlias = string;
  export type AccountProps = BlobCacheProps;
  export type ContainerProps = BlobContainerProps;
  export type AccessProps = AccountProps & ContainerProps;
  export type Logger = (stream: NodeJS.ReadableStream) => void;
  export type ProcessProps = DaemonProps & AccountProps & { stdoutLogger?: Logger, stderrLogger?: Logger };
  export interface DbProps {
    localDbName: LocalFileName;
    versionName: DbAlias;
  }
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

    this.cloudProcess = BlobDaemon.start(props);
    await BeDuration.fromSeconds(1).wait();
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

  public static async attach(dbAlias: CloudSqlite.DbAlias, props: CloudSqlite.AccessProps) {
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
      ...props,
    };

    if (!this.isRunning)
      await this.startProcess(args);

    const stat = await BlobDaemon.command("attach", args);
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot attach: ${stat.errMsg}`);

    return BlobDaemon.getDbFileName(args);
  }

  public static async create(props: CloudSqlite.AccessProps) {
    const stat = await BlobDaemon.command("create", { ...props, dbAlias: "" });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot create container: ${stat.errMsg}`);
  }

  public static async downloadDb(wsFile: CloudSqlite.DbProps, props: CloudSqlite.AccessProps) {
    const stat = await BlobDaemon.command("download", { localFile: wsFile.localDbName, dbAlias: wsFile.versionName, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot download db: ${stat.errMsg}`);
  }

  public static async copyDb(oldVersion: string, newVersion: string, props: CloudSqlite.AccessProps) {
    const stat = await BlobDaemon.command("copy", { dbAlias: oldVersion, toAlias: newVersion, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot copy db: ${stat.errMsg}`);
  }

  public static async uploadDb(wsFile: CloudSqlite.DbProps, props: CloudSqlite.AccessProps) {
    const stat = await BlobDaemon.command("upload", { localFile: wsFile.localDbName, dbAlias: wsFile.versionName, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot upload db: ${stat.errMsg}`);
  }

  public static async deleteDb(wsFile: CloudSqlite.DbProps, props: CloudSqlite.AccessProps) {
    const stat = await BlobDaemon.command("delete", { dbAlias: wsFile.versionName, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot delete db: ${stat.errMsg}`);
  }
}

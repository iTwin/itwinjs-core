/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BlobCacheProps, BlobContainerProps, BlobDaemon, BlobDaemonCommandArg, DaemonProps } from "@bentley/imodeljs-native";
import { LocalFileName } from "@itwin/core-common";
import { DbResult } from "@itwin/core-bentley";
import { ChildProcess } from "child_process";
import { IModelHost } from "../IModelHost";
import { join } from "path";
import * as readline from "readline";

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
  private static containerProcess?: ChildProcess;
  private static removeShutdownListener?: VoidFunction;
  private static killProcess() {
    if (this.containerProcess) {
      this.containerProcess.kill();
      this.containerProcess = undefined;
    }
  }

  public static get isRunning() {
    return undefined !== this.containerProcess;
  }

  public static startProcess(props: CloudSqlite.ProcessProps) {
    if (this.isRunning)
      return;

    this.containerProcess = BlobDaemon.start(props);
    props.stderrLogger?.(this.containerProcess.stderr as NodeJS.ReadableStream);
    props.stdoutLogger?.(this.containerProcess.stdout as NodeJS.ReadableStream);

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
    const logger = (stream: NodeJS.ReadableStream) => {
      readline.createInterface({ input: stream, terminal: false }).on("line", (line) => console.log(`${line}`));
    };
    const args: BlobDaemonCommandArg & CloudSqlite.ProcessProps = {
      log: "meh",
      maxCacheSize: "10G",
      pollTime: 600,
      addr: "127.0.0.2",
      portNumber: 2030,
      daemonDir: join(IModelHost.appWorkspace.containerDir, "cloud"),
      persistAcrossSessions: true,
      lazy: false,
      dbAlias,
      stderrLogger: logger,
      stdoutLogger: logger,
      ...props,
    };

    if (!this.isRunning)
      this.startProcess(args);
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
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BlobCacheProps, BlobContainerProps, BlobDaemon, DaemonProps } from "@bentley/imodeljs-native";
import { DbResult } from "@itwin/core-bentley";
import { ChildProcess } from "child_process";
import { IModelHost } from "../IModelHost";
import { WorkspaceFile } from "./Workspace";

export type ProcessProps = DaemonProps;
export type CloudAccountProps = BlobCacheProps;
export type CloudContainerProps = BlobContainerProps;
export type CloudAccessProps = CloudAccountProps & CloudContainerProps;

export class CloudContainer {
  private static containerProcess?: ChildProcess;
  private static removeShutdownListener?: VoidFunction;
  private static killProcess() {
    if (this.containerProcess) {
      this.containerProcess.kill();
      this.containerProcess = undefined;
    }
    this.removeShutdownListener = undefined;
  }

  public static get isRunning() {
    return undefined !== this.containerProcess;
  }

  public static startProcess(props: ProcessProps & CloudAccountProps) {
    if (this.isRunning)
      return;

    this.containerProcess = BlobDaemon.start(props);

    // set up a listener to kill the containerProcess when we shut down
    this.removeShutdownListener = IModelHost.onBeforeShutdown.addOnce(() => this.killProcess());
  }

  public static stopProcess() {
    if (this.removeShutdownListener)
      this.removeShutdownListener();
    this.killProcess();
  }

  public static async create(props: CloudAccessProps) {
    const stat = await BlobDaemon.command("create", { ...props, dbAlias: "" });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot create container: ${stat.errMsg}`);
  }

  public static async downloadFile(wsFile: WorkspaceFile, props: CloudAccessProps) {
    const stat = await BlobDaemon.command("download", { localFile: wsFile.localDbName, dbAlias: wsFile.versionName, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot download container: ${stat.errMsg}`);
  }

  public static async uploadFile(wsFile: WorkspaceFile, props: CloudAccessProps) {
    const stat = await BlobDaemon.command("upload", { localFile: wsFile.localDbName, dbAlias: wsFile.versionName, ...props });
    if (stat.result !== DbResult.BE_SQLITE_OK)
      throw new Error(`Cannot upload container: ${stat.errMsg}`);
  }
}

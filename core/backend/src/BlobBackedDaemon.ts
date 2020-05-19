/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { NativeLibrary } from "@bentley/imodeljs-native";
import { IModelHost } from "./IModelHost";
import { StopWatch } from "@bentley/bentleyjs-core";

// cspell:ignore blockcache blocksize cachesize polltime

/** Properties for creating a new instance of the BlockCache daemon process. */
export interface DaemonProps {
  /** blob store account name */
  account: string;
  /** name of daemon exe file. Default is "BCVDaemon.exe" */
  exeName?: string;
  /** name of cache directory, relative to temp directory. */
  cacheDir?: string;
  /** port number. Default 22002 */
  portNumber?: number;
  /** maximum cache Size. Must be a number followed by either M (for megabytes) or G (for gigabytes.) Default is 1G */
  maxCacheSize?: string;
  /** block size, in megabytes. Default is 4MB. */
  blockSizeMb?: number;
  /** How often cloud storage is polled for database changes made by other daemon processes, in seconds. Default is 60. */
  pollTime?: number;
  /** logging options */
  log?: string;
}

/** The name and key for a blob container */
export interface BlobContainerProps {
  /** the name of the container */
  name: string;
  /** SAS key that grants access to the container */
  sasKey: string;
}

export class Daemon {
  private static exeName(props: DaemonProps) {
    const dirname = path.dirname(require.resolve(NativeLibrary.libraryName));
    return path.join(dirname, props.exeName ?? "BCVDaemon.exe");
  }
  private static cacheDir(props: DaemonProps) {
    const dir = path.join(IModelHost.cacheDir, props.cacheDir ?? "imodel-daemon-cache");
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir);
    return dir;
  }
  private static accountArg(props: DaemonProps) {
    return `-account ${props.account}`;
  }
  private static containerArg(props: BlobContainerProps) {
    return `-container ${props.name}`;
  }
  private static sasArg(props: BlobContainerProps) {
    return `-sas ${props.sasKey}`;
  }

  public static start(props: DaemonProps): child_process.ChildProcess {
    const args = ["daemon", this.accountArg(props), `-directory ${this.cacheDir(props)}`, `-polltime ${props.pollTime ?? 60}`];
    if (props.portNumber)
      args.push(`-port ${props.portNumber}`);
    if (props.blockSizeMb)
      args.push(`-blocksize ${props.blockSizeMb}M`);
    if (props.maxCacheSize)
      args.push(`-cachesize ${props.maxCacheSize}`);
    if (props.log)
      args.push(`-log ${props.log}`);
    const daemon = child_process.spawn(this.exeName(props), args, {
      detached: true,
      windowsVerbatimArguments: true,
      stdio: "ignore",
      shell: true,
    });
    daemon.unref();
    return daemon;
  }

  private static runDaemon(daemonProps: DaemonProps, command: string, args: string[]) {
    console.log(`running ${this.exeName(daemonProps)} ${command} ${args}`);
    const timer = new StopWatch(command, true);
    const out = child_process.spawnSync(this.exeName(daemonProps), [command, ...args], {
      windowsVerbatimArguments: true,
    });
    console.log(out.stdout);
    console.log(out.stderr);
    console.log(`${timer.description}=${timer.elapsedSeconds}s`);
    return out;
  }
  public static createContainer(daemonProps: DaemonProps, container: BlobContainerProps) {
    return this.runDaemon(daemonProps, "create", [this.accountArg(daemonProps), container.name]);
  }
  public static upload(daemonProps: DaemonProps, container: BlobContainerProps, fileName: string, alias: string) {
    return this.runDaemon(daemonProps, "upload", [this.accountArg(daemonProps), this.containerArg(container), fileName, alias]);
  }
  public static download(daemonProps: DaemonProps, container: BlobContainerProps, alias: string, localFile: string) {
    return this.runDaemon(daemonProps, "download", [this.accountArg(daemonProps), this.containerArg(container), this.sasArg(container), alias, localFile]);
  }
  public static delete(daemonProps: DaemonProps, container: BlobContainerProps, alias: string) {
    return this.runDaemon(daemonProps, "delete", [this.accountArg(daemonProps), this.containerArg(container), alias]);
  }
  public static copyDb(daemonProps: DaemonProps, container: BlobContainerProps, from: string, to: string) {
    return this.runDaemon(daemonProps, "copy", [this.containerArg(container), from, to]);
  }
  public static attach(daemonProps: DaemonProps, container: BlobContainerProps) {
    return this.runDaemon(daemonProps, "attach", [this.cacheDir(daemonProps), `${container.name}?${container.sasKey}`]);
  }
}

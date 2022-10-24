/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector, PromiseReturnType } from "@itwin/core-bentley";
import { IpcListener, IpcSocketFrontend } from "@itwin/core-common";
import { IpcApp, NativeApp, NativeAppOpts } from "@itwin/core-frontend";
import type { IpcRenderer } from "electron";
import { dialogChannel, DialogModuleMethod } from "../common/ElectronIpcInterface";
import { ElectronRpcManager } from "../common/ElectronRpcManager";
import type { ITwinElectronApi } from "../common/ITwinElectronApi";

declare global {
  interface Window {
    itwinjs: ITwinElectronApi;
  }
}

/**
 * Frontend Ipc support for Electron apps.
 */
class ElectronIpc implements IpcSocketFrontend {
  private _api: ITwinElectronApi | IpcRenderer;
  public addListener(channelName: string, listener: IpcListener) {
    this._api.addListener(channelName, listener);
    return () => this._api.removeListener(channelName, listener);
  }
  public removeListener(channelName: string, listener: IpcListener) {
    this._api.removeListener(channelName, listener);
  }
  public send(channel: string, ...data: any[]) {
    this._api.send(channel, ...data);
  }
  public async invoke(channel: string, ...args: any[]) {
    return this._api.invoke(channel, ...args);
  }
  constructor() {
    // use the methods on window.itwinjs exposed by ElectronPreload.ts, or ipcRenderer directly if running with nodeIntegration=true (**only** for tests).
    // Note that `require("electron")` doesn't work with nodeIntegration=false - that's what it stops
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this._api = window.itwinjs ?? require("electron").ipcRenderer;
  }
}

/** @beta */
export type ElectronAppOpts = NativeAppOpts;

/**
 * Frontend of an Electron App.
 * @beta
 */
export class ElectronApp {
  private static _ipc?: ElectronIpc;
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Start the frontend of an Electron application.
   * @param opts Options for your ElectronApp
   * @note This method must only be called from the frontend of an Electron app (i.e. when [ProcessDetector.isElectronAppFrontend]($bentley) is `true`).
   */
  public static async startup(opts?: ElectronAppOpts) {
    if (!ProcessDetector.isElectronAppFrontend)
      throw new Error("Not running under Electron");
    if (!this.isValid) {
      this._ipc = new ElectronIpc();
      ElectronRpcManager.initializeFrontend(this._ipc, opts?.iModelApp?.rpcInterfaces);
    }
    await NativeApp.startup(this._ipc!, opts);
  }

  public static async shutdown() {
    this._ipc = undefined;
    await NativeApp.shutdown();
    ElectronRpcManager.terminateFrontend();
  }

  /**
   * Call an asynchronous method in the [Electron.Dialog](https://www.electronjs.org/docs/api/dialog) interface from a previously initialized ElectronFrontend.
   * @param methodName the name of the method to call
   * @param args arguments to method
   * @deprecated use [[dialogIpc]]
   */
  public static async callDialog<T extends DialogModuleMethod>(methodName: T, ...args: Parameters<Electron.Dialog[T]>) {
    return IpcApp.callIpcChannel(dialogChannel, "callDialog", methodName, ...args) as PromiseReturnType<Electron.Dialog[T]>;
  }

  /** Proxy object for calling methods of `Electron.Dialog` */
  public static dialogIpc = IpcApp.makeIpcProxy<Electron.Dialog>(dialogChannel);
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus, ProcessDetector, PromiseReturnType } from "@itwin/core-bentley";
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
export class ElectronApp extends NativeApp {
  private static _electronIpc?: ElectronIpc;
  public static override get isValid(): boolean { return super.isValid && undefined !== this._electronIpc; }

  /**
   * Start the frontend of an Electron application.
   * @param opts Options for your ElectronApp
   * @note This method must only be called from the frontend of an Electron app (i.e. when [ProcessDetector.isElectronAppFrontend]($bentley) is `true`).
   */
  public static override async startup(opts?: ElectronAppOpts | {}): Promise<void>;
  /** @internal @deprecated this overload should never be called, it will produce an error */
  public static override async startup(ipc: IpcSocketFrontend, opts?: ElectronAppOpts): Promise<void>;
  public static override async startup(inOpts?: IpcSocketFrontend | ElectronAppOpts | {}, deprecatedOptsArg?: ElectronAppOpts) {
    const opts = inOpts as Partial<ElectronAppOpts>; // type-safely tell typescript that we can check for ElectronAppOpts properties on empty objects
    if (deprecatedOptsArg)
      throw new BentleyError(BentleyStatus.ERROR, "illegal overload called, this overload exists only for compatibility with IpcApp.startup");
    if (!ProcessDetector.isElectronAppFrontend)
      throw new Error("Not running under Electron");
    if (!this.isValid) {
      this._electronIpc = new ElectronIpc();
      ElectronRpcManager.initializeFrontend(this._electronIpc, opts?.iModelApp?.rpcInterfaces);
    }
    await super.startup(this._electronIpc!, opts);
  }

  public static override async shutdown() {
    this._electronIpc = undefined;
    await super.shutdown();
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
  public static dialogIpc = IpcApp.makeIpcFunctionProxy<Electron.Dialog>(dialogChannel, "callDialog");
}

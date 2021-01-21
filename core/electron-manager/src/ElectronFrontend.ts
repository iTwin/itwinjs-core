/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { isElectronRenderer } from "@bentley/bentleyjs-core";
import { AsyncMethodsOf, FrontendIpc, IpcListener, IpcSocketFrontend, PromiseReturnType, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { ITwinElectronApi } from "./ElectronPreload";
import { ElectronRpcManager } from "./ElectronRpcManager";

/** @alpha */
export interface ElectronFrontendOptions {
  /** A list of RPC interfaces to register */
  rpcInterfaces?: RpcInterfaceDefinition[];
}

/**
 * Frontend Ipc and Rpc support for Electron apps.
 * @alpha
 */
export class ElectronFrontend implements IpcSocketFrontend {
  private _api: ITwinElectronApi;
  /** @internal */
  public addListener(channelName: string, listener: IpcListener) {
    this._api.addListener(channelName, listener);
    return () => this._api.removeListener(channelName, listener);
  }
  /** @internal */
  public removeListener(channelName: string, listener: IpcListener) {
    this._api.removeListener(channelName, listener);
  }
  /** @internal */
  public send(channel: string, ...data: any[]) {
    this._api.send(channel, ...data);
  }
  /** @internal */
  public async invoke(channel: string, ...args: any[]) {
    return this._api.invoke(channel, ...args);
  }
  private constructor(opts?: ElectronFrontendOptions) {
    // use the methods on window.itwinjs exposed by ElectronPreload.ts, or ipcRenderer directly if running with nodeIntegration=true (**only** for tests).
    // Note that `require("electron")` doesn't work with nodeIntegration=false - that's what it stops
    this._api = (window as any).itwinjs ?? require("electron").ipcRenderer;
    FrontendIpc.initialize(this);
    ElectronRpcManager.initializeFrontend(this, opts?.rpcInterfaces);
  }

  /**
   * Initialize the frontend IPC/RPC of an Electron application.
   * Call this method early in your initialization of the frontend module loaded from your call to [[ElectronBackend.openMainWindow]], before you
   * call [IModelApp.startup]($frontend).
   * @param opts Options for your ElectronFrontend
   * @note This method must (only) be called from the frontend of an Electron app (i.e. when [isElectronRenderer]($bentley) is `true`).
   */
  public static initialize(opts?: ElectronFrontendOptions) {
    if (!isElectronRenderer)
      throw new Error("Not running under Electron");

    return new ElectronFrontend(opts);
  };

  /**
   * Call an asynchronous method in the [Electron.Dialog](https://www.electronjs.org/docs/api/dialog) interface from a previously initialized ElectronFrontend.
   * @param methodName the name of the method to call
   * @param args arguments to method
   */
  public static async callDialog<T extends AsyncMethodsOf<Electron.Dialog>>(methodName: T, ...args: Parameters<Electron.Dialog[T]>) {
    return FrontendIpc.callBackend("electron-safe", "callElectron", "dialog", methodName, ...args) as PromiseReturnType<Electron.Dialog[T]>;
  }
  /**
   * Call an asynchronous method in the [Electron.shell](https://www.electronjs.org/docs/api/shell) interface from a previously initialized ElectronFrontend.
   * @param methodName the name of the method to call
   * @param args arguments to method
   */
  public static async callShell<T extends AsyncMethodsOf<Electron.Shell>>(methodName: T, ...args: Parameters<Electron.Shell[T]>) {
    return FrontendIpc.callBackend("electron-safe", "callElectron", "shell", methodName, ...args) as PromiseReturnType<Electron.Shell[T]>;
  }
  /**
   * Call an asynchronous method in the [Electron.app](https://www.electronjs.org/docs/api/app) interface from a previously initialized ElectronFrontend.
   * @param methodName the name of the method to call
   * @param args arguments to method
   */
  public static async callApp<T extends AsyncMethodsOf<Electron.App>>(methodName: T, ...args: Parameters<Electron.App[T]>) {
    return FrontendIpc.callBackend("electron-safe", "callElectron", "app", methodName, ...args) as PromiseReturnType<Electron.App[T]>;
  }
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { isElectronRenderer } from "@bentley/bentleyjs-core";
import { FrontendIpc, IpcListener, IpcSocketFrontend, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
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
  public receive(channelName: string, listener: IpcListener) {
    this._api.addListener(channelName, listener);
    return () => this._api.removeListener(channelName, listener);
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
};

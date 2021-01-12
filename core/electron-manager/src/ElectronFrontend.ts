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
  rpcInterfaces?: RpcInterfaceDefinition[];
}

class ElectronFrontendIpc implements IpcSocketFrontend {
  private _api: ITwinElectronApi;
  public receive(channelName: string, listener: IpcListener) {
    this._api.addListener(channelName, listener);
    return () => this._api.removeListener(channelName, listener);
  };
  public send(channel: string, ...data: any[]) {
    this._api.send(channel, ...data);
  }
  public async invoke(channel: string, ...args: any[]) {
    return this._api.invoke(channel, ...args);
  };
  public constructor(opts?: ElectronFrontendOptions) {
    // use the methods on window.itwinjs exposed by ElectronPreload.ts, or ipcRenderer directly if running with nodeIntegration=true (**only** for tests).
    // Note that `require("electron")` doesn't work with nodeIntegration=false - that's what it stops
    this._api = (typeof window === "undefined" ? undefined : (window as any).itwinjs as ITwinElectronApi | undefined) ?? require("electron").ipcRenderer;
    FrontendIpc.initialize(this);
    ElectronRpcManager.initializeFrontend(this, opts?.rpcInterfaces);
  }

};

/** @alpha */
export const initializeElectronFrontend = (opts?: ElectronFrontendOptions): void => {
  if (!isElectronRenderer)
    throw new Error("Not running under Electron");

  new ElectronFrontendIpc(opts);
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { isElectronRenderer } from "@bentley/bentleyjs-core";
if (!isElectronRenderer)
  throw new Error("this file may only be included by electron frontends");

import { FrontendIpc, IpcListener, IpcSocketFrontend, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { ElectronRpcManager } from "./ElectronRpcManager";
import { ipcRenderer } from "electron";

/** These methods are stored on "window.itwinjs" in ElectronPreload.js */
interface ITwinElectronApi {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  removeListener(channel: string, listener: (...args: any[]) => void): this;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
  invoke(channel: string, ...args: any[]): Promise<any>;
}
/** @beta */
export interface ElectronFrontendOptions {
  rpcInterfaces?: RpcInterfaceDefinition[];
}

// use the methods on window.itwinjs, or ipcRenderer directly if running with electronIntegration=true (for tests)
const electronIpc: ITwinElectronApi = (typeof window === "undefined" ? undefined : (window as any).itwinjs as ITwinElectronApi | undefined) ?? ipcRenderer;

/** @alpha */
export class ElectronFrontend implements IpcSocketFrontend {
  public receive(channelName: string, listener: IpcListener) {
    electronIpc.on(channelName, listener);
    return () => electronIpc.removeListener(channelName, listener);
  };
  public send(channel: string, ...data: any[]) {
    electronIpc.send(channel, ...data);
  }
  public async invoke(channel: string, ...args: any[]) {
    return electronIpc.invoke(channel, ...args);
  };
  public constructor(opts?: ElectronFrontendOptions) {
    FrontendIpc.initialize(this);
    ElectronRpcManager.initializeFrontend(this, opts?.rpcInterfaces);
  }
};

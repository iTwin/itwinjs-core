/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { isElectronRenderer } from "@bentley/bentleyjs-core";
import { FrontendIpc, IpcListener, IpcSocketFrontend, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { ElectronRpcManager } from "./ElectronRpcManager";

if (!isElectronRenderer)
  throw new Error("this file may only be included by electron frontends");

type ElectronListener = (event: any, ...args: any[]) => void;

/** These methods are stored on `window.itwinjs` in ElectronPreload.js */
interface ITwinElectronApi {
  addListener: (channel: string, listener: ElectronListener) => void;
  removeListener: (channel: string, listener: ElectronListener) => void;
  invoke: (channel: string, ...data: any[]) => Promise<any>;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
}

/** @alpha */
export interface ElectronFrontendOptions {
  rpcInterfaces?: RpcInterfaceDefinition[];
}

// use the methods on window.itwinjs, or ipcRenderer directly if running with nodeIntegration=true (**only** for tests).
// Note that `require("electron")` doesn't work with nodeIntegration=false - that's why it exists
const electronIpc: ITwinElectronApi = (typeof window === "undefined" ? undefined : (window as any).itwinjs as ITwinElectronApi | undefined) ?? require("electron").ipcRenderer;

/** @alpha */
export class ElectronFrontend implements IpcSocketFrontend {
  public receive(channelName: string, listener: IpcListener) {
    electronIpc.addListener(channelName, listener);
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ipcRenderer } from "electron";
import { isElectronRenderer } from "@bentley/bentleyjs-core";
import { IpcListener, IpcSocketFrontend } from "@bentley/imodeljs-common";

if (!isElectronRenderer)
  throw new Error("this file may only be included by electron frontends");

/** These methods are stored on "window.itwinjs" in ElectronPreload.js */
interface ITwinElectronApi {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  removeListener(channel: string, listener: (...args: any[]) => void): this;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
  invoke(channel: string, ...args: any[]): Promise<any>;
}

// use the methods on window.itwinjs, or ipcRenderer directly if running with electronIntegration=true (for tests)
const electronIpc: ITwinElectronApi = (typeof window === "undefined" ? undefined : (window as any).itwinjs as ITwinElectronApi | undefined) ?? ipcRenderer;

/** @alpha */
export const electronFrontendIpc: IpcSocketFrontend = {
  receive: (channelName: string, listener: IpcListener) => {
    electronIpc.on(channelName, listener);
    return () => electronIpc.removeListener(channelName, listener);
  },
  send: (channel: string, ...data: any[]) => {
    electronIpc.send(channel, ...data);
  },
  invoke: async (channel: string, ...args: any[]) => {
    return electronIpc.invoke(channel, ...args);
  },
};

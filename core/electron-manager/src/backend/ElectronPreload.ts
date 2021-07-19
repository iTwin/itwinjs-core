/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

/** These methods are stored on `window.itwinjs` */
export interface ITwinElectronApi {
  addListener: (channel: string, listener: ElectronListener) => void;
  removeListener: (channel: string, listener: ElectronListener) => void;
  invoke: (channel: string, ...data: any[]) => Promise<any>;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
}

/**
 * This file is loaded as an Electron preload script
 * (see https://www.electronjs.org/docs/api/browser-window#class-browserwindow) from ElectronMain.ts
 */

function checkPrefix(channel: string) {
  if (!channel.startsWith("itwin."))
    throw new Error(`illegal channel name '${channel}'`);
}

type ElectronListener = (event: IpcRendererEvent, ...args: any[]) => void;

/** the implementation of the private api between the frontend (renderer) and backend (main) iTwin.js processes in Electron. */
const frontendApi: ITwinElectronApi = {
  send(channel: string, ...data: any[]) {
    checkPrefix(channel);
    ipcRenderer.send(channel, ...data);
  },
  addListener(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    return ipcRenderer.addListener(channel, listener);
  },
  removeListener(channel: string, listener: ElectronListener) {
    return ipcRenderer.removeListener(channel, listener);
  },
  once(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    return ipcRenderer.once(channel, listener);
  },
  async invoke(channel: string, ...data: any[]): Promise<any> {
    checkPrefix(channel);
    return ipcRenderer.invoke(channel, ...data);
  },
};

// this adds the frontendApi object under the name `window.itwinjs` in the frontend Electron process.
contextBridge.exposeInMainWorld("itwinjs", frontendApi);

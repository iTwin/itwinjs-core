/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

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
const frontendApi = {
  send(channel: string, ...data: any[]) {
    checkPrefix(channel);
    ipcRenderer.send(channel, ...data);
  },
  addListener(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    return ipcRenderer.on(channel, listener);
  },
  once(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    return ipcRenderer.once(channel, listener);
  },
  async invoke(channel: string, ...data: any[]): Promise<any> {
    checkPrefix(channel);
    return ipcRenderer.invoke(channel, ...data);
  },
  sendSync(channel: string, ...args: any[]): any {
    checkPrefix(channel);
    return ipcRenderer.sendSync(channel, ...args);
  },
};

// this adds the frontendApi object under the name `window.itwinjs` in the frontend Electron process.
contextBridge.exposeInMainWorld("itwinjs", frontendApi);

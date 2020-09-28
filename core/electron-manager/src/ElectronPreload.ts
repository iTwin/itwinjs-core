/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { IModelElectronApi } from "@bentley/imodeljs-common";

/**
 * This file is loaded as an Electron preload script
 * (see https://www.electronjs.org/docs/api/browser-window#class-browserwindow) from ElectronMain.ts
 */

function checkPrefix(channel: string) {
  if (!channel.startsWith("imodeljs."))
    throw new Error(`illegal channel name '${channel}'`);
}

type ElectronListener = (event: IpcRendererEvent, ...args: any[]) => void;

/** the implementation of the private api between the frontend (renderer) and backend (main) iModel.js processes in Electron. */
const frontendApi: IModelElectronApi = {
  send(channel: string, ...data: any[]) {
    checkPrefix(channel);
    ipcRenderer.send(channel, ...data);
  },
  on(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    return ipcRenderer.on(channel, listener);
  },
  once(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    ipcRenderer.once(channel, listener);
  },
  removeListener(channel: string, listener: ElectronListener) {
    checkPrefix(channel);
    ipcRenderer.removeListener(channel, listener);
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

// this adds the frontendApi object under the name `window.imodeljs_api` in the frontend Electron process.
contextBridge.exposeInMainWorld("imodeljs_api", frontendApi);

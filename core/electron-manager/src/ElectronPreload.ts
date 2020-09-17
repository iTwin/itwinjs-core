/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { contextBridge, ipcRenderer, IpcRendererEvent, remote } from "electron";
import { IModelElectronIpc } from "@bentley/imodeljs-common";

/**
 * This file is loaded as an Electron preload script
 * (see https://www.electronjs.org/docs/api/browser-window#class-browserwindow) from ElectronMain.ts
 */

/** the implementation of the private api between the frontend (renderer) and backend (main) iModel.js processes in Electron. */
const frontendApi: IModelElectronIpc = {
  send: (channel: string, ...data: any[]) => {
    if (channel.startsWith("imodeljs."))
      ipcRenderer.send(channel, ...data);
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
    if (channel.startsWith("imodeljs."))
      ipcRenderer.on(channel, listener);
  },
  showOpenDialogSync: (options: any) => {
    return remote.dialog.showOpenDialogSync(options);
  },
};

// this adds the frontendApi object under the name `window.imodeljs_api` in the frontend Electron process.
contextBridge.exposeInMainWorld("imodeljs_api", frontendApi);

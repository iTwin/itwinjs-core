/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IpcRendererEvent } from "electron";

/** These methods are stored on `window.itwinjs` */
export interface ITwinElectronApi {
  addListener: (channel: string, listener: ElectronListener) => void;
  removeListener: (channel: string, listener: ElectronListener) => void;
  invoke: (channel: string, ...data: any[]) => Promise<any>;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
}

export type ElectronListener = (event: IpcRendererEvent, ...args: any[]) => void;
